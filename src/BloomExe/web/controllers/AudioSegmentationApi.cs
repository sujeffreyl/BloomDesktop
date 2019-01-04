using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bloom.Api;

namespace Bloom.web.controllers
{
	// API Handler to process audio segmentation (forced alignment)
	public class AudioSegmentationApi
	{
		public const string kApiUrlPart = "audioSegmentation/";

		public AudioSegmentationApi()
		{
		}

		public void RegisterWithApiHandler(BloomApiHandler apiHandler)
		{
			apiHandler.RegisterEndpointHandler(kApiUrlPart + "autoSegmentAudio", AutoSegment, handleOnUiThread: false, requiresSync : false);
		}

		public void AutoSegment(ApiRequest request)
		{
			//request.ReplyWithText("hello world");
			string inputAudioFilename = @"C:\Users\SuJ\Documents\Bloom\My Source Collection\audioSync whole\audio\c97062fa-b09f-4965-b24b-88487bcd5761.mp3";
			string inputTextFragmentsFilename = @"C:\Users\SuJ\Documents\SIL\Bloom\Forced Alignment\inputs\splitTest\James ManyAudioSentenceTest\fragments.txt";
			string outputFilename = @"C:\Users\SuJ\Documents\Bloom\My Source Collection\audioSync whole\audio\c97062fa-b09f-4965-b24b-88487bcd5761_timings.srt";
			string lang = "en";

			// Note: The version of FFMPEG in output/Debug or output/Release is probably not compatible with the version required by Aeneas.
			// Thus, change the working path to something that hopefully doesn't contain our FFMPEG version.
			string commandString = $"cd %HOMEDRIVE%\\%HOMEPATH% && python -m aeneas.tools.execute_task \"{inputAudioFilename}\" \"{inputTextFragmentsFilename}\" \"task_language={lang}|is_text_type=plain|os_task_file_format=srt\" \"{outputFilename}\"";

			var processStartInfo = new ProcessStartInfo();
			processStartInfo.FileName = "CMD.EXE";

			// DEBUG NOTE: you can use "/K" instead of "/C" to keep the window open (if needed for debugging)
			processStartInfo.Arguments = $"/C {commandString}";

			var process = Process.Start(processStartInfo);

			// TODO: Should I set a timeout?  In general Aeneas is reasonably fast but it doesn't really seem like I could guarantee that it would return within a certain time..
			// Block the current thread of execution until aeneas has completed, so that we can read the correct results from the output file.
			process.WaitForExit();			


			// TODO: Catch some errors, maybe?
			// Probably better just to let the error handler pass it, and have the Javascript code be as robust as possible, instead of passing on the errors to the user
			string segmentationResults = "";
			try
			{
				segmentationResults = File.ReadAllText(outputFilename);
			}
			// Catch certain exceptions related to reading the file, but not those that seem to be caused by our code.
			catch (Exception e) when (e is PathTooLongException || e is DirectoryNotFoundException || e is IOException || e is UnauthorizedAccessException || e is FileNotFoundException)
			{
				// TODO: Re-think all this later
				request.ReplyWithText($"BloomError: Exception thrown when reading file.\n{e.Message}");
			}
			request.ReplyWithText(segmentationResults);
		}
	}
}
