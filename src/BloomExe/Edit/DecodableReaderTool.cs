﻿using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Bloom.Collection;
using Bloom.Properties;
using SIL.IO;

namespace Bloom.Edit
{
	class DecodableReaderTool : ToolboxTool
	{
		public const string StaticToolId = "decodableReader"; // Avoid changing value; see ToolboxTool.JsonToolId
		public override string ToolId { get { return StaticToolId; } }

		internal static void CopyReaderToolsSettingsToWhereTheyBelong(string newlyAddedFolderOfThePack)
		{
			var destFolder = ProjectContext.GetBloomAppDataFolder();
			foreach (var readerSettingsFile in Directory.GetFiles(newlyAddedFolderOfThePack, ReaderToolsSettingsPrefix + "*.json")
				.Concat(Directory.GetFiles(newlyAddedFolderOfThePack,"ReaderToolsWords-*.json")))
			{
				try
				{
					RobustFile.Copy(readerSettingsFile, Path.Combine(destFolder, Path.GetFileName(readerSettingsFile)), true);
				}
				catch (IOException e)
				{
					// If we can't do it, we can't. Don't worry about it in production.
#if DEBUG
					Debug.Fail("Some file error copying reader settings");
#endif
				}
			}
		}

		public const string ReaderToolsSettingsPrefix = "ReaderToolsSettings-";

		/// <summary>
		/// The file (currently at a fixed location in every settings folder) where we store any settings
		/// related to Decodable and Leveled Readers.
		/// </summary>
		/// <param name="collectionSettings"></param>
		public static string GetReaderToolsSettingsFilePath(CollectionSettings collectionSettings)
		{
			return Path.Combine(Path.GetDirectoryName(collectionSettings.SettingsFilePath),
				DecodableReaderTool.ReaderToolsSettingsPrefix + collectionSettings.Language1Iso639Code + ".json");
		}

		/// <summary>
		/// If the collection has no reader tools at all, or if ones that came with the program are newer,
		/// copy the ones that came with the program.
		/// This is language-dependent, we'll typically only overwrite settings for an English collection.
		/// </summary>
		/// <param name="settings"></param>
		public static void CopyRelevantNewReaderSettings(CollectionSettings settings)
		{
			var readerToolsPath = GetReaderToolsSettingsFilePath(settings);
			var bloomFolder = ProjectContext.GetBloomAppDataFolder();
			var newReaderTools = Path.Combine(bloomFolder, Path.GetFileName(readerToolsPath));
			if (!RobustFile.Exists(newReaderTools))
				return;
			// The GetLastWriteTime calls should stay RobustFile.GetLastWriteTime in branches after 4.1
			if (RobustFile.Exists(readerToolsPath) && File.GetLastWriteTime(readerToolsPath) > File.GetLastWriteTime(newReaderTools))
				return; // don't overwrite newer existing settings?
			RobustFile.Copy(newReaderTools, readerToolsPath, true);
		}

		/// <remarks>About this file (e.g. ReaderToolsWords-en.json).
		/// In one sense, it is a confusing name because if you look in it, it's much more than words (e.g. orthography).
		/// On the other hand, if I (JH) am reading things correctly, only the sample word aspect of this is used by Bloom.
		/// See the API handler for more remarks on it.
		/// </remarks>
		public const string kSynphonyLanguageDataFileNameFormat = "ReaderToolsWords-{0}.json";

		private const string StagePrefix = "stage:";

		public override void SaveDefaultState()
		{
			base.SaveDefaultState();
			// We expect the state to be something like "stage:6;sort:byLength"
			// Enhance: someday we'd like to make the state json.
			if (State == null)
				return;

			var stageString = State.Split(';')[0].Split(':')[1];
			int stage;
			if (Int32.TryParse(stageString, out stage))
			{
				Settings.Default.CurrentStage = stage;
				Settings.Default.Save();
			}
		}

		public override string DefaultState()
		{
			// Currently we are not saving and restoring the sort method.
			// However the default MUST provide one, since the JS is definitely expecting
			// a string with two settings separated by semi-colon; so we just put the
			// general default here. Unfortunately that duplicates knowledge that
			// must be elsewhere also but I'm not sure how to avoid it.
			return StagePrefix + Settings.Default.CurrentStage + @";sort:alphabetic";
		}
	}
}
