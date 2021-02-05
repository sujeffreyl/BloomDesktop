using Bloom.MiscUI;
using SIL.Reporting;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Bloom.ErrorReporter
{
	public class ErrorReportUtils
	{
		/// <summary>
		/// Facade around ErrorReport.NotifyUserOfProblem, but allows customizing the Report and alternate action buttons
		/// </summary>
		/// <param name="allowReport">If true, causes a Report button to be added which allows the user to submit an issue to YouTrack</param>
		/// <param name="alternateButtonLabelL10nKey">The L10n key of the text that should go on the alternate action button.</param>
		/// <param name="alternateAction">The action to perform if the alternate action is pressed.</param>
		/// <param name="error">The exception encountered, if anyr</param>
		/// <param name="messageFmt">Optional - a string to display to the user. May be a format string.</param>
		/// <param name="args">Optional - arguments for the format string</param>
		public static void NotifyUserOfProblem(bool allowReport, string alternateButtonLabelL10nKey, Action<Exception, string> alternateAction, Exception error, string messageFmt, params object[] args)
		{
			SetupHtmlErrorReporter(allowReport, alternateButtonLabelL10nKey, alternateAction);
			ErrorReport.NotifyUserOfProblem(error, messageFmt, args);
		}

		// TODO: Support for other overloads?

		private static void SetupHtmlErrorReporter(bool allowReport, string alternateButtonLabelL10nKey, Action<Exception, string> alternateAction)
		{
			HtmlErrorReporter.Instance.AllowReportOnNextNotify = allowReport;
			HtmlErrorReporter.Instance.AltLabelL10nKey = alternateButtonLabelL10nKey;
			HtmlErrorReporter.Instance.OnAlternatePressed = alternateAction;
		}

		#region Premade Alternate Actions
		internal static void TestAction(Exception error, string message)
		{
			var rootPath = BloomFileLocator.GetBrowserFile(false, "errorReport", "helloWorld.html");
			var url = rootPath.ToLocalhost();
			using (var dlg = new BrowserDialog(url))
			{
				dlg.ShowDialog();
			}
		}

		internal static void NoAction(Exception error, string message)
		{
		}
		#endregion
	}
}
