﻿using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using Bloom;
using Bloom.ImageProcessing;
using Bloom.web;
using NUnit.Framework;
using Palaso.IO;
using Palaso.TestUtilities;

namespace BloomTests.RuntimeImageProcessing
{
	[TestFixture]
	public class ImageServerTests
	{
		private TemporaryFolder _folder;

		[SetUp]
		public void Setup()
		{
			_folder = new TemporaryFolder("ImageServerTests");
		}

		[TearDown]
		public void TearDown()
		{
			_folder.Dispose();
		}

		[Test]
		public void GetMissingImage_ReturnsError()
		{
			using (var server = CreateImageServer())
			using (var file = MakeTempImage())
			{
				var transaction = new PretendRequestInfo(ServerBase.PathEndingInSlash + "abc.png", false);
				server.MakeReply(transaction);
				Assert.AreEqual(404, transaction.StatusCode);
			}
		}

		[Test]
		public void GetSmallImage_ReturnsSameSizeImage()
		{
			using (var server = CreateImageServer())
			using (var file = MakeTempImage())
			{
				var transaction = new PretendRequestInfo(ServerBase.PathEndingInSlash + file.Path, false);
				server.MakeReply(transaction);
				Assert.IsTrue(transaction.ReplyImagePath.Contains(".png"));
			}
		}

		[Test]
		public void GetFileName_FileNotExist_ReturnsCorrectName()
		{
			var test = "c:/asdfg/test1.css";
			var fileName = Path.GetFileName(test);
			Assert.AreEqual("test1.css", fileName);

			test = "/one/two/test2.css";
			fileName = Path.GetFileName(test);
			Assert.AreEqual("test2.css", fileName);

			test = "test3.css";
			fileName = Path.GetFileName(test);
			Assert.AreEqual("test3.css", fileName);

			test = "test4";
			fileName = Path.GetFileName(test);
			Assert.AreEqual("test4", fileName);
		}

		private ImageServer CreateImageServer()
		{
			return new ImageServer(new RuntimeImageProcessor(new BookRenamedEvent()));
		}
		private TempFile MakeTempImage()
		{
			var file = TempFile.WithExtension(".png");
			File.Delete(file.Path);
			using(var x = new Bitmap(100,100))
			{
				x.Save(file.Path, ImageFormat.Png);
			}
			return file;
		}
	}

}
