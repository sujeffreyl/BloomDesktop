// listen for messages sent to this page (from other iframes)
window.addEventListener('message', processExternalMessage, false);
/**
 * Respond to messages from other iframes
 * @param {Event} event
 */
function processExternalMessage(event) {

    var params = event.data.split("\n");

    switch(params[0]) {

        case 'Qtips': // request from accordion to add qtips to marked-up spans
            // q-tips; first 3 are for decodable, last for leveled; could make separate messages.
            var editableElements = $(".bloom-content1");
            editableElements.find('span.' + $.cssSightWord()).each(function() {
                $(this).qtip({ content: 'Sight word' });
            });

            editableElements.find('span.' + $.cssWordNotFound()).each(function() {
                $(this).qtip({ content: 'This word is not decodable in this stage.' });
            });

            // we're considering dropping this entirely
            // We are disabling the "Possible Word" feature at this time.
            //editableElements.find('span.' + $.cssPossibleWord()).each(function() {
            //    $(this).qtip({ content: 'This word is decodable in this stage, but is not part of the collected list of words.' });
            //});

            editableElements.find('span.' + $.cssSentenceTooLong()).each(function() {
                $(this).qtip({ content: 'This sentence is too long for this level.' });
            });
            return;
    }
}

/**
 * Fires an event for C# to handle
 * @param {String} eventName
 * @param {String} eventData
 */
function fireCSharpEditEvent(eventName, eventData) {

    var event = new MessageEvent(eventName, {'view' : window, 'bubbles' : true, 'cancelable' : true, 'data' : eventData});
    document.dispatchEvent(event);
}

$.fn.CenterVerticallyInParent = function() {
    return this.each(function(i) {
        var ah = $(this).height();
        var ph = $(this).parent().height();
        var mh = Math.ceil((ph - ah) / 2);
        $(this).css('margin-top', mh);

        ///There is a bug in wkhtmltopdf where it determines the height of these incorrectly, causing, in a multlingual situation, the 1st text box to hog up all the room and
        //push the other guys off the page. So the hack solution of the moment is to remember the correct height here, in gecko-land, and use it over there to set the max-height.
        //See bloomPreview.SetMaxHeightForHtmlToPDFBug()
        $(this).children().each(function(){
            var h= $(this).height();
            $(this).attr('data-firefoxHeight', h);
        });
    });
};


function isBrOrWhitespace(node) {
    return node && ( (node.nodeType == 1 && node.nodeName.toLowerCase() == "br") ||
           (node.nodeType == 3 && /^\s*$/.test(node.nodeValue) ) );
}

function removeTrailingWhiteSpace(node) {
    if (node && node.nodeType == 3 && node.nodeValue) {
        // Removes one or more (+) whitespace (\s) at the end ($), across multiple lines (m)
        node.nodeValue = node.nodeValue.replace(/\s+$/m, "");
    }
}

function TrimTrailingLineBreaksInDivs(node) {
//    while ( isBrOrWhitespace(node.firstChild) ) {
//        node.removeChild(node.firstChild);
//    }
    while ( isBrOrWhitespace(node.lastChild) ) {
        node.removeChild(node.lastChild);
    }
    // Without this, FF can display a space which isn't a space due to a trailing \r\n
    removeTrailingWhiteSpace(node.lastChild);
}

function CanChangeBookLicense() {

    // First, need to look in .bloomCollection file for <IsSourceCollection> value
    // if 'true', return true.
    var isSource = GetSettings().isSourceCollection;
    if (isSource && isSource.toLowerCase() == 'true') // comes out as capitalized string, if it's there
        return true;

    // meta[@name='lockedDownAsShell' and @content='true'], if exists, return false
    var lockedAsShell = $(document).find('meta[name="lockedDownAsShell"]');
    if (lockedAsShell.length > 0 && lockedAsShell.attr('content').toLowerCase() == 'true')
        return false;
    // meta[@name='canChangeLicense'] and @content='false'], if exists, return false
    var canChange = $(document).find('meta[name="canChangeLicense"]');
    if (canChange.length > 0 && canChange.attr('content').toLowerCase() == 'false')
        return false;

    // Otherwise return true
    return true;
}

//show those bubbles if the item is empty, or if it's not empty, then if it is in focus OR the mouse is over the item
function MakeHelpBubble(targetElement, elementWithBubbleAttributes) {

    var target = $(targetElement);
    var source = $(elementWithBubbleAttributes);

    if (target.css('display') === 'none')
        return; //don't put tips if they can't see it.

    if (target.css('border-bottom-color') === 'transparent')
        return; //don't put tips if they can't edit it. That's just confusing

    var theClasses = 'ui-tooltip-shadow ui-tooltip-plain';

    var pos = {
            at: 'right center',
        my: 'left center',
        viewport: $(window),
        adjust: { method: 'none' }
        };

    if (target.hasClass('coverBottomBookTopic'))
        pos.adjust = { y: -20 };

    //temporarily disabling this; the problem is that its more natural to put the hint on enclosing 'translationgroup' element, but those elements are *never* empty.
    //maybe we could have this logic, but change this logic so that for all items within a translation group, they get their a hint from a parent, and then use this isempty logic
    //at the moment, the logic is all around whoever has the data-hint
    //var shouldShowAlways = $(this).is(':empty'); //if it was empty when we drew the page, keep the tooltip there
    var shouldShowAlways = true;
    var hideEvents = shouldShowAlways ? false : 'focusout mouseleave';

    // get the default text/stringId
    var whatToSay = target.attr('data-hint');
    if (!whatToSay) whatToSay = source.attr('data-hint');
    if (!whatToSay) whatToSay = source.text();

    // no empty bubbles
    if (!whatToSay) return;

    // determine onFocusOnly
    var onFocusOnly = whatToSay.startsWith('*');
    onFocusOnly = onFocusOnly || source.hasClass('bloom-showOnlyWhenTargetHasFocus') || checkMightCauseHorizontallyOverlappingBubbles(targetElement);

    // get the localized string
    if (whatToSay.startsWith('*')) whatToSay = whatToSay.substr(1);
    whatToSay = localizationManager.getLocalizedHint(whatToSay, target);

    var functionCall = source.data("functiononhintclick");
    if (functionCall) {
        if (functionCall === 'bookMetadataEditor' && !CanChangeBookLicense())
            return;
        shouldShowAlways = true;

        if (functionCall.indexOf('(') > 0)
            functionCall = 'javascript:' + functionCall + ';';

        whatToSay = "<a href='" + functionCall + "'>" + whatToSay + "</a>";
        hideEvents = false; // Don't specify a hide event...
    }

    if (onFocusOnly) {
        shouldShowAlways = false;
        hideEvents = 'focusout mouseleave';
    }

    target.qtip({
        content: whatToSay,
        position: pos,
        show: {
            event: 'focusin mouseenter',
            ready: shouldShowAlways //would rather have this kind of dynamic thing, but it isn't right: function(){$(this).is(':empty')}//
        }
       , hide: {
           event: hideEvents
       },
        style: {
            classes: theClasses
        }
    });
}

function Cleanup() {

    // for stuff bloom introduces, just use this "bloom-ui" class to have it removed
    $(".bloom-ui").each(function() {
        $(this).remove();
    });

    // remove the div's which qtip makes for the tips themselves
    $("div.qtip").each(function() {
        $(this).remove();
    });

    // remove the attributes qtips adds to the things being annotated
    $("*[aria-describedby]").each(function() {
        $(this).removeAttr("aria-describedby");
    });
    $("*[ariasecondary-describedby]").each(function() {
        $(this).removeAttr("ariasecondary-describedby");
    });
    $("*.editTimeOnly").remove();
    $("*.dragHandle").remove();
    $("*").removeAttr("data-easytabs");

    $("div.ui-resizable-handle").remove();
    $('div, figure').each(function() {
        $(this).removeClass('ui-draggable');
        $(this).removeClass('ui-resizable');
        $(this).removeClass('hoverUp');
    });

    $('button').each(function () {
            $(this).remove();
    });


  $('div.bloom-editable').each( function() {
    TrimTrailingLineBreaksInDivs(this);
    });

  $('.bloom-imageContainer').css('opacity', '');//comes in on img containers from an old version of myimgscale, and is a major problem if the image is missing
    $('.bloom-imageContainer').css('overflow', '');//review: also comes form myimgscale; is it a problem?

    cleanupOrigami();
}

 //Make a toolbox off to the side (implemented using qtip), with elements that can be dragged
 //onto the page
