using Bloom.Api;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Bloom.web.controllers
{
	public class ErrorReportApi
	{
		public const string kApiUrlPart = "errorReport/";

		public ErrorReportApi()
		{
		}

		// Precondition: Assumes there aren't multiple dialogs that need to set two seperate values
		internal static string Message { get; set; }

		public void RegisterWithApiHandler(BloomApiHandler apiHandler)
		{
			apiHandler.RegisterEndpointHandlerUsedByOthers(kApiUrlPart + "message", GetMessage, handleOnUiThread: false);
		}

		public void GetMessage(ApiRequest request)
		{
			request.ReplyWithText(Message?? "");
		}
	}
}
