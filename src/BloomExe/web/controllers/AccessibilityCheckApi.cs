﻿using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using Bloom.Api;
using Bloom.Book;
using Bloom.Publish.AccessibilityChecker;
using Bloom.Publish.Epub;
using SIL.CommandLineProcessing;
using SIL.PlatformUtilities;
using SIL.Progress;

namespace Bloom.web.controllers
{
	/// <summary>
	/// Used by two screens:
	/// 1) Epub screen uses it to launch the Accessibility Checks Window
	/// 2) The Accessibility Checks Typescript uses it for... everything.
	/// </summary>
	public class AccessibilityCheckApi
	{
		// Define a socket to signal the client window to refresh
		private readonly BloomWebSocketServer _webSocketServer;
		private readonly EpubMaker.Factory _epubMakerFactory;
		private PublishEpubApi _epubApi;

		private readonly NavigationIsolator _isolator;
		private readonly BookServer _bookServer;
		private WebSocketProgress _webSocketProgress;

		public const string kApiUrlPart = "accessibilityCheck/";

		// This goes out with our messages and, on the client side (typescript), messages are filtered
		// down to the context (usualy a screen) that requested them. 
		private const string kWebSocketContext = "a11yChecklist"; // must match what is in accsesibilityChecklist.tsx

		// must match what's in the typescript
		private const string kBookSelectionChanged = "bookSelectionChanged";

		// must match what's in the typescript
		private const string kBookContentsMayHaveChanged = "bookContentsMayHaveChanged";

		// must match what's in the typescript
		private const string kWindowActivated = "a11yChecksWindowActivated"; // REVIEW later... are we going to use this event?


		public AccessibilityCheckApi(BloomWebSocketServer webSocketServer, BookSelection bookSelection,
									BookRefreshEvent bookRefreshEvent, EpubMaker.Factory epubMakerFactory,
			PublishEpubApi epubApi)
		{
			_webSocketServer = webSocketServer;
			_webSocketProgress = new WebSocketProgress(_webSocketServer, kWebSocketContext);
			_epubMakerFactory = epubMakerFactory;
			_epubApi = epubApi;
			bookSelection.SelectionChanged += (unused1, unused2) => _webSocketServer.SendEvent(kWebSocketContext, kBookSelectionChanged);
			bookRefreshEvent.Subscribe((book) => RefreshClient());
		}
		
		public void RegisterWithServer(EnhancedImageServer server)
		{	
			server.RegisterEndpointHandler(kApiUrlPart + "bookName", request =>
			{
				request.ReplyWithText(request.CurrentBook.TitleBestForUserDisplay);
			}, false);

			server.RegisterEndpointHandler(kApiUrlPart + "showAccessibilityChecker", request =>
			{
				AccessibilityCheckWindow.StaticShow(()=>_webSocketServer.SendEvent(kWebSocketContext, kWindowActivated));
				request.PostSucceeded();
			}, true);

			server.RegisterEndpointHandler(kApiUrlPart + "descriptionsForAllImages", request =>
			{
				var problems = AccessibilityCheckers.CheckDescriptionsForAllImages(request.CurrentBook);
				var resultClass = problems.Any() ? "failed" : "passed";
				request.ReplyWithJson(new {resultClass = resultClass, problems = problems});
			}, false);

			server.RegisterEndpointHandler(kApiUrlPart + "audioForAllImageDescriptions", request =>
			{
				var problems = AccessibilityCheckers.CheckAudioForAllImageDescriptions(request.CurrentBook);
				var resultClass = problems.Any() ? "failed" : "passed";
				request.ReplyWithJson(new { resultClass = resultClass, problems = problems });
			}, false);

			server.RegisterEndpointHandler(kApiUrlPart + "audioForAllText", request =>
			{
				var problems = AccessibilityCheckers.CheckAudioForAllText(request.CurrentBook);
				var resultClass = problems.Any() ? "failed" : "passed";
				request.ReplyWithJson(new { resultClass = resultClass, problems = problems });
			}, false);

			// Just a checkbox that the user ticks to say "yes, I checked this"
			// At this point, we don't have a way to clear that when the book changes.
			server.RegisterBooleanEndpointHandler(kApiUrlPart + "noEssentialInfoByColor",
				request => request.CurrentBook.BookInfo.MetaData.A11y_NoEssentialInfoByColor,
				(request, b) => {
					request.CurrentBook.BookInfo.MetaData.A11y_NoEssentialInfoByColor = b;
					request.CurrentBook.Save();
				},
				false);

			// Just a checkbox that the user ticks to say "yes, I checked this"
			// At this point, we don't have a way to clear that when the book changes.
			server.RegisterBooleanEndpointHandler(kApiUrlPart + "noTextIncludedInAnyImages",
				request => request.CurrentBook.BookInfo.MetaData.A11y_NoTextIncludedInAnyImages,
				(request, b) => {
					request.CurrentBook.BookInfo.MetaData.A11y_NoTextIncludedInAnyImages = b;
					request.CurrentBook.Save();
				},
				false);
			
			//enhance: this might have to become async to work on large books on slow computers
			server.RegisterEndpointHandler(kApiUrlPart + "aceByDaisyReportUrl", request => { MakeAceByDaisyReport(request); },
				false
				);
		}