function AddToolbox(container){
    $(container).find('div.bloom-page.bloom-enablePageCustomization').each(function () {
        $(this).find('.marginBox').droppable({
            hoverClass: "ui-state-hover",
            accept: function () { return true; },
            drop: function (event, ui) {
                //is it being dragged in from a toolbox, or just moved around inside the page?
                if ($(ui.draggable).hasClass('widgetInToolbox')) {

                    //review: since we already did a clone during the tearoff, why clone again?
                    var $x = $($(ui.draggable).clone()[0]);
                    // $x.text("");

                    //we need different behavior when it is in the toolbox vs. once it is live
                    $x.attr("class", $x.data("classesafterdrop"));
                    $x.removeAttr("classesafterdrop");

                    if ($x.hasClass('bloom-imageContainer')) {
                        SetupImageContainer($x);
                    }

                    //review: this find() implies that the draggable thing isn't necesarily the widgetInToolbox. Why not?
//                    $(this).find('.widgetInToolbox')
//                            .removeAttr("style")
//                            .draggable({ containment: "parent" })
//                            .removeClass("widgetInToolbox")
//                            .SetupResizableElement(this)
                    //                            .SetupDeletable(this);
                    $x.removeAttr("style");
                    $x.draggable({ containment: "parent" });
                    $x.removeClass("widgetInToolbox");
                    SetupResizableElement($x);
                    SetupDeletable($x);

                    $(this).append($x);
                }
            }
        });
        var lang1ISO = GetSettings().languageForNewTextBoxes;
        var heading1CenteredWidget = '<div class="heading1-style centered widgetInToolbox"  data-classesafterdrop="bloom-translationGroup heading1-style centered bloom-resizable bloom-deletable bloom-draggable"><div data-classesafterdrop="bloom-editable bloom-content1" lang="' + lang1ISO + '">Heading 1 Centered</div></div>';
        var heading2LeftWidget = '<div class="heading2-style widgetInToolbox"  data-classesafterdrop="bloom-translationGroup heading2-style  bloom-resizable bloom-deletable bloom-draggable"><div data-classesafterdrop="bloom-editable bloom-content1" lang="' + lang1ISO + '">Heading 2, Left</div></div>';
        var fieldWidget = '<div class="widgetInToolbox" data-classesafterdrop="bloom-translationGroup bloom-resizable bloom-deletable bloom-draggable"><div data-classesafterdrop="bloom-editable bloom-content1" lang="' + lang1ISO + '"> A block of normal text.</div></div>';
        // old one: var imageWidget = '<div class="bloom-imageContainer bloom-resizable bloom-draggable  bloom-deletable widgetInToolbox"><img src="placeHolder.png"></div>';
        var imageWidget = '<div class="widgetInToolbox " data-classesafterdrop="bloom-imageContainer  bloom-resizable bloom-draggable  bloom-deletable"><img src="placeHolder.png"></div>';

        var toolbox = $(this).parent().append("<div id='toolbox'><h3>Page Elements</h3><ul class='toolbox'><li>" + heading1CenteredWidget + "</li><li>" + heading2LeftWidget + "</li><li>" + fieldWidget + "</li><li>" + imageWidget + "</li></ul></div>");


        toolbox.find('.widgetInToolbox').each(function () {
            $(this).draggable({
                //note: this is just used for drawing what you drag around..
                //it isn't what the droppable is actually given. For that, look in the 'drop' item of the droppable() call above.
                helper: function(event) {
                    var tearOff = $(this).clone(); //.removeClass('widgetInToolbox');//by removing this, we show it with the actual size it will be when dropped
                    return tearOff;
                }
            });
        });
        $(this).qtipSecondary({
            content: "<div id='experimentNotice'><img src='/bloom/images/experiment.png'/>This is an experimental prototype of template-making within Bloom itself. Much more work is needed before it is ready for real work, so don't bother reporting problems with it yet. The Trello board is <a href='https://trello.com/board/bloom-custom-template-dev/4fb2501b34909fbe417a7b7d'>here</a></b></div>",
            show: { ready: true },
            hide: false,
            position: {
                at: 'right top',
                my: 'left top'
            },
            style: {
                classes: 'ui-tooltip-red',
                tip: { corner: false }
            }
        });
    })
}


function AddExperimentalNotice(element) {
    $(element).qtipSecondary({
        content: "<div id='experimentNotice'><img src='/bloom/images/experiment.png'/>This page is an experimental prototype which may have many problems, for which we apologize.<div/>"
                         , show: { ready: true }
                         , hide: false
                         , position: { at: 'right top',
                             my: 'left top'
                         },
        style: { classes: 'ui-tooltip-red',
            tip: { corner: false }
        }
    });
}

function GetStyleClassFromElement(element) {
    var c = $(element).attr("class");
    if (!c)
        c = "";
    var classes = c.split(' ');

    for (var i = 0; i < classes.length; i++) {
        if (classes[i].indexOf('-style') > 0) {
            return classes[i];
        }
    }
    return null;
}

//:empty is not quite enough... we don't want to show bubbles if all there is is an empty paragraph
jQuery.expr[':'].hasNoText = function (obj) {
    return jQuery.trim(jQuery(obj).text()).length == 0;
};

 //Sets up the (currently yellow) qtip bubbles that give you the contents of the box in the source languages
function MakeSourceTextDivForGroup(group) {

    var divForBubble = $(group).clone();
    $(divForBubble).removeAttr('style');

    //make the source texts in the bubble read-only and remove any user font size adjustments
    $(divForBubble).find("textarea, div").each(function() {
        $(this).attr("readonly", "readonly");
        $(this).removeClass('bloom-editable');
        $(this).removeClass('overflow'); // don't want red in source text bubbles
        $(this).attr("contenteditable", "false");
        var styleClass = GetStyleClassFromElement(this);
        if (styleClass)
            $(this).removeClass(styleClass);
        $(this).addClass("source-text");
    });

    var vernacularLang = localizationManager.getVernacularLang();

    $(divForBubble).removeClass(); //remove them all
    $(divForBubble).addClass("ui-sourceTextsForBubble");
    //don't want empty items in the bubble
    $(divForBubble).find("textarea:empty, div:hasNoText").each(function() {
        $(this).remove();
    });

    //don't want the vernacular or languages in use for bilingual/trilingual boxes to be shown in the bubble
    $(divForBubble).find("*.bloom-content1, *.bloom-content2, *.bloom-content3").each(function () {
        $(this).remove();
    });

    //in case some formatting didn't get cleaned up
    StyleEditor.CleanupElement(divForBubble);

    //if there are no languages to show in the bubble, bail out now
    if ($(divForBubble).find("textarea, div").length == 0)
        return;

/* removed june 12 2013 was dying with new jquery as this was Window and that had no OwnerDocument    $(this).after(divForBubble);*/

    var selectorOfDefaultTab="li:first-child";

    //make the li's for the source text elements in this new div, which will later move to a tabbed bubble
    $(divForBubble).each(function () {
        $(this).prepend('<ul class="editTimeOnly bloom-ui"></ul>');
        var list = $(this).find('ul');
        //nb: Jan 2012: we modified "jquery.easytabs.js" to target @lang attributes, rather than ids.  If that change gets lost,
        //it's just a one-line change.
        var items = $(this).find("textarea, div");
        items.sort(function(a, b) {
            var keyA = $(a).attr('lang');
            var keyB = $(b).attr('lang');
            if (keyA === vernacularLang)
                return -1;
            if (keyB === vernacularLang)
                return 1;
            if (keyA < keyB)
                return -1;
            if (keyA > keyB)
                return 1;
            return 0;
        });
        var shellEditingMode = false;
        items.each(function() {
            var iso = $(this).attr('lang');
            if (iso) {
                var languageName = localizationManager.getLanguageName(iso);
                if (!languageName)
                    languageName = iso;
                var shouldShowOnPage = (iso === vernacularLang) /* could change that to 'bloom-content1' */ || $(this).hasClass('bloom-contentNational1') || $(this).hasClass('bloom-contentNational2') || $(this).hasClass('bloom-content2') || $(this).hasClass('bloom-content3');

                // in translation mode, don't include the vernacular in the tabs, because the tabs are being moved to the bubble
                if (iso !== "z" && (shellEditingMode || !shouldShowOnPage)) {

                    $(list).append('<li id="' + iso + '"><a class="sourceTextTab" href="#' + iso + '">' + languageName + '</a></li>');
                    if (iso === GetSettings().defaultSourceLanguage) {
                        selectorOfDefaultTab = "li#" + iso; //selectorOfDefaultTab="li:#"+iso; this worked in jquery 1.4
                    }
                }
            }
        });
    });

    //now turn that new div into a set of tabs
    // Review: as of 9 May 2014 the tab links have turned into bulleted links
    if ($(divForBubble).find("li").length > 0) {
        $(divForBubble).easytabs({
            animate: false,
            defaultTab: selectorOfDefaultTab
        });
//        $(divForBubble).bind('easytabs:after', function(event, tab, panel, settings){
//            alert(panel.selector)
//        });

  }
  else {
    $(divForBubble).remove();//no tabs, so hide the bubble
    return;
    }

    var showEvents = false;
    var hideEvents = false;
    var shouldShowAlways = true;


    if(checkMightCauseHorizontallyOverlappingBubbles(group)) {
        showEvents = 'focusin';
        hideEvents = 'focusout';
        shouldShowAlways = false;
    }

    // turn that tab thing into a bubble, and attach it to the original div ("group")
    $(group).each(function () {
      // var targetHeight = Math.max(55, $(this).height()); // This ensures we get at least one line of the source text!

      $(this).qtip({
          position: {
                my: 'left top',
                at: 'right top',
              adjust: {
                  x: 10,
                  y: 0
              }
          },
          content: $(divForBubble),

          show: {
              event: showEvents,
              ready: shouldShowAlways
          },
          //events: {
          //    render: function (event, api) {
          //        api.elements.content.height(targetHeight);
          //    }
          //},
          style: {
                tip: {
                    corner: true,
                    width: 10,
                    height: 10
                },
              classes: 'ui-tooltip-green ui-tooltip-rounded uibloomSourceTextsBubble'
          },
          hide: hideEvents
      });
  });
}

