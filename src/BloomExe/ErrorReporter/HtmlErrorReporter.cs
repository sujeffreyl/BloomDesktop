using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Windows.Forms;
using Bloom.Api;
using Bloom.MiscUI;
using Bloom.ToPalaso;
using Bloom.web.controllers;
using SIL.Reporting;
using SIL.Windows.Forms.Reporting;

namespace Bloom.ErrorReporter
{
	/// <summary>
	/// An Error Reporter designed to be used with libpalaso's ErrorReport.
	/// </summary>
	public class HtmlErrorReporter: IErrorReporter
	{
		private HtmlErrorReporter()
		{
			ResetToDefaults();
		}

		private static HtmlErrorReporter _instance;
		public static HtmlErrorReporter Instance
		{
			get
			{
				if (_instance == null)
				{
					_instance = new HtmlErrorReporter();
				}
				return _instance;
			}
		}

		// TODO: What if multiple threads trying to set this.
		public bool AllowReportOnNextNotify { get; set; } = true;
		// The L10n key of the label text of the alternate action button.
		// e.g. for "Retry", you might put the key ErrorReportApi.Retry
		// To disable the alternate action, set this to null or ""
		public string AltLabelL10nKey { get; set; }
		public Action<Exception, string> OnAlternatePressed { get; set; } = null;

		private bool _showingDialog = false;
		static object _showingDialogLock = new object();

		private void ResetToDefaults()
		{
			ErrorReport.OnShowDetails = null;
			AllowReportOnNextNotify = true;	// Historically, WinFormsErrorReporter shows the Details (equivalent to Report) button, so default this to true.
			AltLabelL10nKey = null;
			OnAlternatePressed = null;
		}

		#region IErrorReporter interface
		/// <summary>
		/// Notifies the user of a problem, using a React-based dialog.
		/// Note: These are considered to be non-fatal notifications.
		/// Note: Most of the parameters are mostly just relevant to LibPalaso.
		/// </summary>
		/// <param name="policy">Checks if we should notify the user, based on the contents of {message}</param>
		/// <param name="alternateButton1Label">This is ignored, because the main caller (LibPalaso ErrorReport) always passses "Details".
		/// This class uses the value determined by this.AltLabelL10nKey instead.</param>
		/// <param name="resultIfAlternateButtonPressed">This is the value that this method should return so that the caller (mainly LibPalaso ErrorReport)
		/// can know if the alternate button was pressed, and if so, it will invoke ErrorReport.OnShowDetails().</param>
		/// <param name="message">The message to show to the user</param>
		/// <returns>If the alternate button was pressed, returns {resultIfAlternateButtonPressed}. Otherwise, ErrorResult.OK</returns>
		public ErrorResult NotifyUserOfProblem(IRepeatNoticePolicy policy, string alternateButton1Label, ErrorResult resultIfAlternateButtonPressed, string message)
		{
			try
			{
				ErrorResult result = ErrorResult.OK;
				if (policy.ShouldShowMessage(message))
				{
					// TODO: Check if
					//if (!string.IsNullOrEmpty(alternateButton1Label))
					ErrorReport.OnShowDetails = null;
					result = ShowNotifyDialog(ProblemLevel.kNonFatal, message, null, resultIfAlternateButtonPressed);
				}

				ResetToDefaults();

				return result;
			}
			catch (Exception e)
			{
				var fallbackReporter = new WinFormsErrorReporter();
				fallbackReporter.ReportFatalException(e);

				return ErrorResult.Abort;
			}
		}

		public void ReportNonFatalException(Exception exception, IRepeatNoticePolicy policy)
		{
			// Note: I think it's better to call ProblemReportApi directly, rather than passing through NonFatalProblem first.
			// Otherwise you have to deal with ModalIf, PassiveIf, and you also have to worry about whether Sentry will happen twice.
			ProblemReportApi.ShowProblemDialog(Form.ActiveForm, exception, null, ProblemLevel.kNonFatal);
		}

