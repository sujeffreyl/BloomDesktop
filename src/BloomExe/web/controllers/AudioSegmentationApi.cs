using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bloom.Api;
using Bloom.Book;
using Newtonsoft.Json;

namespace Bloom.web.controllers
{
	// API Handler to process audio segmentation (forced alignment)
	public class AudioSegmentationApi
	{
		public const string kApiUrlPart = "audioSegmentation/";

		BookSelection _bookSelection;
		public AudioSegmentationApi(BookSelection bookSelection)
		{
			_bookSelection = bookSelection;
		}

		public void RegisterWithApiHandler(BloomApiHandler apiHandler)
		{
			apiHandler.RegisterEndpointHandler(kApiUrlPart + "autoSegmentAudio", AutoSegment, handleOnUiThread: false, requiresSync : false);
			apiHandler.RegisterEndpointHandler(kApiUrlPart + "checkAutoSegmentDependencies", CheckAutoSegmentDependenciesMet, handleOnUiThread: false, requiresSync: false);
		}

		public void CheckAutoSegmentDependenciesMet(ApiRequest request)
		{
			// For Auto segment to work, we need at least:
			// 1) Python (to run Aeneas)
			// 2) Aeneas (to run splits)
			// 3) Any Aeneas dependencies, but hopefully the install of Aeneas took care of that
			//    3A) Espeak is one.
			// 4) FFMPEG, and not necessarily a stripped-down version
			// 5) Any FFMPEG dependencies?
			string workingDirectory = "%HOMEDRIVE%\\%HOMEPATH%";
			if (DoesCommandCauseError("WHERE python", workingDirectory))
			{
				request.ReplyWithText("FALSE Python not found.");
				return;
			}
			else if (DoesCommandCauseError("WHERE espeak", workingDirectory))
			{
				request.ReplyWithText("FALSE espeak not found.");
				return;
			}
			else if (DoesCommandCauseError("WHERE ffmpeg", workingDirectory))
			{
				request.ReplyWithText("FALSE FFMPEG not found.");
				return;
			}
			else if (DoesCommandCauseError("python -m aeneas.tools.execute_task", workingDirectory, 2))	// Expected to list usage. Error Code 0 = Success, 1 = Error, 2 = Help shown.
			{
				request.ReplyWithText("FALSE Aeneas not found in Python environment.");
				return;
			}
			else
			{
				// TODO: Check if the file exists. Or maybe not. it'll make the state awkward.
				request.ReplyWithText("TRUE");
				return;
			}
		}

		// Returns true if the command returned with an error
		protected bool DoesCommandCauseError(string commandString, string workingDirectory = "", params int[] errorCodesToIgnore)
		{
			if (!String.IsNullOrEmpty(workingDirectory))
			{
				commandString = $"cd \"{workingDirectory}\" && {commandString}";
			}

			string arguments = $"/C {commandString} && exit %ERRORLEVEL%";
			var process = new Process()
			{
				StartInfo = new ProcessStartInfo()
				{
					FileName = "CMD",
					Arguments = arguments,
					UseShellExecute = false,
					CreateNoWindow = true,
				},
			};

			process.Start();
			process.WaitForExit();

			Debug.Assert(process.ExitCode != -1073741510); // aka 0xc000013a which means that the command prompt exited, and we can't determine what the exit code of the last command was :(

			if (process.ExitCode == 0)
			{
				return false;	// No error
			}
			else if (errorCodesToIgnore.Length > 0 && errorCodesToIgnore.Contains(process.ExitCode))
			{
				// It seemed to return an error, but the caller has actually specified that this error is nothing to worry about, so return no error
				return false;
			}
			else
			{
				// Error
				return true;
			}
		}

		public void AutoSegment(ApiRequest request)
		{
			// Parse the JSON containing the text segmentation data.
			var dynamicParsedObj = DynamicJson.Parse(request.RequiredPostJson());
			string filenameBase = dynamicParsedObj.audioFilenameBase;
			string[][] fragmentIdTuples = dynamicParsedObj.fragmentIdTuples;
			string langCode = dynamicParsedObj.lang;

			string directoryName = _bookSelection.CurrentSelection.FolderPath + "\\audio";
			string inputAudioFilename = $"{directoryName}\\{filenameBase}.mp3";
			// TODO: Also check if .wav if needed. Or maybe first.

			string textFragmentsFilename =  $"{directoryName}/{filenameBase}_fragments.txt";
			string audioTimingsFilename = $"{directoryName}/{filenameBase}_timings.srt";

			IEnumerable<IList<string>> parsedTextSegmentationObj = fragmentIdTuples;
			// TODO: CLEANUP
			//IEnumerable<IList<string>> parsedTextSegmentationObj = JsonConvert.DeserializeObject<string[][]>(request.RequiredPostJson());
			parsedTextSegmentationObj = parsedTextSegmentationObj.Where(subarray => !String.IsNullOrWhiteSpace(subarray[0]));	// Remove entries containing only whitespace
			var fragmentList = parsedTextSegmentationObj.Select(subarray => subarray[0]);
			var idList = parsedTextSegmentationObj.Select(subarray => subarray[1]).ToList();

			File.WriteAllLines(textFragmentsFilename, fragmentList);

			var timingStartEndRangeList = GetSplitStartEndTimings(inputAudioFilename, textFragmentsFilename, audioTimingsFilename, langCode);

			ExtractAudioSegments(idList, timingStartEndRangeList, directoryName, inputAudioFilename);

			// TODO: Should return some false status codes sometimes
			request.ReplyWithBoolean(true); // Success
		}

		public List<Tuple<string, string>> GetSplitStartEndTimings(string inputAudioFilename, string inputTextFragmentsFilename, string outputTimingsFilename, string ttsEngineLang = "en")
		{
			string aeneasLang = "en";   // Maybe just leave it as "en" the whole time and rely on the TTS override to specify the real lang

			// Note: The version of FFMPEG in output/Debug or output/Release is probably not compatible with the version required by Aeneas.
			// Thus, change the working path to something that hopefully doesn't contain our FFMPEG version.
			string commandString = $"cd %HOMEDRIVE%\\%HOMEPATH% && python -m aeneas.tools.execute_task \"{inputAudioFilename}\" \"{inputTextFragmentsFilename}\" \"task_language={aeneasLang}|is_text_type=plain|os_task_file_format=srt\" \"{outputTimingsFilename}\" --runtime-configuration=\"tts_voice_code={ttsEngineLang}\"";

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
			var startInfo = new ProcessStartInfo(fileName: "CMD", arguments: $"/C {commandString}");

			return RunProcessAsync(startInfo);
		}

		// Starts a process and returns a task (that you can use to wait/await for the completion of the process0
		public static Task<int> RunProcessAsync(ProcessStartInfo startInfo)
		{
			var tcs = new TaskCompletionSource<int>();

			var process = new Process
			{
				StartInfo = startInfo,
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
