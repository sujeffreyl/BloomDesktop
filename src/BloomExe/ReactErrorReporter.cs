using System;
using System.Collections.Generic;
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
		public static void NotifyUserOfProblem(Exception error, bool allowReport, string messageFmt, params object[] args)
		{
			ReactErrorReporter.Instance.AllowReportOnNextNotify = allowReport;
			ErrorReport.NotifyUserOfProblem(error, messageFmt, args);
		}
	}

	// REVIEW: Should the name be BloomErrorReporter or BloomReactErrorReporter, consider we make Sentry calls here?
	public class ReactErrorReporter: IErrorReporter
	{
		// TODO: Add Sentry reporting functionality

		// TODO: What if multiple threads trying to set this.
		public bool AllowReportOnNextNotify { get; set; } = false;

		private bool _showingDialog = false;
		static object _showingDialogLock = new object();

		private ReactErrorReporter()
		{
		}

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

		public ErrorResult NotifyUserOfProblem(IRepeatNoticePolicy policy, string alternateButton1Label, ErrorResult resultIfAlternateButtonPressed, string message)
		{
			ShowDialog(null, message, "user", "", false);
			return ErrorResult.OK;
		}

		public void ReportFatalException(Exception e)
		{
			throw new NotImplementedException();
		}

		public void ReportFatalMessageWithStackTrace(string message, object[] args)
		{
			throw new NotImplementedException();
		}

		public void ReportNonFatalException(Exception exception, IRepeatNoticePolicy policy)
		{
			throw new NotImplementedException();
		}

		public void ReportNonFatalExceptionWithMessage(Exception error, string message, params object[] args)
		{
			throw new NotImplementedException();
		}

		public void ReportNonFatalMessageWithStackTrace(string message, params object[] args)
		{
			throw new NotImplementedException();
		}

		public void ShowDialog(Exception exception,
			string detailedMessage = "", string levelOfProblem = "user", string shortUserLevelMessage = "", bool isShortMessagePreEncoded = false)
		{
			// Before we do anything that might be "risky", put the problem in the log.
			ProblemReportApi.LogProblem(exception, detailedMessage, levelOfProblem);
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

			//GatherReportInfoExceptScreenshot(exception, detailedMessage, shortUserLevelMessage, isShortMessagePreEncoded);

			// ENHANCE: Allow the caller to pass in the control, which would be at the front of this.
			System.Windows.Forms.Control control = Form.ActiveForm ?? FatalExceptionHandler.ControlOnUIThread;
			SafeInvoke.InvokeIfPossible("Show Error Reporter", control, false, () =>
			{
				// Uses a browser dialog to show the problem report
				try
				{
					var encodedMessage = UrlPathString.CreateFromUnencodedString(detailedMessage).UrlEncoded;
					var query = $"?{levelOfProblem}&reportable={(AllowReportOnNextNotify ? 1 : 0)}&msg={encodedMessage}";
					var problemDialogRootPath = BloomFileLocator.GetBrowserFile(false, "errorReport", "loader.html");
					var url = problemDialogRootPath.ToLocalhost() + query;

					// Precondition: we must be on the UI thread for Gecko to work.
					using (var dlg = new BrowserDialog(url))
					{
						dlg.Width = 620;

						// 350px was experimentally determined as what was needed for the longest known text
						// (which is "Before saving, Bloom did an integrity check of your book [...]" from BookStorage.cs)
						// You can make this height taller if need be.
						// A scrollbar will appear if the height is not tall enough for the text
						dlg.Height = 360;	

						// ShowDialog will cause this thread to be blocked (because it spins up a modal) until the dialog is closed.
						BloomServer._theOneInstance.RegisterThreadBlocking();
						try
						{
							dlg.ShowDialog();
						}
						finally
						{
							BloomServer._theOneInstance.RegisterThreadUnblocked();
						}
					}
				}
				catch (Exception problemReportException)
				{
					// TODO: Review this code

					Logger.WriteError("*** ProblemReportApi threw an exception trying to display", problemReportException);
					// At this point our problem reporter has failed for some reason, so we want the old WinForms handler
					// to report both the original error for which we tried to open our dialog and this new one where
					// the dialog itself failed.
					// In order to do that, we create a new exception with the original exception (if there was one) as the
					// inner exception. We include the message of the exception we just caught. Then we call the
					// old WinForms fatal exception report directly.
					// In any case, both of the errors will be logged by now.
					var message = "Bloom's error reporting failed: " + problemReportException.Message;
					ErrorReport.ReportFatalException(new ApplicationException(message, exception ?? problemReportException));
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

	}
}