function checkMightCauseHorizontallyOverlappingBubbles(element) {
    //we can't actually know for sure if overlapping would happen, but
    //we can be very conservative and say that if the text
    //box isn't taking up the whole width, it *might* cause
    //an overlap
    var availableWidth = $(element).closest(".marginBox").width();
    var kTolerancePixels = 10; //if the box is just a tiny bit smaller, there's not going to be anything to overlap
    return $(element).width() < (availableWidth - kTolerancePixels);
}

//add a delete button which shows up when you hover
function SetupDeletable(containerDiv) {
    $(containerDiv).mouseenter(
        function () {
            var button = $("<button class='deleteButton smallImageButton' title='Delete'></button>");
            $(button).click(function(){
                $(containerDiv).remove()});
            $(this).prepend(button);
        })
        .mouseleave(function () {
            $(this).find(".deleteButton").each(function () {
                $(this).remove()
            });
        });

    return $(containerDiv);
}

//Bloom "imageContainer"s are <div>'s with wrap an <img>, and automatically proportionally resize
//the img to fit the available space
function SetupImageContainer(containerDiv) {
    $(containerDiv).mouseenter(function () {
        var buttonModifier = "largeImageButton";
        if ($(this).height() < 95) {
            buttonModifier = 'smallImageButton';
        }
        $(this).prepend('<button class="pasteImageButton ' + buttonModifier + '" title="' + localizationManager.getText("EditTab.Image.PasteImage") + '"></button>');
        $(this).prepend('<button class="changeImageButton ' + buttonModifier + '" title="' + localizationManager.getText("EditTab.Image.ChangeImage") + '"></button>');

        var img = $(this).find('img');
        if (CreditsAreRelevantForImage(img)) {
            $(this).prepend('<button class="editMetadataButton ' + buttonModifier + '" title="' + localizationManager.getText("EditTab.Image.EditMetadata") + '"></button>');
        }

        $(this).addClass('hoverUp');
    })
    .mouseleave(function () {
        $(this).removeClass('hoverUp');
        $(this).find(".changeImageButton").each(function () {
            $(this).remove()
        });
        $(this).find(".pasteImageButton").each(function () {
            $(this).remove()
        });
        $(this).find(".editMetadataButton").each(function () {
            if (!$(this).hasClass('imgMetadataProblem')) {
                $(this).remove()
            }
        });
    });
}

function CreditsAreRelevantForImage(img) {
    return $(img).attr('src').toLowerCase().indexOf('placeholder') == -1; //don't offer to edit placeholder credits
}

//While the actual metadata is embedded in the images (Bloom/palaso does that), Bloom sticks some metadata in data-* attributes
// so that we can easily & quickly get to the here.
function SetOverlayForImagesWithoutMetadata(container) {
    $(container).find(".bloom-imageContainer").each(function () {
        var img = $(this).find('img');
        if (!CreditsAreRelevantForImage(img)) {
           return;
        }
        var container = $(this);

        UpdateOverlay(container, img);

        //and if the bloom program changes these values (i.e. the user changes them using bloom), I
        //haven't figured out a way (apart from polling) to know that. So for now I'm using a hack
        //where Bloom calls click() on the image when it wants an update, and we detect that here.
        $(img).click(function () {
            UpdateOverlay(container, img);
        });
    });
}

function UpdateOverlay(container, img) {

    $(container).find(".imgMetadataProblem").each(function () {
        $(this).remove()
    });

    //review: should we also require copyright, illustrator, etc? In many contexts the id of the work-for-hire illustrator isn't available
    var copyright = $(img).attr('data-copyright');
    if (!copyright || copyright.length == 0) {

        var buttonModifier = "largeImageButton";
        if ($(container).height() < 80) {
            buttonModifier = 'smallImageButton';
        }

        $(container).prepend("<button class='editMetadataButton imgMetadataProblem "+buttonModifier+"' title='Image is missing information on Credits, Copyright, or License'></button>");
    }
}

// Instead of "missing", we want to show it in the right ui language. We also want the text
// to indicate that it might not be missing, just didn't load (this happens on slow machines)
// TODO: internationalize
function SetAlternateTextOnImages(element) {
    if ($(element).attr('src').length > 0) { //don't show this on the empty license image when we don't know the license yet
        var nameWithoutQueryString = $(element).attr('src').split("?")[0];
        $(element).attr('alt', 'This picture, ' + nameWithoutQueryString + ', is missing or was loading too slowly.');
    } else {
        $(element).attr('alt', '');//don't be tempted to show something like a '?' unless you fix the result when you have a custom book license on top of that '?'
    }
}

function SetupResizableElement(element) {
    $(element).mouseenter(
        function () {
            $(this).addClass("ui-mouseOver")
        }).mouseleave(function () {
            $(this).removeClass("ui-mouseOver")
        });
    var childImgContainer = $(element).find(".bloom-imageContainer");
    // A Picture Dictionary Word-And-Image
    if ($(childImgContainer).length > 0) {
        /* The case here is that the thing with this class actually has an
         inner image, as is the case for the Picture Dictionary.
         The key, non-obvious, difficult requirement is keeping the text below
         a picture dictionary item centered underneath the image.  I'd be
         surprised if this wasn't possible in CSS, but I'm not expert enough.
         So, I switched from having the image container be resizable, to having the
         whole div (image+headwords) be resizable, then use the "alsoResize"
         parameter to make the imageContainer resize.  Then, in order to make
         the image resize in real-time as you're dragging, I use the "resize"
         event to scale the image up proportionally (and centered) inside the
         newly resized container.
         */
        var img = $(childImgContainer).find("img");
        $(element).resizable({handles:'nw, ne, sw, se',
            containment: "parent",
            alsoResize:childImgContainer,
           resize:function (event, ui) {
                img.scaleImage({scale:"fit"})
            }});
        return $(element);
    }
    //An Image Container div (which must have an inner <img>
    else if ($(element).hasClass('bloom-imageContainer')) {
        var img = $(element).find("img");
        $(element).resizable({handles:'nw, ne, sw, se',
            containment: "parent",
            resize:function (event, ui) {
                img.scaleImage({scale:"fit"})
            }});
    }
    // some other kind of resizable
    else {
        $(element).resizable({
            handles:'nw, ne, sw, se',
            containment: "parent",
             stop: ResizeUsingPercentages,
            start: function(e,ui){
               if($(ui.element).css('top')=='0px' && $(ui.element).css('left')=='0px'){
                   $(ui.element).data('doRestoreRelativePosition', 'true');
               }
            }
        });
    }
}

