using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using Bloom;
using NUnit.Framework;

namespace BloomTests
{
	[TestFixture]
	public class ReactErrorReporterTests
	{
		[Test]
		public void GetMessage_OnlyText()
		{
			var result = ReactErrorReporter.GetMessage("message text", null);
			Assert.AreEqual("message text", result.NotEncoded);
		}

		[Test]
		public void GetMessage_OnlyException()
		{
			var exception = new ApplicationException("fake exception");
			var result = ReactErrorReporter.GetMessage(null, exception);
			Assert.AreEqual("fake exception", result.NotEncoded);
		}

		[Test]
		public void GetMessage_TextAndException_ReturnsTextOnly()
		{
			var exception = new ApplicationException("fake exception");
			var result = ReactErrorReporter.GetMessage("message text", exception);
			Assert.AreEqual("message text", result.NotEncoded);
		}

		[Test]
		public void GetMessage_TextAndStackTrace_ReturnsTextFollowedByStackTrace()
		{
			var stackTrace = new StackTrace();
			var stackString = stackTrace.ToString();
			
			var result = ReactErrorReporter.GetMessage("message text", null, stackTrace);


			var expected = $"Message (not an exception): message text" + Environment.NewLine
						+ Environment.NewLine
						+ "--Stack--" + Environment.NewLine
						+ stackString.TrimEnd();	// because URLPathString calls Trim()
			Assert.AreEqual(expected, result.NotEncoded);
		}
	}
}
