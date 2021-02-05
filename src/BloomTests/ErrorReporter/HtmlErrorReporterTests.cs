using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using Bloom.ErrorReporter;
using NUnit.Framework;

namespace BloomTests.ErrorReporter
{
	[TestFixture]
	public class HtmlErrorReporterTests
	{
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
	}
}