//jquery resizable normally uses pixels. This makes it use percentages, which are mor robust across page size/orientation changes
function ResizeUsingPercentages(e,ui){
    var parent = ui.element.parent();
    ui.element.css({
        width: ui.element.width()/parent.width()*100+"%",
        height: ui.element.height()/parent.height()*100+"%"
    });

    //after any resize jquery adds an absolute position, which we don't want unless the user has resized
    //so this removes it, unless we previously noted that the user had moved it
    if($(ui.element).data('doRestoreRelativePosition'))
    {
        ui.element.css({
            position: '',
            top: '',
            left: ''
        });
    }
    $(ui.element).removeData('hadPreviouslyBeenRelocated');
}

// Actual testable determination of overflow or not
jQuery.fn.IsOverflowing = function () {
    var element = this[0];
    // Ignore Topic divs as they are chosen from a list
    if (element.hasAttribute('data-book') && element.getAttribute('data-book') == "topic") {
        return false;
    }
    // We want to prevent an inner div from expanding past the borders set by any containing marginBox class.
    var marginBoxParent = $(element).parents('.marginBox');
    var parentBottom;
    if(marginBoxParent && marginBoxParent.length > 0)
        parentBottom = $(marginBoxParent[0]).offset().top + $(marginBoxParent[0]).outerHeight(true);
    else
        parentBottom = 999999;
    var elemTop = parseInt($(element).offset().top);
    var elemBottom = elemTop + $(element).outerHeight(false);
    // console.log("Offset top: " + elemTop + " Outer Height: " + $(element).outerHeight(false));
    // If css has "overflow: visible;", scrollHeight is always 2 greater than clientHeight.
    // This is because of the thin grey border on a focused input box.
    // In fact, the focused grey border causes the same problem in detecting the bottom of a marginBox
    // so we'll apply the same 'fudge' factor to both comparisons.
    var focusedBorderFudgeFactor = 2;

    //The "basic book" template has a "Just Text" page which does some weird things to get vertically-centered
    //text. I don't know why, but this makes the clientHeight 2 pixels larger than the scrollHeight once it
    //is beyond its minimum height. We can detect that we're using this because it has this "firefoxHeight" data
    //element. This problem also shows up (and is detectable the same way) in Big Book. Except it turns out the
    //number of pixels to fudge is related to the point size. I think at base it's a preferred line spacing issue.
    var growFromCenterVerticalFudgeFactor =0;
    if($(element).data('firefoxheight')){
        var fontSizeRemnant = GetEditor().GetCalculatedFontSizeInPoints($(element)) - 22;
        if (fontSizeRemnant > 0) {
            growFromCenterVerticalFudgeFactor = (fontSizeRemnant / 5) + 1;
        }
    }

    //in the Picture Dictionary template, all words have a scrollheight that is 3 greater than the client height.
    //In the Headers of the Term Intro of the SHRP C1 P3 Pupil's book, scrollHeight = clientHeight + 6!!! Sigh.
    // the focussedBorderFudgeFactor takes care of 2 pixels, this adds one more.
    var shortBoxFudgeFactor = 4;

    //console.log('s='+element.scrollHeight+' c='+element.clientHeight);

    //
    return  element.scrollHeight > element.clientHeight + focusedBorderFudgeFactor + growFromCenterVerticalFudgeFactor + shortBoxFudgeFactor ||
            element.scrollWidth > element.clientWidth + focusedBorderFudgeFactor ||
            elemBottom > parentBottom + focusedBorderFudgeFactor;
};

// Checks for overflow and adds/removes the proper class
// N.B. This function is specifically designed to be called from within AddOverflowHandler()
function MarkOverflowInternal(box) {
    var $this = $(box);
    if ($this.IsOverflowing()) {
        $this.addClass('overflow');
        $this.closest('.bloom-page').addClass('pageOverflows');
    } else {
        $this.removeClass('overflow');
        RemovePageOverflowIfAppropriate($this.closest('.bloom-page'));

        //now, thing is, while the text may fit in our box, our box may not fit our parent. Or grandparent, etc.
        //It could be that we could just do this on up the hiearchy? For now, here's the case we know is important,
        // in the Origami pages, where the space allocated could be too small.
        var splitterParents = $this.parents('.split-pane-component-inner');
        if (splitterParents.length != 0) {
            MarkOverflowInternal(splitterParents[0]);
        }
    } // If it's not here, this won't hurt anything.
}

// Make sure there are no boxes with class 'overflow' on the page before removing
// the page-level overflow marker 'pageOverflows'
function RemovePageOverflowIfAppropriate(page) {
    var $page = $(page);
    if (!$page.find('.overflow').length)
        $page.removeClass('pageOverflows');
}

// When a div is overfull,
// we add the overflow class and it gets a red background or something
function AddOverflowHandler(container) {
    var queryElementsThatCanOverflow = ".bloom-editable, .split-pane-component-inner, textarea";

    //first, check to see if the stylesheet is going to give us overflow even for a single character:
    $(container).find(".bloom-editable").each(function (e) {
        var lineHeight = parseInt($(this).css("line-height"), 10);
        var minHeight = parseInt($(this).css("min-height"), 10);
        if (lineHeight > minHeight) {
            $(this).addClass('Layout-Problem-Detected');
            $(this).attr("LayoutProblem", "min-height is less than lineHeight");
        } else {
            $(this).removeClass('Layout-Problem-Detected');
        }
    });

    //NB: for some historical reason in March 2014 the calendar still uses textareas
    var editablePageElements = $(container).find("div.bloom-editable, textarea");

    //When they change, test for overflow
    editablePageElements.on("keyup paste", function (e) {
        var target = e.target;
        // Give the browser time to get the pasted text into the DOM first, before testing for overflow
        // GJM -- One place I read suggested that 0ms would work, it just needs to delay one 'cycle'.
        //        At first I was concerned that this might slow typing, but it doesn't seem to.
        setTimeout(function () {
            MarkOverflowInternal(target);

            //REVIEW: why is this here, in the overflow detection?

            // This will make sure that any language tags on this div stay in position with editing.
            // Reposition all language tips, not just the tip for this item because sometimes the edit moves other controls.
            $(queryElementsThatCanOverflow).qtip('reposition');
        }, 100); // 100 milliseconds
        e.stopPropagation();
    });

    // Right now, test to see if any are already overflowing
    $(container).find(queryElementsThatCanOverflow).each(function () {
        MarkOverflowInternal(this);
    });

    // When the user resizes an origami pane, check the overflow again
    $(container).find(".split-pane-component-inner").bind('_splitpaneparentresize', function () {
        MarkOverflowInternal(this);
        $(this).find(queryElementsThatCanOverflow).each(function () {
            MarkOverflowInternal(this);
        });
    });
}

// Add various editing key handlers
function AddEditKeyHandlers(container) {
    //Make F6 apply a superscript style (later we'll change to ctrl+shift+plus, as word does. But capturing those in js by hand is a pain.
    //nb: we're avoiding ctrl+plus and ctrl+shift+plus (as used by MS Word), because they means zoom in browser. also three keys is too much
    $(container).find("div.bloom-editable").on('keydown', null, 'F6', function (e) {
        var selection = document.getSelection();
        if (selection) {
            //NB: by using exeCommand, we get undo-ability
            document.execCommand("insertHTML", false, "<span class='superscript'>" + document.getSelection() + "</span>");
        }
    });

    $(container).find("div.bloom-editable").on('keydown', null, 'ALT+CTRL+0', function (e) {//ctrl alt 0 is from google drive for "normal text"
        e.preventDefault();
        document.execCommand("formatBlock", false, "P");
    });

    // Make F7 apply top-level header style (H1)
    $(container).find("div.bloom-editable").on('keydown', null, 'F7', function (e) {
        e.preventDefault();
        document.execCommand("formatBlock", false, "H1");
    });
    $(container).find("div.bloom-editable").on('keydown', null, 'ALT+CTRL+1', function (e) {//ctrl alt 1 is from google drive
        e.preventDefault();
        document.execCommand("formatBlock", false, "H1");
    });

    // Make F8 apply header style (H2)
    $(container).find("div.bloom-editable").on('keydown', null, 'F8', function (e) {
        e.preventDefault();
        document.execCommand("formatBlock", false, "H2");
    });
    $(container).find("div.bloom-editable").on('keydown', null, 'ALT+CTRL+2', function (e) { //ctrl alt 2 is from google drive
        e.preventDefault();
        document.execCommand("formatBlock", false, "H2");
    });

    $(document).bind('keydown', 'ctrl+space', function (e) {
      e.preventDefault();
      document.execCommand("removeFormat", false, false);//will remove bold, italics, etc. but not things that use elements, like h1
    });

    $(document).bind('keydown', 'ctrl+u', function (e) {
      e.preventDefault();
      document.execCommand("underline", null, null);
    });
    $(document).bind('keydown', 'ctrl+b', function (e) {
      e.preventDefault();
      document.execCommand("bold", null, null);
    });
    $(document).bind('keydown', 'ctrl+i', function (e) {
      e.preventDefault();
      document.execCommand("italic", null, null);
    });
    //note: these have the effect of introducing a <div> inside of the div.bloom-editable we're in.
    $(document).bind('keydown', 'ctrl+r', function (e) {
        e.preventDefault();
        document.execCommand("justifyright", false, null);
    });
    $(document).bind('keydown', 'ctrl+l', function (e) {
        e.preventDefault();
        document.execCommand("justifyleft", false, null);
    });
    $(document).bind('keydown', 'ctrl+shift+e', function (e) { //ctrl+shiift+e is what google drive uses
        e.preventDefault();
        document.execCommand("justifycenter", false, null);
    });
}

