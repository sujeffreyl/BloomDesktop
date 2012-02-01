using System;
using System.Collections.Generic;
using System.Drawing;
using System.Xml;
using Palaso.Code;
using Palaso.Xml;

namespace Bloom.Book
{
	public interface IPage
	{
		string Id { get; }
		string Caption { get; }
		Image Thumbnail { get; }
		string XPathToDiv { get; }
		XmlElement GetDivNodeForThisPage();
		bool Required { get; }
		bool CanRelocate { get;}
		Book Book { get; set; }
	}

	public class Page : IPage
	{
		private readonly string _id;
		private readonly Func<IPage, Image> _getThumbnail;
		private readonly Func<IPage, XmlElement> _getDivNodeForThisPageMethod;
		private List<string> _classes;
		private List<string> _tags;

		public Page(Book book, XmlElement sourcePage,  string caption, /*Func<IPage, Image> getThumbnail,*/ Func<IPage, XmlElement> getDivNodeForThisPageMethod)
		{
			_id = sourcePage.Attributes["id"].Value;
			//_getThumbnail = getThumbnail;
			Guard.AgainstNull(book,"Book");
			Book = book;
			_getDivNodeForThisPageMethod = getDivNodeForThisPageMethod;
			Caption = caption;
			ReadClasses(sourcePage);
			ReadPageTags(sourcePage);
		}

		private void ReadClasses(XmlElement sourcePage)
		{
			_classes = new List<string>();
			var classesString = sourcePage.GetAttribute("class");
			if (!string.IsNullOrEmpty(classesString))
			{
				_classes.AddRange(classesString.Split(new char[]{' '},StringSplitOptions.RemoveEmptyEntries));
			}
		}
		private void ReadPageTags(XmlElement sourcePage)
		{
			_tags = new List<string>();
			var tags = sourcePage.GetAttribute("data-page");
			if (!string.IsNullOrEmpty(tags))
			{
				_tags.AddRange(tags.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
			}
		}

		public bool Required
		{
			get { return _tags.Contains("required"); }
		}

		public bool CanRelocate
		{
			//review: for now, we're conflating "required" with "can't move"
			get { return !Required; }
		}

		public Book Book { get; set; }

		public string Id{get { return _id; }}

		public string Caption { get; private set; }
		public Image Thumbnail { get
		{ return _getThumbnail(this); } }

		public string XPathToDiv
		{
			get { return "/html/body/div[@id='"+_id+"']";}
		}

		public XmlElement GetDivNodeForThisPage()
		{
			return _getDivNodeForThisPageMethod(this);
		}


		public static string GetPageSelectorXPath(XmlDocument pageDom)
		{
//    		var id = pageDom.SelectSingleNodeHonoringDefaultNS("/html/body/div").Attributes["id"].Value;
			var id = pageDom.SelectSingleNode("/html/body/div").Attributes["id"].Value;
			return string.Format("/html/body/div[@id='{0}']", id);
		}
	}
}