		private void MakeAceByDaisyReport(ApiRequest request)
		{
			if (!UrlLookup.CheckGeneralInternetAvailability(true))
			{
				_webSocketProgress.ErrorWithoutLocalizing("Sorry, you must have an internet connection in order to view the Ace by Daisy report.");
				request.Failed();
				return;
			}
			var daisyDirectory = FindAceByDaisyOrTellUser(request); // this should do the request.fail() if needed
			if (string.IsNullOrEmpty(daisyDirectory))
				return;

			var reportRootDirectory = Path.Combine(System.IO.Path.GetTempPath(), "daisy-ace-reports");
			// Do our best at clearing out previous runs.
			// This call is ok if the directory does not exist at all.
			SIL.IO.RobustIO.DeleteDirectoryAndContents(reportRootDirectory);
			// This call is ok if the above failed and it still exists
			Directory.CreateDirectory(reportRootDirectory);

			// was having a problem with some files from previous reports getting locked.
			// so give new folder names if needed
			var haveReportedError = false;
			var errorMessage = "Unknown Error";

			MakeEpub(request, reportRootDirectory, _webSocketProgress, epubPath =>
			{
				// Try 3 times. It could be that this is no longer needed, but working on a developer
				// machine isn't proof.
				for (var i = 0; i < 3; i++)
				{
					var randomName = Guid.NewGuid().ToString();
					var reportDirectory = Path.Combine(reportRootDirectory, randomName);

					var arguments = $"ace.js  -o \"{reportDirectory}\" \"{epubPath}\"";
					const int kSecondsBeforeTimeout = 60;
					var progress = new NullProgress();
					_webSocketProgress.MessageWithoutLocalizing("Running Ace by Daisy");

					ExecutionResult res = null;
					string ldpath = null;
					try
					{
						// Without this variable switching on Linux, the chrome inside ace finds the
						// wrong version of a library as part of our mozilla code.
						ldpath = Environment.GetEnvironmentVariable("LD_LIBRARY_PATH");
						Environment.SetEnvironmentVariable("LD_LIBRARY_PATH", null);
						res = CommandLineRunner.Run("node", arguments, Encoding.UTF8, daisyDirectory, kSecondsBeforeTimeout, progress,
							(dummy) => { });
					}
					finally
					{
						// Restore the variable for our next geckofx browser to find.
						if (!String.IsNullOrEmpty(ldpath))
							Environment.SetEnvironmentVariable("LD_LIBRARY_PATH", ldpath);
					}

					if (res.DidTimeOut)
					{
						errorMessage = $"Daisy Ace timed out after {kSecondsBeforeTimeout} seconds.";
						_webSocketProgress.ErrorWithoutLocalizing(errorMessage);
						continue;
					}

					var answerPath = Path.Combine(reportDirectory, "report.html");
					if (!File.Exists(answerPath))
					{
						// This hasn't been effectively reproduced, but there was a case where this would fail at least
						// half the time on a book, reproducable. That book had 2 pages pointing at placeholder.png,
						// and we were getting an error related to it being locked. So we deduce that ace was trying
						// to copy the file twice, at the same time (normal nodejs code is highly async).
						// Now the problem is not reproducable, but I'm leaving in this code that tried to deal with it.
						errorMessage = $"Exit code{res.ExitCode}{Environment.NewLine}" +
						               $"Standard Error{Environment.NewLine}{res.StandardError}{Environment.NewLine}" +
						               $"Standard Out{res.StandardOutput}";

						_webSocketProgress.ErrorWithoutLocalizing(errorMessage);

						continue; // something went wrong, try again
					}

					// Send the url of the report to the HTML client
					_webSocketServer.SendString(kWebSocketContext, "daisyResults", "/bloom/" + answerPath);
					return;
				}
				// Three tries, no report...
				_webSocketProgress.ErrorWithoutLocalizing("Failed");
			});

			request.PostSucceeded();
		}

		private void MakeEpub(ApiRequest request, string parentDirectory, IWebSocketProgress progress, Action<string> doWhenReady)
		{
			var settings = new EpubPublishUiSettings();
			_epubApi.GetEpubSettingsForCurrentBook(settings);
			var forceNewEpub = request.RequiredPostBooleanAsJson();
			_epubApi.UpdatePreview(settings, forceNewEpub, _webSocketProgress);
			_epubApi.RequestPreviewOutput(maker =>
			{
				var path = Path.Combine(parentDirectory, Guid.NewGuid().ToString() + ".epub");
				maker.SaveEpub(path, progress);
				doWhenReady(path);
			});
		}

