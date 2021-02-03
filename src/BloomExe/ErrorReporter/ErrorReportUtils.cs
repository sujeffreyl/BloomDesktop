using Bloom.MiscUI;
using SIL.Reporting;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Bloom.ErrorReporter
{
	public class ErrorReportUtils
	{
		// Facade around ErrorReport.NotifyUserOfProblem, but allows specifying allowReport and alternateAction
		public static void NotifyUserOfProblem(bool allowReport, Action alternateAction, Exception error, string messageFmt, params object[] args)
		{
			SetupReactErrorReporter(allowReport, alternateAction);
			ErrorReport.NotifyUserOfProblem(error, messageFmt, args);
		}

		private static void SetupReactErrorReporter(bool allowReport, Action alternateAction)
		{
			HtmlErrorReporter.Instance.AllowReportOnNextNotify = allowReport;
			HtmlErrorReporter.Instance.OnAlternatePressed= alternateAction;
		}

		#region Premade Alternate Actions
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

		internal static void NoAction()
		{
		}
		#endregion
	}
}
