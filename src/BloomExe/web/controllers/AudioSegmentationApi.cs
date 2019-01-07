using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bloom.Api;
using Newtonsoft.Json;

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
			string inputAudioFilename = @"C:\Users\SuJ\Documents\Bloom\My Source Collection\audioSync whole Spare\audio\c97062fa-b09f-4965-b24b-88487bcd5761.mp3";
			string directoryName = Path.GetDirectoryName(inputAudioFilename);
			string filenameBase = Path.GetFileNameWithoutExtension(inputAudioFilename);
			string textFragmentsFilename =  $"{directoryName}/{filenameBase}_fragments.txt";
			string audioTimingsFilename = $"{directoryName}/{filenameBase}_timings.srt";

			// Parse the JSON containing the text segmentation data.
			IEnumerable<IList<string>> parsedTextSegmentationObj = JsonConvert.DeserializeObject<string[][]>(request.RequiredPostJson());
			parsedTextSegmentationObj = parsedTextSegmentationObj.Where(subarray => !String.IsNullOrWhiteSpace(subarray[0]));	// Remove entries containing only whitespace
			var fragmentList = parsedTextSegmentationObj.Select(subarray => subarray[0]);
			var idList = parsedTextSegmentationObj.Select(subarray => subarray[1]).ToList();

			File.WriteAllLines(textFragmentsFilename, fragmentList);

			var timingStartEndRangeList = GetSplitStartEndTimings(inputAudioFilename, textFragmentsFilename, audioTimingsFilename);

			ExtractAudioSegments(idList, timingStartEndRangeList, directoryName, inputAudioFilename);

			// TODO: Should return some false status codes sometimes
			request.ReplyWithBoolean(true); // Success
		}

		public List<Tuple<string, string>> GetSplitStartEndTimings(string inputAudioFilename, string inputTextFragmentsFilename, string outputTimingsFilename)
		{
			string lang = "en";

			// Note: The version of FFMPEG in output/Debug or output/Release is probably not compatible with the version required by Aeneas.
			// Thus, change the working path to something that hopefully doesn't contain our FFMPEG version.
			string commandString = $"cd %HOMEDRIVE%\\%HOMEPATH% && python -m aeneas.tools.execute_task \"{inputAudioFilename}\" \"{inputTextFragmentsFilename}\" \"task_language={lang}|is_text_type=plain|os_task_file_format=srt\" \"{outputTimingsFilename}\"";

			var processStartInfo = new ProcessStartInfo()
			{
				FileName = "CMD.EXE",

				// DEBUG NOTE: you can use "/K" instead of "/C" to keep the window open (if needed for debugging)
				Arguments = $"/C {commandString}"
			};

			var process = Process.Start(processStartInfo);

			// TODO: Should I set a timeout?  In general Aeneas is reasonably fast but it doesn't really seem like I could guarantee that it would return within a certain time..
			// Block the current thread of execution until aeneas has completed, so that we can read the correct results from the output file.
			process.WaitForExit();


			// This might throw exceptiosn, but IMO best to let the error handler pass it, and have the Javascript code be as robust as possible, instead of passing on error messages to user
			var segmentationResults = File.ReadAllLines(outputTimingsFilename);
			var timingStartEndRangeList = ParseTimingFileSRT(segmentationResults);
			return timingStartEndRangeList;
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="segmentationResults">The contents (line-by-line) of a .srt timing file</param>
		private List<Tuple<string, string>> ParseTimingFileSRT(IList<string> segmentationResults)
		{
			var timings = new List<Tuple<string, string>>();

			// For now, just a simple parser that assumes the input is very well-formed, no attempt to re-align the states or anything
			// Each record comes in series of 4 lines. The first line has the fragment index (1-based), then the timing range, then the text, then a newline
			// We really only need the timing range for now so we just go straight to it and skip over everything else
			for (int lineNumber = 1; lineNumber <= segmentationResults.Count; lineNumber += 4)
			{
				string line = segmentationResults[lineNumber];
				string timingRange = line.Replace(',', '.');    // Convert from SRT's/Aeneas's HH:MM::SS,mmm format to FFMPEG's "HH:MM:SS.mmm" format. (aka European decimal points to American decimal points)
				var fields = timingRange.Split(new string[] { "-->" }, StringSplitOptions.None);
				string timingStart = fields[0].Trim();
				string timingEnd = fields[1].Trim();

				if (String.IsNullOrEmpty(timingStart))
				{
					if (!timings.Any())
					{
						timingStart = "00:00:00.000";
					}
					else
					{
						timingStart = timings.Last().Item2;
					}
				}

				// If timing end is messed up, we'll continue to pass the record. In theory, it is valid for the timings to be defined solely by the start times (as long as you don't need the highlight to disappear for a time)
				// so don't remove records where the end time is missing

				timings.Add(Tuple.Create(timingStart, timingEnd));
			}

			return timings;
		}

		private void ExtractAudioSegments(IList<string> idList, IList<Tuple<string, string>> timingStartEndRangeList, string directoryName, string inputAudioFilename)
		{
			Debug.Assert(idList.Count == timingStartEndRangeList.Count, $"Number of text fragments ({idList.Count}) does not match number of extracted timings ({timingStartEndRangeList.Count}). The parsed timing ranges might be completely incorrect. The last parsed timing is: ({timingStartEndRangeList.Last()?.Item1 ?? "null"}, {timingStartEndRangeList.Last()?.Item2 ?? "null"}).");

			// Allow each ffmpeg to run in parallel
			var tasksToWait = new Task[timingStartEndRangeList.Count];
			for (int i = 0; i < timingStartEndRangeList.Count; ++i)
			{
				var timingRange = timingStartEndRangeList[i];
				var timingStartString = timingRange.Item1;
				var timingEndString = timingRange.Item2;

				string splitFilename = $"{directoryName}/{idList[i]}.mp3";

				tasksToWait[i] = ExtractAudioSegmentAsync(inputAudioFilename, timingStartString, timingEndString, splitFilename);
			}

			// Wait for them all so that the UI knows all the files are there before it starts mucking with the HTML structure.
			Task.WaitAll(tasksToWait.ToArray());
		}

		public Task<int> ExtractAudioSegmentAsync(string inputAudioFilename, string timingStartString, string timingEndString, string outputSplitFilename)
		{
			string commandString = $"ffmpeg -i \"{inputAudioFilename}\" -acodec copy -ss {timingStartString} -to {timingEndString} \"{outputSplitFilename}\"";

			return RunProcessAsync("CMD", $"/C {commandString}");
		}

		// Allows you to potentially asynchronously wait the completion of the process
		public static Task<int> RunProcessAsync(string fileName, string arguments)
		{
			var tcs = new TaskCompletionSource<int>();

			var process = new Process
			{
				StartInfo = { FileName = fileName, Arguments = arguments },
				EnableRaisingEvents = true
			};

			process.Exited += (sender, args) =>
			{
				tcs.SetResult(process.ExitCode);
				process.Dispose();
			};

			process.Start();

			return tcs.Task;
		}
	}
}