// Add little language tags
function AddLanguageTags(container) {
    $(container).find(".bloom-editable:visible[contentEditable=true]").each(function () {
        var $this = $(this);

        // If this DIV already had a language tag, remove the content in case we decide the situation has changed.
        if ($this.hasAttr('data-languageTipContent')) {
            $this.removeAttr('data-languageTipContent');
        }

        // With a really small box that also had a hint qtip, there wasn't enough room and the two fought
        // with each other, leading to flashing back and forth
        // Of course that was from when Language Tags were qtips too, but I think I'll leave the restriction for now.
        if ($this.width() < 100) {
            return;
        }

        // Make sure language tags appear or disappear depending on what edit mode we are in
        var isTranslationMode = IsInTranslationMode();
        if (isTranslationMode && $this.hasClass('bloom-readOnlyInTranslationMode')) {
            return;
        }
        if (!isTranslationMode && $this.hasClass('bloom-readOnlyInEditMode')) {
            return;
        }

        var key = $this.attr("lang");
        if (key == "*" || key.length < 1)
            return; //seeing a "*" was confusing even to me

        // if this or any parent element has the class bloom-hideLanguageNameDisplay, we don't want to show any of these tags
        // first usage (for instance) was turning off language tags for a whole page
        if ($this.hasClass('bloom-hideLanguageNameDisplay') || $this.parents('.bloom-hideLanguageNameDisplay').length != 0) {
            return;
        }

        var whatToSay = localizationManager.getText(key);
        if (!whatToSay)
            whatToSay = key; //just show the code

        // Put whatToSay into data attribute for pickup by the css
        $this.attr('data-languageTipContent', whatToSay);
    });
}

// Add (yellow) hint bubbles from (usually) label.bubble elements
function AddHintBubbles(container) {
    //Handle <label>-defined hint bubbles on mono fields, that is divs that aren't in the context of a
    //bloom-translationGroup (those should have a single <label> for the whole group).
    //Notice that the <label> inside an editable div is in a precarious position, it could get
    //edited away by the user. So we are moving the contents into a data-hint attribute on the field.
    //Yes, it could have been placed there in the 1st place, but the <label> approach is highly readable,
    //so it is preferred when making new templates by hand.
    $(container).find(".bloom-editable:visible label.bubble").each(function () {
        var labelElement = $(this);
        var whatToSay = labelElement.text();
        if (!whatToSay)
            return;
        var onFocusOnly = labelElement.hasClass('bloom-showOnlyWhenTargetHasFocus');

        var enclosingEditableDiv = labelElement.parent();
        enclosingEditableDiv.attr('data-hint', labelElement.text());
        labelElement.remove();

        //attach the bubble, this editable only, then remove it
        MakeHelpBubble($(enclosingEditableDiv), labelElement, whatToSay, onFocusOnly);
    });

    // Having a <label class='bubble'> inside a div.bloom-translationGroup gives a hint bubble outside each of
    // the fields, with some template-filling and localization for each.
    // Note that in Version 1.0, we didn't have this <label> ability but we had @data-hint.
    // Using <label> instead of the attribute makes the html much easier to read, write, and add additional
    // behaviors through classes
    $(container).find(".bloom-translationGroup > label.bubble").each(function () {
        var labelElement = $(this);
        var whatToSay = labelElement.text();
        if (!whatToSay)
            return;
        var onFocusOnly = labelElement.hasClass('bloom-showOnlyWhenTargetHasFocus');

        //attach the bubble, separately, to every visible field inside the group
        labelElement.parent().find("div.bloom-editable:visible").each(function () {
            MakeHelpBubble($(this), labelElement, whatToSay, onFocusOnly);
        });
    });

    $(container).find("*.bloom-imageContainer > label.bubble").each(function () {
        var labelElement = $(this);
        var imageContainer = $(this).parent();
        var whatToSay = labelElement.text();
        if (!whatToSay)
            return;
        var onFocusOnly = labelElement.hasClass('bloom-showOnlyWhenTargetHasFocus');
        MakeHelpBubble(imageContainer, labelElement, whatToSay, onFocusOnly);
    });

    //This is the "low-level" way to get a hint bubble, cramming it all into a data-hint attribute.
    //It is used by the "high-level" way in the monolingual case where we don't have a bloom-translationGroup,
    //and need a place to preserve the contents of the <label>, which is in danger of being edited away.
    $(container).find("*[data-hint]").each(function () {
        var whatToSay = $(this).attr("data-hint");//don't use .data(), as that will trip over any } in the hint and try to interpret it as json
        if (!whatToSay)
            return;

        //make hints that start with a * only show when the field has focus
        var showOnFocusOnly = whatToSay.startsWith("*");

        if (whatToSay.startsWith("*")) {
            whatToSay = whatToSay.substring(1, 1000);
        }

        if (whatToSay.length == 0 || $(this).css('display') == 'none')
            return;

        MakeHelpBubble($(this), $(this), whatToSay, showOnFocusOnly);
    });
}

// This function is called directly from EditingView.OnShowBookMetadataEditor()
function SetCopyrightAndLicense(data) {
    //nb: for textarea, we need val(). But for div, it would be text()
    $("DIV[data-book='copyright']").text(DecodeHtml(data.copyright));
    $("DIV[data-book='licenseUrl']").text(data.licenseUrl);
    $("DIV[data-book='licenseDescription']").text(data.licenseDescription);
    $("DIV[data-book='licenseNotes']").text(DecodeHtml(data.licenseNotes));
    var licenseImageValue = data.licenseImage + "?" + new Date().getTime(); //the time thing makes the browser reload it even if it's the same name
    if (data.licenseImage.length == 0) {
        licenseImageValue = ""; //don't wan the date on there
        $("IMG[data-book='licenseImage']").attr('alt', '');
    }

    $("IMG[data-book='licenseImage']").attr("src", licenseImageValue);
    SetBookCopyrightAndLicenseButtonVisibility($('body'));
}

function SetBookCopyrightAndLicenseButtonVisibility(container) {
    var shouldShowButton = !($(container).find("DIV.copyright").text());
    $(container).find("button#editCopyrightAndLicense").css("display", shouldShowButton ? "inline" : "none");
}




function DecodeHtml(encodedString) {
    return encodedString.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&#169;/g, "©");
}

function GetEditor() {
    return new StyleEditor("/bloom/bookEdit");
}

function SetupImage(image) {
    //make images scale up to their container without distorting their proportions, while being centered within it.
    $(image).scaleImage({ scale: "fit" }); //uses jquery.myimgscale.js

    // when the image changes, we need to scale again:
    $(image).load(function () {
        $(this).scaleImage({ scale: "fit" });
    });

    //and when their parent is resized by the user, we need to scale again:
    $(image).parent().resize(function () {
        $(this).find("img").scaleImage({ scale: "fit" });
        try {
            ResetRememberedSize(this);
        } catch (error) {
            console.log(error);
        }
    });
}

