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

		public void RegisterWithApiHandler(BloomApiHandler apiHandler)
		{
			apiHandler.RegisterEndpointHandlerUsedByOthers(kApiUrlPart + "doAltAction", DoAltAction, handleOnUiThread: true);
		}

		public void DoAltAction(ApiRequest request)
		{
		}
	}
}