		public void ReportNonFatalExceptionWithMessage(Exception error, string messageFormat, params object[] args)
		{
			// TODO: Think about what the right value of Form is. Should we allow the caller to specify it?
			var message = String.Format(messageFormat, args);
			ProblemReportApi.ShowProblemDialog(Form.ActiveForm, error, message , ProblemLevel.kNonFatal);
		}

		public void ReportNonFatalMessageWithStackTrace(string messageFormat, params object[] args)
		{
			var stackTrace = new StackTrace(true);
			var userLevelMessage = String.Format(messageFormat, args);
			string detailedMessage = FormatMessageWithStackTrace(userLevelMessage, stackTrace);
			ProblemReportApi.ShowProblemDialog(Form.ActiveForm, null, detailedMessage, ProblemLevel.kNonFatal, userLevelMessage);
		}

		public void ReportFatalException(Exception e)
		{
			ProblemReportApi.ShowProblemDialog(Form.ActiveForm, e, null, ProblemLevel.kFatal);
			Quit();
		}

		public void ReportFatalMessageWithStackTrace(string messageFormat, object[] args)
		{
			var stackTrace = new StackTrace(true);
			var userLevelMessage = String.Format(messageFormat, args);
			string detailedMessage = FormatMessageWithStackTrace(userLevelMessage, stackTrace);
			ProblemReportApi.ShowProblemDialog(Form.ActiveForm, null, detailedMessage, ProblemLevel.kFatal, userLevelMessage);
			Quit();
		}
		#endregion

		private string FormatMessageWithStackTrace(string message, StackTrace stackTrace)
        {
			return $"Message (not an exception): {message}" + Environment.NewLine
				+ Environment.NewLine
				+ "--Stack--" + Environment.NewLine
				+ stackTrace.ToString();
		}

		internal static UrlPathString GetMessage(string detailedMessage, Exception exception)
		{
			string textToReport = !string.IsNullOrEmpty(detailedMessage) ? detailedMessage : exception.Message;
			return UrlPathString.CreateFromUnencodedString(textToReport, true);
		}

		private static void Quit() => Process.GetCurrentProcess().Kill();	// Same way WinFormsErrorReporter quits