function IsInTranslationMode() {
    var body = $("body");
    if (!body.hasAttr('editMode'))
        return false;
    else {
        return body.attr('editMode') == "translation";
    }
}

$.fn.hasAttr = function (name) {
    var attr = $(this).attr(name);

    // For some browsers, `attr` is undefined; for others,
    // `attr` is false.  Check for both.
    return (typeof attr !== 'undefined' && attr !== false);
};

// Some custom templates have image containers embedded in bloom-editable divs, so that the text can wrap
// around the picture. The problems is that the user can do (ctrl+a, del) to start over on the text, and
// inadvertantly remove the embedded images. So we introduced the "bloom-preventRemoval" class, and this
// tries to safeguard element bearing that class.
function PreventRemovalOfSomeElements(container) {

    /* this approach showed promise, but only the first time you do ctrl+all, DEL. After the undo, the bindings were not redone.
    $(container).find(".bloom-preventRemoval").bind("DOMNodeRemoved", function (e) {
        alert("Removed: " + e.target.nodeName);
        //this threw a NS_ERROR but I don't know why
        //document.execCommand('undo', false, null);
    });

    the problem with this one is the event was raised when we weren't actually deleting it
    $(container).bind("DOMNodeRemoved", function (e) {
        if ($(e.target).hasClass('bloom-preventRemoval')) {
            alert("Removed: " + e.target.nodeName);
            document.execCommand('undo', false, null);
        }
        //this threw a NS_ERROR but I don't know why
        //document.execCommand('undo', false, null);
    });
    */


    $(container).find(".bloom-preventRemoval").closest(".bloom-editable").each(function () {
        var numberThatShouldBeThere = $(this).find(".bloom-preventRemoval").length;
        //Note, the input event is *not* fired on the element itself in the (ctrl+a, del) scenario, hence
        //the need to go up to the parent editable and attach the event their.
        $(this).on("input", function (e) {
            if ($(this).find(".bloom-preventRemoval").length < numberThatShouldBeThere) {
                document.execCommand('undo');
            }
        });
    });

//OK, now what if the above fails in some scenario? This adds a last-resort way of getting
    //bloom-editable back to the state it was in when the page was first created, by having
    //the user type in RESETRESET and then clicking out of the field.
    $(container).find(".bloom-editable").blur(function (e) {
        if ($(this).html().indexOf('RESETRESET') > -1) {
            $(this).remove();
            alert("Now go to another book, then back to this book and page.");
        }
    });
}

