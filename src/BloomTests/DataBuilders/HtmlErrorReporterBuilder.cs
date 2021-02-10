using Bloom.Api;
using Bloom.ErrorReporter;
using Bloom.MiscUI;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace BloomTests.DataBuilders
{
	// Uses a DataBuilder pattern to facilatate creation of an HtmlErrorReporter object
	class HtmlErrorReporterBuilder
	{
		private HtmlErrorReporter _reporter = HtmlErrorReporter.Instance;

		public HtmlErrorReporter Build()
		{
			return _reporter;
		}

		/// <summary>
		/// Provides reasonable default values for an HtmlErrorReporter that would be used in unit tests
		/// </summary>
		/// <param name="mockFactory">For the unit tests, I assume you don't want it to create real browser dialogs,
		/// so this method requires you pass in a mock factory</param>
		/// <returns></returns>
		public HtmlErrorReporterBuilder WithTestValues(Mock<IBrowserDialogFactory> mockFactory)
		{
			// Create default test value for BrowserDialogFactory
			var mockBrowserDialog = new Mock<IBrowserDialog>();
			mockFactory.Setup(x => x.CreateBrowserDialog(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<Action>())).Returns(mockBrowserDialog.Object);
			BrowserDialogFactory(mockFactory.Object);

			var mockBloomServer = new Mock<IBloomServer>();
			BloomServer(mockBloomServer.Object);

			// Create default test value for Control
			var testControl = new Control();
			testControl.CreateControl();
			Control(testControl);

			return this;
		}

		public HtmlErrorReporterBuilder BrowserDialogFactory(IBrowserDialogFactory factory)
		{
			_reporter.BrowserDialogFactory = factory;
			return this;
		}

		public HtmlErrorReporterBuilder BloomServer(IBloomServer bloomServer)
		{
			_reporter.BloomServer = bloomServer;
			return this;
		}

		public HtmlErrorReporterBuilder Control(Control control)
		{
			_reporter.Control = control;
			return this;
		}
	}
}