		private ErrorResult ShowNotifyDialog(string severity,
            string messageText = "", Exception exception = null, ErrorResult resultIfAlternatePressed = ErrorResult.OK)
        {
			// TODO: Do we care that it says "ProblemReportAPi" instead of "ErrorReporter"?

			// Before we do anything that might be "risky", put the problem in the log.
			ProblemReportApi.LogProblem(exception, messageText, severity);
			Program.CloseSplashScreen(); // if it's still up, it'll be on top of the dialog

			lock (_showingDialogLock)
			{
				// TODO: Shouldn't you just make these queue up instead?
				if (_showingDialog)
				{
					// Avoid showing multiple dialogs at once, e.g. if a problem is reported while reporting a problem, that could
					// be an unbounded recursion that freezes the program and prevents the original
					// problem from being reported.  So minimally report the recursive problem and stop
					// the recursion in its tracks.
					const string msg = "MULTIPLE CALLS to ShowDialog. Suppressing the subsequent calls";
					Console.Write(msg);
					Logger.WriteEvent(msg);
					return ErrorResult.Abort; // Abort
				}

				_showingDialog = true;
			}

			ErrorResult returnResult = ErrorResult.OK;

			// ENHANCE: Allow the caller to pass in the control, which would be at the front of this.
			System.Windows.Forms.Control control = Form.ActiveForm ?? FatalExceptionHandler.ControlOnUIThread;
			SafeInvoke.InvokeIfPossible("Show Error Reporter", control, false, () =>
			{
				// Uses a browser dialog to show the problem report
				try
				{
					var message = GetMessage(messageText, exception);
					
					var problemDialogRootPath = BloomFileLocator.GetBrowserFile(false, "problemDialog", "loader.html");

					var query = $"?level={ProblemLevel.kNotify}&reportable={(AllowReportOnNextNotify ? 1 : 0)}"
						+ (String.IsNullOrEmpty(AltLabelL10nKey) ? "" : $"&altl10n={AltLabelL10nKey}");					
					var url = problemDialogRootPath.ToLocalhost() + query;

					// Prefer putting the message in the URL parameters, so it can just be a simple one-and-done GET request.
					//   (IMO, this makes debugging easier and simplifies the rendering process).
					// But very long URL's cause our BrowserDialog problems.
					// Although there are suggestions that Firefox based browsers could have URL's about 60k in length,
					// we'll just stick to <2k because that was recommended as a length with basically universal support across browser platforms
					string encodedMessage = message.UrlEncoded;
					if (url.Length + encodedMessage.Length < 2048)
					{
						url += $"&msg={encodedMessage}";
					}
					else
					{
						// TODO: Consolidate with ProblemReportAPI
						ErrorReportApi.Message = message.NotEncoded;
					}
					

					// Precondition: we must be on the UI thread for Gecko to work.
					using (var dlg = new BrowserDialog(url))
					{
						dlg.Width = 620;

						// 350px was experimentally determined as what was needed for the longest known text for NotifyUserOfProblem
						// (which is "Before saving, Bloom did an integrity check of your book [...]" from BookStorage.cs)
						// You can make this height taller if need be.
						// A scrollbar will appear if the height is not tall enough for the text
						dlg.Height = 360;	

						// ShowDialog will cause this thread to be blocked (because it spins up a modal) until the dialog is closed.
						BloomServer._theOneInstance.RegisterThreadBlocking();

						try
						{
							dlg.ShowDialog();

							// Continue to hold the lock, so we don't have to worry about what might run
							// in between the first dialog closing and the potentially next one starting

							// Take action if the user clicked a button other than Close
							if (BrowserDialogApi.LastCloseSource == "alternate")
							{
								// OnShowDetails will be invoked if this method returns {resultIfAlternateButtonPressed}
								// FYI, setting to null is OK. It should cause ErrorReport to reset to default handler.
								ErrorReport.OnShowDetails = OnAlternatePressed;

								returnResult = resultIfAlternatePressed;
							}
							else if (BrowserDialogApi.LastCloseSource == "report")
							{
								//// TODO: This needs a L10N key. And the right copy.
								//var shortMessage = severity == kFatal ? "Bloom reported a fatal problem" : "Bloom reported a non-fatal problem";
								//ProblemReportApi.ShowProblemDialog(control, exception, messageText, severity.ToLowerInvariant(), shortMessage);

								ErrorReport.OnShowDetails = OnReportPressed;
								returnResult = resultIfAlternatePressed;
							}
							// REVIEW / ENHANCE: Should we come back to the same dialog afterwards?
							// Now that we have more options, it might be nice.
							// But, the control flow from LibPalaso ErrorReport indicates that the suggestion is you can only take one of the actions
							// and then the notifier will go away after it's done.
						}
						finally
						{
							BloomServer._theOneInstance.RegisterThreadUnblocked();
						}
					}
				}
				catch (Exception errorReporterException)
				{
					Logger.WriteError("*** ReactErrorReporter threw an exception trying to display", errorReporterException);
					// At this point our problem reporter has failed for some reason, so we want the old WinForms handler
					// to report both the original error for which we tried to open our dialog and this new one where
					// the dialog itself failed.
					// In order to do that, we create a new exception with the original exception (if there was one) as the
					// inner exception. We include the message of the exception we just caught. Then we call the
					// old WinForms fatal exception report directly.
					// In any case, both of the errors will be logged by now.
					var message = "Bloom's error reporting failed: " + errorReporterException.Message;

					// Fallback to Winforms in case of trouble getting the browser to work
					var fallbackReporter = new WinFormsErrorReporter();
					fallbackReporter.ReportFatalException(new ApplicationException(message, exception ?? errorReporterException));
				}
				finally
				{
					lock (_showingDialogLock)
					{
						_showingDialog = false;
					}
				}
			});

			return returnResult;
		}

		public static void OnReportPressed(Exception error, string message)
		{
			// TODO: How do you want to massage message?
			// "Bloom reported a non-fatal problem"
			ErrorReport.ReportNonFatalExceptionWithMessage(error, message);
		}
	}
}
