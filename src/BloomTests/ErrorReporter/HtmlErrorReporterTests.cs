using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using Bloom.ErrorReporter;
using Bloom.MiscUI;
using Bloom.web.controllers;
using BloomTests.DataBuilders;
using Moq;
using NUnit.Framework;
using SIL.Reporting;

namespace BloomTests.ErrorReporter
{
	[TestFixture]
	public class HtmlErrorReporterTests
	{
		private string _testValue = "";

		#region GetMessage tests
		[Test]
		public void GetMessage_OnlyText()
		{
			var result = HtmlErrorReporter.GetMessage("message text", null);
			Assert.AreEqual("message text", result.NotEncoded);
		}

		[Test]
		public void GetMessage_OnlyException()
		{
			var exception = new ApplicationException("fake exception");
			var result = HtmlErrorReporter.GetMessage(null, exception);
			Assert.AreEqual("fake exception", result.NotEncoded);
		}

		[Test]
		public void GetMessage_TextAndException_ReturnsTextOnly()
		{
			var exception = new ApplicationException("fake exception");
			var result = HtmlErrorReporter.GetMessage("message text", exception);
			Assert.AreEqual("message text", result.NotEncoded);
		}
		#endregion


		#region NotifyUserOfProblem tests
		[Test]
		public void NotifyUserOfProblem_UnsafeMessage()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// System Under Test
			reporter.NotifyUserOfProblem(new ShowAlwaysPolicy(), "", ErrorResult.Yes, "<b>Tags should be encoded</b>");

			string expected = "http://localhost:0/bloom/C%3A/src/BloomDesktop5.1/output/browser/problemDialog/loader.html"
				+ "?level=notify&msg=%3cb%3eTags%20should%20be%20encoded%3c%2fb%3e";
			mockFactory.Verify(x => x.CreateBrowserDialog(It.Is<string>(url => url == expected), It.IsAny<bool>(), It.IsAny<Action>()));
		}

		[Test]
		public void NotifyUserOfProblem_LongMessage()
		{
			var messageTextBuilder = new StringBuilder();
			for (int i = 0; i < 3000; ++i)
			{
				messageTextBuilder.Append('a');
			}
			var messageText = messageTextBuilder.ToString();

			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// System Under Test
			reporter.NotifyUserOfProblem(new ShowAlwaysPolicy(), "", ErrorResult.Yes, messageText);

			// Verification
			string expected = "http://localhost:0/bloom/C%3A/src/BloomDesktop5.1/output/browser/problemDialog/loader.html"
				+ "?level=notify";
			mockFactory.Verify(x => x.CreateBrowserDialog(It.Is<string>(url => url == expected), It.IsAny<bool>(), It.IsAny<Action>()));

			Assert.AreEqual(messageText, ProblemReportApi.NotifyMessage);
		}

		[TestCase("Report")]
		[TestCase("CustomReport")]
		public void NotifyUserOfProblem_ReportButton(string reportLabel)
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// System Under Test
			reporter.NotifyUserOfProblem(new ShowAlwaysPolicy(), reportLabel, ErrorResult.Yes, "message");