// Originally, all this code was in document.load and the selectors were acting
// on all elements (not bound by the container).  I added the container bound so we
// can add new elements (such as during layout mode) and call this on only newly added elements.
// Now document.load calls this with $('body') as the container.
// REVIEW: Some of these would be better off in OneTimeSetup, but too much risk to try to decide right now.
function SetupElements(container) {

    //add a marginBox if it's missing. We introduced it early in the first beta
    $(container).find(".bloom-page").each(function () {
        if ($(this).find(".marginBox").length == 0) {
            $(this).wrapInner("<div class='marginBox'></div>");
        }
    });

    PreventRemovalOfSomeElements(container);
    AddToolbox(container);

    //make textarea edits go back into the dom (they were designed to be POST'ed via forms)
    $(container).find("textarea").blur(function () {
        this.innerHTML = this.value;
    });

    //firefox adds a <BR> when you press return, which is lame because you can't put css styles on BR, such as indent.
    //Eventually we may use a wysiwyg add-on which does this conversion as you type, but for now, we change it when
    //you tab or click out.
    $(container).find(".bloom-editable").blur(function () {
        //in the focus event that came long before this blur event, we may have added an empty span to work around a gecko bug. Get rid of it now.
        $(this).children("span.bloom-ui").remove();

        //This might mess some things up, so we're only applying it selectively
        if ($(this).closest('.bloom-requiresParagraphs').length == 0
           && ($(this).css('border-top-style') != 'dashed')) //this signal used to let the css add this conversion after some SIL-LEAD SHRP books were already typed
        return;

        var x = $(this).html();

        //the first time we see a field editing in Firefox, it won't have a p opener
        if (!x.trim().startsWith('<p')
            && !x.trim().startsWith('<div')) { // in cases where we are embedding images inside of bloom-editables, the paragraphs actually have to go at the end, for reason of wrapping. See SHRP C1P4 Pupils Book
            x = "<p>" +x;
        }

        x = x.split("<br>").join("</p><p>");

        //the first time we see a field editing in Firefox, it won't have a p closer
        if (!x.trim().endsWith('</p>')) {
            x = x + "</p>";
        }
        $(this).html(x.trim());

        //If somehow you get leading empty paragraphs, FF won't let you delete them
//        $(this).find('p').each(function () {
//            if ($(this).text() === "") {
//                $(this).remove();
//            } else {
//                return false; //break
//            }
//        });

        //for some reason, perhaps FF-related, we end up with a new empty paragraph each time
        //so remove trailing <p></p>s
        $(this).find('p').reverse().each(function () {
            if ($(this).text() === "") {
                $(this).remove();
            } else {
                return false; //break
            }
        });
    });

    //when we discover an empty text box that has been marked to use paragraphs, start us off on the right foot
    $(container).find('.bloom-editable').focus(function () {
        //enhance: we actually want everything to be done with paragraphs, but need to wait for the ReaderTools to be enhanced to cope with that.

        var requireParagraphs = $(this).closest('.bloom-requiresParagraphs').length > 0
            || ($(this).css('border-top-style') == 'dashed');//this signal used to let the css add this conversion after some SIL-LEAD SHRP books were already typed

        if (!requireParagraphs) {
            // Work around a bug in geckofx. The effect was that if you clicked in a completely empty text box
            // the cursor is oddly positioned and typing does nothing. There is evidence that what is going on is that the focus
            // is on the English qtip (in the FF inspector, the qtip block highlights when you type). https://jira.sil.org/browse/BL-786
            // This bug mentions the cursor being in the wrong place: https://bugzilla.mozilla.org/show_bug.cgi?id=904846
            // so the solution is just to insert a span that you can't see, here during the focus event.
            // Then, we remove that span in the blur event.
            if ($(this).text() == '') {
                //add a span with only a zero-width space in it
                //enhance: a zero-width placeholder would be a bit better, but libsynphony doesn't know this is a space: //$(this).html('<span class="bloom-ui">&#8203;</span>');
                $(this).html('&nbsp;');
                //now we tried deleting it immediatly, or after a pause, but that doesn't help. So now we don't delete it until they type or paste something.
                $(container).find(".bloom-editable").one('paste keypress', FixUpOnFirstInput);
            }
            return;
        }

        if ($(this).text() == '' && $(this).find("p").length == 0) {
            //stick in a paragraph, which makes FF do paragraphs instead of BRs.
            $(this).html('<p>&nbsp;</p>'); // &zwnj; (zero width non-joiner) would be better but it makes the cursor invisible
            //now select that space, so we delete it when we start typing

            var el = $(this).find('p')[0].childNodes[0];
            var range = document.createRange();
            range.selectNodeContents(el);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        else {
            var el = $(this).find('p')[0];
            if (!el)
                return; // these have text, but not p's yet. We'll have to wait until they leave (blur) to add in the P's.
            var range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(true);//move to start of first paragraph
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    //TODO if you do Ctrl+A and delete, you're now outside of our <p></p> zone. clicking out will trigger the blur handerl above, which will restore it.
    });

    var accordion = parent.window.document.getElementById("accordion");
    var model;

    // accordion will be undefined during unit testing
    if (accordion) model = accordion.contentWindow['model'];

    // model will be undefined if the reader tools are not loaded
    if (model) {

        // invoke function when a bloom-editable element loses focus.
        $(container).find('.bloom-editable').focusout(function () {
            model.doMarkup();
        });

        $(container).find('.bloom-editable').focusin(function () {
            model.noteFocus(this); // 'This' is the element that just got focus.
        });

        // and a slightly different one for keypresses
        $(container).find('.bloom-editable').keypress(function () {
            model.doKeypressMarkup();
        });

        $(container).find('.bloom-editable').keydown(function (e) {
            if ((e.keyCode == 90 || e.keyCode == 89) && e.ctrlKey) { // ctrl-z or ctrl-Y
                if (model.currentMarkupType !== MarkupType.None) {
                    e.preventDefault();
                    if (e.shiftKey || e.keyCode == 89) { // ctrl-shift-z or ctrl-y
                        model.redo();
                    }
                    else {
                        model.undo();
                    }
                    return false;
                }
            }
        });
    }

    SetBookCopyrightAndLicenseButtonVisibility(container);

    //CSS normally can't get at the text in order to, for example, show something different if it is empty.
    //This allows you to add .bloom-needs-data-text to a bloom-translationGroup in order to get
    //its child bloom-editable's to have data-texts's on them
    $(container).find(".bloom-translationGroup.bloom-text-for-css .bloom-editable").each(function () {
        // initially fill it
        $(this).attr('data-text', this.textContent);
        // keep it up to date
        $(this).on('blur paste input', function () {
            $(this).attr('data-text', this.textContent);
        });
    });

    //in bilingual/trilingual situation, re-order the boxes to match the content languages, so that stylesheets don't have to
    $(container).find(".bloom-translationGroup").each(function () {
        var contentElements = $(this).find("textarea, div.bloom-editable");
        contentElements.sort(function (a, b) {
            //using negatives so that something with none of these labels ends up with a > score and at the end
            var scoreA = $(a).hasClass('bloom-content1') * -3 + ($(a).hasClass('bloom-content2') * -2) + ($(a).hasClass('bloom-content3') * -1);
            var scoreB = $(b).hasClass('bloom-content1') * -3 + ($(b).hasClass('bloom-content2') * -2) + ($(b).hasClass('bloom-content3') * -1);
            if (scoreA < scoreB)
                return -1;
            if (scoreA > scoreB)
                return 1;
            return 0;
        });
        //do the actual rearrangement
        $(this).append(contentElements);
    });

    //Convert Standard Format Markers in the pasted text to html spans
    $(container).find("div.bloom-editable").on("paste", function (e) {
        if (!e.originalEvent.clipboardData)
            return;

        var s = e.originalEvent.clipboardData.getData('text/plain');
        if (s==null || s =='')
            return;

        var re = new RegExp('\\\\v\\s(\\d+)', 'g');
        var matches = re.exec(s);
        if (matches == null) {
            //just let it paste
        }
        else {
            e.preventDefault();
            var x =s.replace(re, "<span class='superscript'>$1</span>");
            document.execCommand("insertHtml", false, x);
            //NB: this would undo, but it doesn't work document.execCommand("paste", false, x);
        }
    });

    AddEditKeyHandlers(container);

    //--------------------------------
    //keep divs vertically centered (yes, I first tried *all* the css approaches, they don't work for our situation)

    //do it initially
    $(container).find(".bloom-centerVertically").CenterVerticallyInParent();
    //reposition as needed
    $(container).find(".bloom-centerVertically").resize(function () { //nb: this uses a 3rd party resize extension from Ben Alman; the built in jquery resize only fires on the window
        $(this).CenterVerticallyInParent();
    });

    AddHintBubbles(container);

    //html5 provides for a placeholder attribute, but not for contenteditable divs like we use.
    //So one of our foundational stylesheets looks for @data-placeholder and simulates the
    //@placeholder behavior.
    //Now, what's going on here is that we also support
    //<label class='placeholder'> inside a div.bloom-translationGroup to get this placeholder
    //behavior on each of the fields inside the group .
    //Using <label> instead of the attribute makes the html much easier to read, write, and add additional
    //behaviors through classes.
    //So the job of this bit here is to take the label.placeholder and create the data-placeholders.
    $(container).find("*.bloom-translationGroup > label.placeholder").each(function () {

        var labelText = $(this).text();

        //put the attributes on the individual child divs
        $(this).parent().find('.bloom-editable').each(function () {

            //enhance: it would make sense to allow each of these to be customized for their div
            //so that you could have a placeholder that said "Name in {lang}", for example.
            $(this).attr('data-placeholder', labelText);
            //next, it's up to CSS to draw the placeholder when the field is empty.
        });
    });

    //make images look click-able when you cover over them
    $(container).find(".bloom-imageContainer").each(function () {
        SetupImageContainer(this);
    });

    //todo: this had problems. Check out the later approach, seen in draggableLabel (e.g. move handle on the inside, using a background image on a div)
    $(container).find(".bloom-draggable").mouseenter(function () {
        $(this).prepend("<button class='moveButton' title='Move'></button>");
        $(this).find(".moveButton").mousedown(function (e) {
            $(this).parent().trigger(e);
        });
    });
    $(container).find(".bloom-draggable").mouseleave(function () {
        $(this).find(".moveButton").each(function () {
            $(this).remove()
        });
    });

    $(container).find('div.bloom-editable').each(function () {
        $(this).attr('contentEditable', 'true');
    });

    // Bloom needs to make some fields readonly. E.g., the original license when the user is translating a shellbook
    // Normally, we'd control this is a style in editTranslationMode.css/editOriginalMode.css. However, "readonly" isn't a style, just
    // an attribute, so it can't be included in css.
    // The solution here is to add the readonly attribute when we detect that the css has set the cursor to "not-allowed".
    $(container).find('textarea, div').focus(function () {
        //        if ($(this).css('border-bottom-color') == 'transparent') {
        if ($(this).css('cursor') == 'not-allowed') {
            $(this).attr("readonly", "true");
            $(this).removeAttr("contentEditable");
        }
        else {
            $(this).removeAttr("readonly");
            //review: do we need to add contentEditable... that could lead to making things editable that shouldn't be
        }
    });

    AddLanguageTags(container);

    // If the user moves over something they can't edit, show a tooltip explaining why not
    $(container).find('*[data-hint]').each(function () {

        if ($(this).css('cursor') == 'not-allowed') {
            var whyDisabled = "You cannot change these because this is not the original copy.";
            if ($(this).hasClass('bloom-readOnlyInEditMode')) {
                whyDisabled = "You cannot put anything in there while making an original book.";
            }

            var whatToSay = $(this).attr("data-hint");//don't use .data(), as that will trip over any } in the hint and try to interpret it as json

            whatToSay = localizationManager.getLocalizedHint(whatToSay, $(this)) + " <br/>" + whyDisabled;
            var theClasses = 'ui-tooltip-shadow ui-tooltip-red';
            var pos = { at: 'right center',
                my: 'left center'
            };
            $(this).qtip({
                content: whatToSay,
                position: pos,
                show: {
                    event: 'focusin mouseenter'
                },
                style: {
                    classes: theClasses
                }
            });
        }
    });

    //Same thing for divs which are potentially editable, but via the contentEditable attribute instead of TextArea's ReadOnly attribute
    // editTranslationMode.css/editOriginalMode.css can't get at the contentEditable (css can't do that), so
    // so they set the cursor to "not-allowed", and we detect that and set the contentEditable appropriately
    $(container).find('div.bloom-readOnlyInTranslationMode').focus(function () {
        if ($(this).css('cursor') == 'not-allowed') {
            $(this).removeAttr("contentEditable");
        }
        else {
            $(this).attr("contentEditable", "true");
        }
    });

    //first used in the Uganda SHRP Primer 1 template, on the image on day 1
    //This took *enormous* fussing in the css. TODO: copy what we learned there
    //to the (currently experimental) Toolbox template (see 'bloom-draggable')
    $(container).find(".bloom-draggableLabel").each(function () {
        // previous to June 2014, containment was not working, so some items may be
        // out of bounds. Or the stylesheet could change the size of things. This gets any such back in bounds.
        if ($(this).position().left < 0) {
            $(this).css('left', 0);
        }
        if ($(this).position().top < 0) {
            $(this).css('top', 0);
        }
        if ($(this).position().left + $(this).width() > $(this).parent().width()) {
            $(this).css('left', $(this).parent().width() - $(this).width());
        }
        if ($(this).position().top > $(this).parent().height()) {
            $(this).css('top', $(this).parent().height() - $(this).height());
        }

        $(this).draggable(
        {
            containment: "parent", //NB: this containment is of the translation group, not the editable inside it. So avoid margins on the translation group.
            handle: '.dragHandle'
        });
    });


    $(container).find(".bloom-draggableLabel")
       .mouseenter(function () {
        $(this).prepend(" <div class='dragHandle'></div>");
    });

    $(container).find(".bloom-draggableLabel").mouseleave(function () {
        $(this).find(".dragHandle").each(function() {
            $(this).remove()
        });
    });

    // add drag and resize ability where elements call for it
    //   $(".bloom-draggable").draggable({containment: "parent"});
    $(container).find(".bloom-draggable").draggable({ containment: "parent",
        handle: '.bloom-imageContainer',
        stop: function (event, ui) {
            $(this).find('.wordsDiv').find('div').each(function () {
                $(this).qtip('reposition');
            })
        } //yes, this repositions *all* qtips on the page. Yuck.
    }); //without this "handle" restriction, clicks on the text boxes don't work. NB: ".moveButton" is really what we wanted, but didn't work, probably because the button is only created on the mouseEnter event, and maybe that's too late.
    //later note: using a real button just absorbs the click event. Other things work better
    //http://stackoverflow.com/questions/10317128/how-to-make-a-div-contenteditable-and-draggable

    /* Support in page combo boxes that set a class on the parent, thus making some change in the layout of the pge.
    Example:
         <select name="Story Style" class="bloom-classSwitchingCombobox">
             <option value="Fictional">Fiction</option>
             <option value="Informative">Informative</option>
     </select>
     */
    //First we select the initial value based on what class is currently set, or leave to the default if none of them
    $(container).find(".bloom-classSwitchingCombobox").each(function(){
        //look through the classes of the parent for any that match one of our combobox values
        var i;
        for(i=0; i< this.options.length;i++) {
            var c = this.options[i].value;
            if($(this).parent().hasClass(c)){
                $(this).val(c);
                break;
            }
        }
    });
    //And now we react to the user choosing a different value
    $(container).find(".bloom-classSwitchingCombobox").change(function(){
        //remove any of the values that might already be set
        var i;
        for(i=0; i< this.options.length;i++) {
            var c = this.options[i].value;
            $(this).parent().removeClass(c);
        }
        //add back in the one they just chose
        $(this).parent().addClass(this.value);
    });

    //only make things deletable if they have the deletable class *and* page customization is enabled
    $(container).find("DIV.bloom-page.bloom-enablePageCustomization DIV.bloom-deletable").each(function () {
        SetupDeletable(this);
    });

    $(container).find(".pictureDictionaryPage").each(function () {
        AddExperimentalNotice(this);
    });

    $(container).find(".bloom-resizable").each(function () {
        SetupResizableElement(this);
    });

    $(container).find("img").each(function () {
        SetAlternateTextOnImages(this);
    });

    SetOverlayForImagesWithoutMetadata(container);

    //note, the normal way is for the user to click the link on the qtip.
    //But clicking on the exiting topic may be natural too, and this prevents
    //them from editing it by hand.
    $(container).find("div[data-book='topic']").click(function () {
        if ($(this).css('cursor') == 'not-allowed')
            return;
        TopicChooser.showTopicChooser();
    });

    // Copy source texts out to their own div, where we can make a bubble with tabs out of them
    // We do this because if we made a bubble out of the div, that would suck up the vernacular editable area, too,
    if ($(container).find(".bloom-preventSourceBubbles").length == 0) {
        $(container).find("*.bloom-translationGroup").not(".bloom-readOnlyInTranslationMode").each(function() {
            if ($(this).find("textarea, div").length > 1) {
                MakeSourceTextDivForGroup(this);
            }
        });
    }

    $(container).find(".bloom-imageContainer img").each(function() {
        SetupImage(this);
    });

    // Add overflow event handlers so that when a div is overfull,
    // we add the overflow class and it gets a red background or something
    // Moved overflowhandler after SetupImage because some pages with lots of placeholders
    // were prematurely overflowing before the images were set to the right size.
    AddOverflowHandler(container);

    var editor = GetEditor();

    $(container).find("div.bloom-editable:visible").each(function () {
        // If the .bloom-editable or any of its ancestors (including <body>) has the class "bloom-userCannotModifyStyles",
        // then the controls that allow the user to adjust the styles will not be shown.This does not prevent the user
        // from doing character styling, e.g. CTRL+b for bold.
        if ($(this).closest('.bloom-userCannotModifyStyles').length == 0) {
            $(this).focus(function() {
                editor.AttachToBox(this);
            });
        }
    });

    getIframeChannel().simpleAjaxGet('/bloom/windows/useLongpress', function(response) {
        if (response === 'Yes')
            $(container).find('.bloom-editable').longPress();
    });

    //When we do a CTRL+A DEL, FF leaves us with a <br></br> at the start. When the first key is then pressed,
    //a blank line is shown and the letter pressed shows up after that.
    //This detects that situation when we type the first key after the deletion, and first deletes the <br></br>.
    $(container).find('.bloom-editable').keypress(function (event) {
        //this is causing a worse problem, (preventing us from typing empty lines to move the start of the text down), so we're going to live with the empty space for now.
        // TODO: perhaps we can act when the DEL or Backspace occurs and then detect this situation and clean it up.
//         if ($(event.target).text() == "") { //NB: the browser inspector shows <br></br>, but innerHTML just says "<br>"
//            event.target.innerHTML = "";
//        }
    });
    //This detects that situation when we do CTRL+A and then type a letter, instead of DEL
    $(container).find('.bloom-editable').keyup(function (event) {
        //console.log(event.target.innerHTML);
        // If they pressed a letter instead of DEL, we get this case:
        if ($(event.target).find("#formatButton").length == 0) { //NB: the browser inspector shows <br></br>, but innerHTML just says "<br>"
            //they have also deleted the formatButton, so put it back in
            // console.log('attaching'); REVIEW: this shows that we're doing the attaching on the first character entered, even though it appears the editor was already attached.
            //so we actually attach twice. That's ok, the editor handles that, but I don't know why we're passing the if, and it could be improved.
            if ($(this).closest('.bloom-userCannotModifyStyles').length == 0)
                editor.AttachToBox(this);
        }
    });

    //focus on the first editable field
    $(container).find("textarea, div.bloom-editable").first().focus(); //review: this might choose a textarea which appears after the div. Could we sort on the tab order?
}

// Only put setup code here which is guaranteed to only be run once per page load.
// e.g. Don't put setup for elements such as image containers or editable boxes which may get added after page load.
function OneTimeSetup() {
    setupOrigami();
}


//Earlier, to work around a FF bug, we made a text box non-empty so that the cursor would should up correctly.
//Now, they have entered something, so remove it
function FixUpOnFirstInput() {
    //when this was wired up, we used ".one()", but actually we're getting multiple calls for some reason,
    //and that gets characters in the wrong place because this messes with the insertion point. So now
    //we check to see if the space is still there before touching it
    if ($(this).html().indexOf("&nbsp;") == 0) {
        //earlier we stuck a &nbsp; in to work around a FF bug on empty boxes.
        //now remove it a soon as they type something


        // this caused BL-933 by somehow making us lose the on click event link on the formatButton
    //   $(this).html($(this).html().replace('&nbsp;', ""));

        //so now we do the follow business, where we select the &nbsp; we want to delete, momements before the character is typed or text pasted
        var selection = window.getSelection();

        //if we're at the start of the text, we're to the left of the character we want to replace
        if (selection.anchorOffset == 0) {
            selection.modify("extend", "forward", "character");
            //REVIEW: I actually don't know why this is necessary; the pending keypress should do the same thing
            //But BL-952 showed that without it, we actually somehow end up selecting the format gear icon as well
            selection.deleteFromDocument();
        }
        //if we're at position 1 in the text, then we're just to the right of the character we want to replace
        else if (selection.anchorOffset == 1) {
            selection.modify("extend", "backward", "character");
        }
    }
}


// ---------------------------------------------------------------------------------
// document ready function
// ---------------------------------------------------------------------------------
$(document).ready(function() {
    if($.fn.qtip)
        $.fn.qtip.zindex = 15000;
    //gives an error $.fn.qtip.plugins.modal.zindex = 1000000 - 20;

    $.fn.reverse = function () {
        return this.pushStack(this.get().reverse(), arguments);
    };

    //if this browser doesn't have endsWith built in, add it
    if (typeof String.prototype.endsWith !== 'function') {
        String.prototype.endsWith = function (suffix) {
            return this.indexOf(suffix, this.length - suffix.length) !== -1;
        };
    }

    /* Defines a starts-with function*/
    if (typeof String.prototype.startsWith != 'function') {
        String.prototype.startsWith = function (str) {
            return this.indexOf(str) == 0;
        };
    }

    //eventually we want to run this *after* we've used the page, but for now, it is useful to clean up stuff from last time
    Cleanup();

    SetupElements($('body'));
    OneTimeSetup();

}); // end document ready function
