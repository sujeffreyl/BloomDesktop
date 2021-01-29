using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web.UI;
using System.Windows.Forms;
using Bloom.Api;
using Bloom.MiscUI;
using Bloom.ToPalaso;
using Bloom.web.controllers;
using SIL.Reporting;
//using SIL.Windows.Forms.Reporting;

namespace Bloom
{
	public class ErrorReportUtils
	{
		#region Facade around IErrorReporter, but allows specifying allowReport and alternateAction
		public static void NotifyUserOfProblem(bool allowReport, Action alternateAction, Exception error, string messageFmt, params object[] args)
		{
			SetupReactErrorReporter(allowReport, alternateAction);
			ErrorReport.NotifyUserOfProblem(error, messageFmt, args);
		}

		public static void ReportNonFatalException(bool allowReport, Action alternateAction, Exception exception, IRepeatNoticePolicy policy)
		{
			SetupReactErrorReporter(allowReport, alternateAction);
			ErrorReport.ReportNonFatalException(exception, policy);
		}

		public static void ReportNonFatalExceptionWithMessage(bool allowReport, Action alternateAction, Exception error, string message, params object[] args)
		{
			SetupReactErrorReporter(allowReport, alternateAction);
			ErrorReport.ReportNonFatalExceptionWithMessage(error, message, args);
		}

		public static void ReportNonFatalMessageWithStackTrace(bool allowReport, Action alternateAction, string message, params object[] args)
		{
			SetupReactErrorReporter(allowReport, alternateAction);
			ErrorReport.ReportNonFatalMessageWithStackTrace(message, args);
			
		}

		public static void ReportFatalException(bool allowReport, Action alternateAction, Exception e)
		{
			SetupReactErrorReporter(allowReport, alternateAction);
			ErrorReport.ReportFatalException(e);
		}

		public static void ReportFatalMessageWithStackTrace(bool allowReport, Action alternateAction, string message, params object[] args)
		{
			// Note: I added "params" in front of object[] args here in the facade, even though IErrorReporter actually doesn't.
			// I think it makes more sense to be params form...
			SetupReactErrorReporter(allowReport, alternateAction);
			ErrorReport.ReportFatalMessageWithStackTrace(message, args);
		}
		#endregion

		private static void SetupReactErrorReporter(bool allowReport, Action alternateAction)
		{
			ReactErrorReporter.Instance.AllowReportOnNextNotify = allowReport;
			ReactErrorReporter.Instance.OnAlternatePressed= alternateAction;
		}
	}

	// REVIEW: Should the name be BloomErrorReporter or BloomReactErrorReporter, consider we make Sentry calls here?
	public class ReactErrorReporter: IErrorReporter
	{
		// TODO: Add Sentry reporting functionality

		private ReactErrorReporter()
		{
		}

		// These values need to correspond with ErrorReportDialog.tsx's Severity enum
		public const string kNonFatal = "NonFatal";
		public const string kFatal = "Fatal";

		private static ReactErrorReporter _instance;
		public static ReactErrorReporter Instance
		{
			get
			{
				if (_instance == null)
				{
					_instance = new ReactErrorReporter();
				}
				return _instance;
			}
		}

		// TODO: What if multiple threads trying to set this.
		public bool AllowReportOnNextNotify { get; set; } = false;
		public Action OnAlternatePressed { get; set; } = null;

		private bool _showingDialog = false;
		static object _showingDialogLock = new object();


		// TODO: Handle IRepeatNoticePolicy
		public ErrorResult NotifyUserOfProblem(IRepeatNoticePolicy policy, string alternateButton1Label, ErrorResult resultIfAlternateButtonPressed, string message)
		{
			ShowDialog(kNonFatal, message, null);
			return ErrorResult.OK;
		}

		public void ReportNonFatalException(Exception exception, IRepeatNoticePolicy policy)
		{
			ShowDialog(kNonFatal, null, exception);
		}

		public void ReportNonFatalExceptionWithMessage(Exception error, string message, params object[] args)
		{
			// Note: Current behavior is that the message will be displayed to the user.
			// The exception will not be shown directly, but if the user reports the error,
			// then the exception will be submitted and is also visible after clicking Problem Report Dialog's "Learn More" button.
			ShowDialog(kNonFatal, String.Format(message, args), error);
		}

		public void ReportNonFatalMessageWithStackTrace(string message, params object[] args)
		{
			var stack = new StackTrace(true);
			ShowDialog(kNonFatal, String.Format(message, args), null, stack);
		}

		public void ReportFatalException(Exception e)
		{
			ShowDialog(kFatal, null, e);
		}

		public void ReportFatalMessageWithStackTrace(string message, object[] args)
		{
			ShowDialog(kFatal, String.Format(message, args), null, new StackTrace());
		}



		private void ShowDialog(string severity,
            string messageText = "", Exception exception = null, StackTrace stackTrace = null)
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
					return; // Abort
				}

				_showingDialog = true;
			}

			// ENHANCE: Allow the caller to pass in the control, which would be at the front of this.
			System.Windows.Forms.Control control = Form.ActiveForm ?? FatalExceptionHandler.ControlOnUIThread;
			SafeInvoke.InvokeIfPossible("Show Error Reporter", control, false, () =>
			{
				// Uses a browser dialog to show the problem report
				try
				{
					var message = GetMessage(messageText, exception, stackTrace);
					
					var problemDialogRootPath = BloomFileLocator.GetBrowserFile(false, "errorReport", "loader.html");
					var query = $"?sev={severity}&reportable={(AllowReportOnNextNotify ? 1 : 0)}";
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
								this.OnAlternatePressed?.Invoke();
							}
							else if (BrowserDialogApi.LastCloseSource == "report")
							{
								// TODO: This needs a L10N key. And the right copy.
								var shortMessage = severity == kFatal ? "Bloom reported a fatal problem" : "Bloom reported a non-fatal problem";
								ProblemReportApi.ShowProblemDialog(control, exception, messageText, severity.ToLowerInvariant(), shortMessage);

								// TODO: Theoretically, shouldn't we come back to the same dialog?
							}
						}
						finally
						{
							BloomServer._theOneInstance.RegisterThreadUnblocked();
						}

						// TODO: Should we automatically kill it if severity is Fatal?
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

					// TODO: Needs to fallback to Winforms
					ErrorReport.ReportFatalException(new ApplicationException(message, exception ?? errorReporterException));
				}
				finally
				{
					lock (_showingDialogLock)
					{
						_showingDialog = false;
					}
				}
			});
		}

		internal static UrlPathString GetMessage(string detailedMessage, Exception exception, StackTrace stackTrace = null)
		{
			string textToReport;
			if (!string.IsNullOrEmpty(detailedMessage))
			{
				if (stackTrace == null)
				{
					textToReport = detailedMessage;
				}
				else
				{
					textToReport = $"Message (not an exception): {detailedMessage}" + Environment.NewLine
						+ Environment.NewLine
						+ "--Stack--" + Environment.NewLine
						+ stackTrace.ToString();
				}
			}
			else
			{
				textToReport = exception.Message;
			}

			return UrlPathString.CreateFromUnencodedString(textToReport, true);
		}


		// TODO: Remove me and helloWorld.html
		internal static void TestAction()
		{
			var rootPath = BloomFileLocator.GetBrowserFile(false, "errorReport", "helloWorld.html");
			var url = rootPath.ToLocalhost();
			using (var dlg = new BrowserDialog(url))
			{
				dlg.ShowDialog();
			}
		}
	}
}