			string expected = "http://localhost:0/bloom/C%3A/src/BloomDesktop5.1/output/browser/problemDialog/loader.html"
				+ $"?level=notify&reportLabel={reportLabel}&msg=message";
			mockFactory.Verify(x => x.CreateBrowserDialog(It.Is<string>(url => url == expected), It.IsAny<bool>(), It.IsAny<Action>()));
		}

		/// <summary>
		/// We want to automatically convert the hard-coded "Details" parameter that ErrorReport.cs passes in
		/// to the new default
		/// </summary>
		[Test]
		public void NotifyUserOfProblem_IfParamIsDetailsThenConvertedToReport()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// System Under Test
			reporter.NotifyUserOfProblem(new ShowAlwaysPolicy(), "Details", ErrorResult.Yes, "message");

			string expected = "http://localhost:0/bloom/C%3A/src/BloomDesktop5.1/output/browser/problemDialog/loader.html"
				+ "?level=notify&reportLabel=Report&msg=message";
			mockFactory.Verify(x => x.CreateBrowserDialog(It.Is<string>(url => url == expected), It.IsAny<bool>(), It.IsAny<Action>()));
		}
		#endregion


		#region CustomNotifyUserAuto tests
		/// <summary>
		/// Test the workaround for if you truly want it to say "Details"
		/// </summary>
		[Test]
		public void CustomNotifyUserAuto_IfInstanceVarIsDetailsThenStaysDetails()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// CustomNotifyUserAuto calls ErrorReport, so we should set it up
			ErrorReport.SetErrorReporter(reporter);

			// System Under Test
			reporter.CustomNotifyUserAuto("Details", null, null, null, "message");

			string expected = "http://localhost:0/bloom/C%3A/src/BloomDesktop5.1/output/browser/problemDialog/loader.html"
				+ "?level=notify&reportLabel=Details&msg=message";
			mockFactory.Verify(x => x.CreateBrowserDialog(It.Is<string>(url => url == expected), It.IsAny<bool>(), It.IsAny<Action>()));
		}

		/// <summary>
		/// Tests that you can use this function to add a secondary action button with the desired text
		/// </summary>
		[Test]
		public void CustomNotifyUserAuto_SecondaryActionButtonLabel()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// CustomNotifyUserAuto calls ErrorReport, so we should set it up
			ErrorReport.SetErrorReporter(reporter);

			// System Under Test
			reporter.CustomNotifyUserAuto("", "Retry", null, null, "message");

			// Verification
			string expected = "http://localhost:0/bloom/C%3A/src/BloomDesktop5.1/output/browser/problemDialog/loader.html"
				+ $"?level=notify&secondaryLabel=Retry&msg=message";
			mockFactory.Verify(x => x.CreateBrowserDialog(It.Is<string>(url => url == expected), It.IsAny<bool>(), It.IsAny<Action>()));
		}

		[Test]
		public void CustomNotifyUserAuto_SecondaryActionAutoInvoked()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// CustomNotifyUserAuto calls ErrorReport, so we should set it up
			ErrorReport.SetErrorReporter(reporter);

			BrowserDialogApi.LastCloseSource = "alternate";

			_testValue = "";
			Action<Exception, string> action = delegate (Exception e, string s)
			{
				_testValue = "Retry was pressed";
			};

			// System Under Test
			reporter.CustomNotifyUserAuto("", "Retry", action, null, "message");

			// Verification
			Assert.AreEqual("Retry was pressed", _testValue);

			// Cleanup
			BrowserDialogApi.LastCloseSource = null;
			_testValue = "";
		}
		#endregion

		#region CustomNotifyUserManual tests
		[Test]
		public void CustomNotifyUserManual_WhenSecondaryActionButtonClicked_ThenSecondaryActionResultReturned()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// CustomNotifyUserManual calls ErrorReport, so we should set it up
			ErrorReport.SetErrorReporter(reporter);

			BrowserDialogApi.LastCloseSource = "alternate";

			// System Under Test
			var result = reporter.CustomNotifyUserManual(new ShowAlwaysPolicy(),
				"Report", ErrorResult.Yes,
				"Retry", ErrorResult.Retry,
				"message");

			// Verification
			Assert.AreEqual(ErrorResult.Retry, result);

			// Cleanup
			BrowserDialogApi.LastCloseSource = null;
		}

		[Test]
		public void CustomNotifyUserManual_WhenReportButtonClicked_ThenReportResultReturned()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// CustomNotifyUserManual calls ErrorReport, so we should set it up
			ErrorReport.SetErrorReporter(reporter);

			BrowserDialogApi.LastCloseSource = "report";

			// System Under Test
			var result = reporter.CustomNotifyUserManual(new ShowAlwaysPolicy(),
				"Report", ErrorResult.Yes,
				"Retry", ErrorResult.Retry,
				"message");

			// Verification
			Assert.AreEqual(ErrorResult.Yes, result);

			// Cleanup
			BrowserDialogApi.LastCloseSource = null;
		}
		
		[Test]
		public void CustomNotifyUserManual_WhenCloseButtonClicked_ThenOKReturned()
		{
			var mockFactory = new Mock<IBrowserDialogFactory>();
			var reporter = new HtmlErrorReporterBuilder()
				.WithTestValues(mockFactory)
				.Build();

			// CustomNotifyUserManual calls ErrorReport, so we should set it up
			ErrorReport.SetErrorReporter(reporter);

			BrowserDialogApi.LastCloseSource = null;

			// System Under Test
			var result = reporter.CustomNotifyUserManual(new ShowAlwaysPolicy(),
				"Report", ErrorResult.Yes,
				"Retry", ErrorResult.Retry,
				"message");

			// Verification
			Assert.AreEqual(ErrorResult.OK, result);

			// Cleanup
			BrowserDialogApi.LastCloseSource = null;
		}
		#endregion
	}
}
