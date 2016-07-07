﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using Bloom;
using Bloom.Book;
using Bloom.CLI;
using BloomTemp;
using NUnit.Framework;


namespace BloomTests.CLI
{
	[TestFixture]
	public class HydrateBookCommandTests
	{
		private HtmlDom _dom;
		private DataSet _dataSet;
		private string _originalHtmlPath;
		private string _eventualHtmlPath;
		private TemporaryFolder _testFolder;
		private TemporaryFolder _bookFolder;

		[SetUp]
		public void Setup()
		{
			_testFolder = new TemporaryFolder("hydration test");
			_bookFolder = new TemporaryFolder(_testFolder,"original name");
			_originalHtmlPath = _bookFolder.Combine("original name.html");
			File.WriteAllText(_originalHtmlPath,
				@"<html><head></head><body>
					<div id='bloomDataDiv'>
						<div data-book='bookTitle' lang='en'>
								mudmen
						</div>
						<div data-book='topic' lang='en'>
							Story Book
						</div>

						<div data-book='copyright' lang='*'>
							Copyright © 2016, Joe Author
						</div>

						<div data-book='licenseUrl' lang='*'>
							http://creativecommons.org/licenses/by/4.0/
						</div>

						<div data-book='originalAcknowledgments' lang='en'>
							Some Acknowledgments
						</div>
					</div>
					<div id ='firstPage' class='bloom-page A5Landscape'>1st page</div>
				</body></html>");

			//NOTE: At the moment, if the bookTitle of the selected vernacular language does not match
			//the name of the file and folder, the hydration process will rename the book's folder and file, 
			//just like opening it in Bloom does. At the moment, we set the name of the folder/file to be
			//the same as the title in the requested vernacular, so it isn't an issue. But further tests
			//could make it an issue. For now, these are the same:
			//_eventualHtmlPath = _testFolder.Combine("mudmen", "mudmen.htm");

			//decided that allowing a new name is just going to confuse the programs using this CLI, so
			//let's expect the program to NOT change the names for now.
			_eventualHtmlPath = _testFolder.Combine("original name", "original name.html");
		}

		[TearDown]
		public void TearDown()
		{
			_testFolder.Dispose();
		}

		[Test]
		public void BogusPath_Returns1()
		{
			var code = HydrateBookCommand.Handle(new HydrateParameters()
			{
				Path = "notAnywhere"
			});
			Assert.AreEqual(1, code);
		}

		[Test]
		public void PresetIsApp_A5LandscapeChangedToDevice16x9Landscape()
		{
			var code = HydrateBookCommand.Handle(new HydrateParameters()
			{
				Path = _bookFolder.FolderPath,
				Preset = "app",
				VernacularIsoCode = "en"
			});
			Assert.AreEqual(0, code, "Should return an exit code of 0, meaning it is happy.");
			var html = File.ReadAllText(_eventualHtmlPath);
			AssertThatXmlIn.File(_eventualHtmlPath).HasAtLeastOneMatchForXpath("//div[contains(@class,'bloom-page') and contains(@class,'Device16x9Landscape')]");
			Assert.That(!html.Contains("A5Landscape"));
		}

		/// <summary>
		/// Eventually we need to have the app preset investigate whether to use the video xmatter or
		/// the (at this time, non-existant) book-app xmatter. For now, we expect it to assume we have
		/// a multimedia book.
		/// </summary>
		[Test]
		public void PresetIsApp_XmatterSetToVideo()
		{
			var code = HydrateBookCommand.Handle(new HydrateParameters()
			{
				Path = _bookFolder.FolderPath,
				Preset = "app",
				VernacularIsoCode = "en"
			});
			Assert.AreEqual(0, code, "Should return an exit code of 0, meaning it is happy.");
			var html = File.ReadAllText(_eventualHtmlPath);
			Assert.That(html.Contains("Opening Screen"));
		}

		[Test]
		public void PresetIsApp_XMatterIsFilledIn()
		{
			var code = HydrateBookCommand.Handle(new HydrateParameters()
			{
				Path = _bookFolder.FolderPath,
				Preset = "app",
				VernacularIsoCode = "en"
			});
			Assert.AreEqual(0, code, "Should return an exit code of 0, meaning it is happy.");
			Debug.Write(File.ReadAllText(_eventualHtmlPath));
			var dom = XmlHtmlConverter.GetXmlDomFromHtml(File.ReadAllText(_eventualHtmlPath));

			AssertThatXmlIn.Dom(dom)
				.HasAtLeastOneMatchForXpath("//div[contains(@class,'bookTitle')]/div[contains(@class, 'bloom-editable') and contains(text(), 'mudmen')]");

			AssertThatXmlIn.Dom(dom)
				.HasSpecifiedNumberOfMatchesForXpath("//div[@data-derived='copyright' and contains(text(),'Joe Author')]", 1);

			AssertThatXmlIn.Dom(dom)
				.HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='originalAcknowledgments' and @lang='en' and contains(@class,'bloom-editable') and contains(text(),'Some Acknowledgments')]", 1);
		}

		[Test]
		public void PresetIsApp_StylesheetAreRelativePaths()
		{
			var code = HydrateBookCommand.Handle(new HydrateParameters()
			{
				Path = _bookFolder.FolderPath,
				Preset = "app",
				VernacularIsoCode = "en"
			});
			Assert.AreEqual(0, code, "Should return an exit code of 0, meaning it is happy.");
			Debug.Write(File.ReadAllText(_eventualHtmlPath));
			var dom = XmlHtmlConverter.GetXmlDomFromHtml(File.ReadAllText(_eventualHtmlPath));

			AssertThatXmlIn.Dom(dom)
				.HasSpecifiedNumberOfMatchesForXpath("//link[@href='basePage.css']",1);
			AssertThatXmlIn.Dom(dom)
				.HasSpecifiedNumberOfMatchesForXpath("//link[@href='Video-XMatter.css']", 1);
		}

		[Test]
		public void PresetIsApp_CreativeCommonsLicenseImageAdded()
		{
			var code = HydrateBookCommand.Handle(new HydrateParameters()
			{
				Path = _bookFolder.FolderPath,
				Preset = "app",
				VernacularIsoCode = "en"
			});
			Assert.That(File.Exists(Path.Combine(_eventualHtmlPath, "../license.png")));
		}

		[Test]
		public void SetsCorrectClassesForVernacularLanguage()
		{
			//TODO
		}

		[Test]
		public void SetsCorrectClassesForNationalLanguages()
		{
			//TODO
		}

		[Test]
		public void HasNoBloomPlayerScript_AddsOne()
		{
			var code = HydrateBookCommand.Handle(new HydrateParameters()
			{
				Path = _bookFolder.FolderPath,
				Preset = "app",
				VernacularIsoCode = "en"
			});
			AssertThatXmlIn.HtmlFile(_eventualHtmlPath)
				.HasSpecifiedNumberOfMatchesForXpath("//head/script[contains(@src,'bloomPlayer.js')]",1);
		}

		[Test]
		public void AlreadyBloomPlayerScript_DoesNotAddOne()
		{
			//TODO
		}
	}
}