		private string FindAceByDaisyOrTellUser(ApiRequest request)
		{
			_webSocketProgress.MessageWithoutLocalizing("Finding Ace by Daisy on this computer...");
			var whereProgram = Platform.IsWindows ? "where" : "which";
			var npmFileName = Platform.IsWindows ? "npm.cmd" : "npm";
			var whereResult = CommandLineRunner.Run(whereProgram, npmFileName, Encoding.ASCII, "", 2, new NullProgress());
			if (!String.IsNullOrEmpty(whereResult.StandardError))
			{
				_webSocketProgress.ErrorWithoutLocalizing(whereResult.StandardError);
			}
			if (!whereResult.StandardOutput.Contains(npmFileName))
			{
				ReportErrorAndFailTheRequest(request, whereResult, "Could not find npm.");
				return null;
			}

			var fullNpmPath = whereResult.StandardOutput.Split('\n')[0].Trim();
			// note: things like nvm will mess with where the global node_modules lives. The best way seems to be
			// to ask npm:
			var result = CommandLineRunner.Run(npmFileName, "root -g", Encoding.ASCII, Path.GetDirectoryName(fullNpmPath), 10,
				new NullProgress());

			const string kCoreError = "Could not get \"npm -g root\" to work. Is Node & npm installed and working?";
			if (result == null)
			{
				// I don't think this could happen, but *something* was null for Sue.
				ReportErrorAndFailTheRequest(request, whereResult, $"{kCoreError} CommandLineRunner.Run() returned null.");
				return null;
			}
			if (!string.IsNullOrWhiteSpace(result.StandardError))
			{
				ReportErrorAndFailTheRequest(request, whereResult, $"{kCoreError} <br>StandardError:<br>" + result.StandardError);
				return null;
			}
			if (result.StandardOutput == null)
			{
				ReportErrorAndFailTheRequest(request, whereResult, $"{kCoreError} StandardOutput was null.");
				return null;
			}

			if (!result.StandardOutput.Contains("node_modules"))
			{
				ReportErrorAndFailTheRequest(request, whereResult, kCoreError);
				return null;
			}

			var nodeModulesDirectory = result.StandardOutput.Trim();

			if (!Directory.Exists((nodeModulesDirectory)))
			{
				ReportErrorAndFailTheRequest(request, whereResult, "Could not find global node_modules directory");
				return null;
			}

			// if they installed via npm install -g  @daisy/ace
			var daisyDirectory = Path.Combine(nodeModulesDirectory, "@daisy/ace/bin/");
			if (!Directory.Exists((daisyDirectory)))
			{
				// if they just installed via npm install -g  @daisy/ace-cli
				daisyDirectory = Path.Combine(nodeModulesDirectory, "@daisy/ace-cli/bin/");
				if (!Directory.Exists((daisyDirectory)))
				{
					ReportErrorAndFailTheRequest(request, whereResult, $"Could not find daisy-ace at {daisyDirectory}.");
					return null;
				}
			}
			_webSocketProgress.MessageWithoutLocalizing("Found.");
			return daisyDirectory;
		}

		private void ReportErrorAndFailTheRequest(ApiRequest request, ExecutionResult commandLineResult, string error)
		{
			_webSocketProgress.ErrorWithoutLocalizing(commandLineResult.StandardError);
			_webSocketProgress.ErrorWithoutLocalizing(commandLineResult.StandardOutput);
			ReportErrorAndFailTheRequest(request, error);
		}

		private void ReportErrorAndFailTheRequest(ApiRequest request, string error)
		{
			_webSocketProgress.ErrorWithoutLocalizing(error);
			if (Platform.IsWindows)
			{
				_webSocketProgress.MessageWithoutLocalizing("Please follow <a href= 'https://inclusivepublishing.org/toolbox/accessibility-checker/getting-started/' >these instructions</a> to install the Ace By Daisy system on this computer.");
			}
			else
			{
				var programPath = System.Reflection.Assembly.GetEntryAssembly().ManifestModule.FullyQualifiedName;
				var folder = Path.GetDirectoryName(programPath);
				if (folder.EndsWith("/output/Debug") || folder.EndsWith("/output/Release"))
					folder = "";
				var scriptPath = Path.Combine(folder, "DistFiles", "InstallAce.sh");
				_webSocketProgress.MessageWithoutLocalizing("Please run the "+ scriptPath + " script to install the Ace by Daisy system on this Linux computer.  Do not use sudo to run this script: it already contains any needed sudo commands internally.");
			}
			request.Failed();
		}

		private void RefreshClient()
		{
			_webSocketServer.SendEvent(kWebSocketContext, kBookContentsMayHaveChanged);
		}
	}
}