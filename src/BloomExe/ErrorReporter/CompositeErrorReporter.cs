using SIL.Reporting;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Bloom.ErrorReporter
{
	class CompositeErrorReporter : IErrorReporter
	{
		private IErrorReporter PrimaryReporter { get; set; }
		private IList<IErrorReporter> Reporters { get; set; }

		/// <summary>
		/// Creates a composite error reporter consisting of one primary reporter and any number of secondary reporters.
		/// </summary>
		/// <param name="primaryReporter">The primaryReporter will be executed first. If an interface method has a return value, the composite will return the value that the primary returns</param>
		/// <param name="secondaryReporters">1 or more error reporters, ordered in the order you want them to run.</param>
		public CompositeErrorReporter(IList<IErrorReporter> reporters, IErrorReporter primaryReporter)
		{
			if (reporters == null)
			{
				throw new ArgumentNullException("reporters should not be null");
			}

			this.Reporters = reporters;
			this.PrimaryReporter = primaryReporter ?? reporters.First();
		}

		public ErrorResult NotifyUserOfProblem(IRepeatNoticePolicy policy, string alternateButton1Label, ErrorResult resultIfAlternateButtonPressed, string message)
		{
			ErrorResult? primaryResult = null;
			foreach (var reporter in Reporters)
			{
				var currResult = reporter.NotifyUserOfProblem(policy, alternateButton1Label, resultIfAlternateButtonPressed, message);

				if (reporter == PrimaryReporter)
				{
					primaryResult = currResult;
				}
			}
			
			return primaryResult.Value;
		}

		public void ReportFatalException(Exception e)
		{
			foreach (var reporter in Reporters)
			{
				reporter.ReportFatalException(e);
			}
		}

		public void ReportFatalMessageWithStackTrace(string message, object[] args)
		{
			foreach (var reporter in Reporters)
			{
				reporter.ReportFatalMessageWithStackTrace(message, args);
			}
		}

		public void ReportNonFatalException(Exception exception, IRepeatNoticePolicy policy)
		{
			foreach (var reporter in Reporters)
			{
				reporter.ReportNonFatalException(exception, policy);
			}
		}

		public void ReportNonFatalExceptionWithMessage(Exception error, string message, params object[] args)
		{
			foreach (var reporter in Reporters)
			{
				reporter.ReportNonFatalExceptionWithMessage(error, message, args);
			}
		}

		public void ReportNonFatalMessageWithStackTrace(string message, params object[] args)
		{
			foreach (var reporter in Reporters)
			{
				reporter.ReportNonFatalMessageWithStackTrace(message, args);
			}
		}
	}
}
