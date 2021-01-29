using Bloom.Api;
using Bloom.MiscUI;
using Newtonsoft.Json;

namespace Bloom.web.controllers
{
	class BrowserDialogApi
	{
		static internal string LastCloseSource { get; set; }
		public void RegisterWithApiHandler(BloomApiHandler apiHandler)
		{
			apiHandler.RegisterEndpointHandler("dialog/close",
				(ApiRequest request) =>
				{
					// Closes the current dialog.
					// Optionally, the caller may provide (in JSON) an object with a "source" field with a string value.  This "source" represents the button/etc that initiated the close action.

					var postData = ParseCloseData(request);
					LastCloseSource = postData.source;

					BrowserDialog.CloseDialog();
					request.PostSucceeded();
				}, true);
		}

		// Retrieves and parses the POST data from the close request. 
		private CloseRequestData ParseCloseData(ApiRequest request)
		{
			string json = request.GetPostJson();
			return string.IsNullOrEmpty(json)
				? new CloseRequestData()
				: JsonConvert.DeserializeObject<CloseRequestData>(json);
		}

		private class CloseRequestData
		{
			public string source;
		}
	}
}
