/// <reference path="../../typings/jquery/jquery.d.ts" />
/// <reference path="../../typings/jquery.gridly.d.ts" />
///<reference path="../../typings/toastr/toastr.d.ts"/>
/// <reference path="../../lib/localizationManager/localizationManager.ts" />

// This is one of the root files for our webpack build, the root from which
// pageThumbnailListBundle.js is built. Currently, contrary to our usual practice,
// this bundle is one of two loaded by pageThumbnailList.pug. It is imported last,
// so things it exports are accessible from outside the bundle using FrameExports.

import * as React from "react";
import { useState, useContext, useEffect, useMemo } from "react";
import * as ReactDOM from "react-dom";
import theOneLocalizationManager from "../../lib/localizationManager/localizationManager";

import * as toastr from "toastr";
// Todo: hope no longer needing jquery
import * as $ from "jquery";
import "errorHandler";
import WebSocketManager from "../../utils/WebSocketManager";
import { Responsive } from "react-grid-layout";
import { BloomApi } from "../../utils/bloomApi";
import { PageThumbnail } from "./PageThumbnail";
import LazyLoad from "react-lazyload";

// We're using the Responsive version of react-grid-layout because
// (1) the previous version of the page thumbnails, which this replaces,
// could be resized, and at one point...I discovered later that it
// was disabled...it could switch between one and two columns.
// So I started out that way. We decided not to support this in
// the new version, but it seemed fairly harmless to leave in some of
// the code needed to handle it.
// (2) I can't figure out the import command to get the non-responsive
// version.
// To make it actually responsive again, (switch to single column when narrow):
// - add WidthProvider to react-grid-layout import
// - uncomment the following line:
//const ResponsiveGridLayout = WidthProvider(Responsive);
// - Change the root element from Responsive to ResponsiveGridLayout
// - remove the width property (WidthProvider will set it)
// - the lg breakpoint should be about 170
// - figure out something to do to make it a little narrower
// when there's plenty of width so we don't get an unnecessary
// horizontal scroll bar.

const kWebsocketContext = "pageThumbnailList";

// A function configured once to listen for events coming from C# over the websocket.
let webSocketListenerFunction;

const rowHeight = 105; // px

// the objects we get from C#. Typically content is an empty string,
// and we later retrieve the real content.
export interface IPage {
    key: string;
    caption: string;
    content: string;
}

const handleGridItemClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.currentTarget) {
        fireCSharpEvent(
            "gridClick",
            (e.currentTarget.parentElement!.parentElement!
                .parentElement as HTMLElement)!.getAttribute("id")
        );
    }
};

// This map goes from page ID to a callback that we get from the page thumbnail
// which should be called when the main Bloom program informs us that
// the thumbnail needs to be updated.
// It really has to be the same object on different calls to the function,
// because some things that use it only happen once while others happen
// more often. We'll need another solution in the unlikely event of
// there ever being more than one instance of pageThumbnailList.
const pageIdToRefreshMap = new Map<string, () => void>();

const PageList: React.FunctionComponent<{ pageSize: string }> = props => {
    const [realPageList, setRealPageList] = useState<IPage[]>([]);
    const [reloadValue, setReloadValue] = useState(0);
    const [twoColumns, setTwoColumns] = useState(true);

    const [selectedPageId, setSelectedPageId] = useState("");
    // All the code in this useEffect is one-time initialization.
    useEffect(() => {
        let localizedNotification = "";

        // This function will be hooked up (after we set localizedNotification properly)
        // to be called when C# sends messages through the web socket.
        // We need a named function because it looks cleaner and we use it to remove the
        // listener when we shut down.
        webSocketListenerFunction = event => {
            switch (event.id) {
                case "saving": {
                    toastr.info(localizedNotification, "", {
                        positionClass: "toast-top-left",
                        preventDuplicates: true,
                        showDuration: 300,
                        hideDuration: 300,
                        timeOut: 1000,
                        extendedTimeOut: 1000,
                        showEasing: "swing",
                        showMethod: "fadeIn",
                        hideEasing: "linear",
                        hideMethod: "fadeOut",
                        messageClass: "toast-for-saved-message",
                        iconClass: ""
                    });
                    break;
                }
                case "selecting":
                    setSelectedPageId(event.message);
                    break;
                case "pageNeedsRefresh":
                    const problemPageId = event.message;
                    const callback = pageIdToRefreshMap.get(problemPageId);
                    if (callback) callback();
                    break;
                case "pageListNeedsRefresh":
                    // pass function so we're not incrementing a stale value captured
                    // when we set up this function. Bumping this number triggers
                    // re-running a useEffect.
                    setReloadValue(oldReloadValue => oldReloadValue + 1);
                    break;
                case "stopListening":
                    WebSocketManager.closeSocket(kWebsocketContext);
                    break;
            }
        };

        theOneLocalizationManager
            .asyncGetText("EditTab.SavingNotification", "Saving...", "")
            .done(savingNotification => {
                localizedNotification = savingNotification;
                WebSocketManager.addListener(
                    kWebsocketContext,
                    webSocketListenerFunction
                );
            });
    }, []);

    // Initially we have an empty page list. Then we run this once and get a list
    // of pages that have the right ID and caption (and the right number of pages)
    // but the content is empty. The individual thumbnail objects do their own API
    // calls to fill in the page content. Then this runs again when the sequence
    // of pages changes (e.g., adding a page or re-ordering them).
    useEffect(() => {
        BloomApi.get("pageList/pages", response => {
            // We're using a double approach here. The WebThumbnailList actually gets
            // notified a few times of the initial selected page. Each time, it sends
            // a message to the listener above. But, there's async stuff involved
            // in when the listener starts listening. So we might miss all of them.
            // Therefore, the actual 'source of truth' for which page is selected
            // is a property of the PageListApi, and that is also set as soon as the
            // WebThumbnailList hears about it, and we get it along with the page list
            // in case we miss a notification.
            setSelectedPageId(response.data.selectedPageId);
            setRealPageList(response.data.pages);
        });
    }, [reloadValue]);

    // We insert a dummy invisible page to make the outside cover a 'right' page
    // and all the others correctly paired. (Probably should remove if we ever fully
    // support single-column.)
    const pageList: IPage[] = [
        { key: "placeholder", caption: "", content: "" },
        ...realPageList
    ];
    const pages = useMemo(() => {
        const pages1 = pageList.map((pageContent, index) => {
            return (
                <div
                    key={pageContent.key} // for efficient react manipulation of list
                    id={pageContent.key} // used by C# code to identify page
                    className={
                        "gridItem " +
                        (pageContent.key === "placeholder"
                            ? " placeholder"
                            : "") +
                        (selectedPageId === pageContent.key
                            ? " gridSelected"
                            : "")
                    }
                >
                    <LazyLoad
                        height={rowHeight}
                        scrollContainer="#pageGridWrapper"
                    >
                        <PageThumbnail
                            page={pageContent}
                            left={!(index % 2)}
                            pageSize={props.pageSize}
                            configureReloadCallback={(id, callback) =>
                                pageIdToRefreshMap.set(id, callback)
                            }
                            onClick={handleGridItemClick}
                        />
                        {selectedPageId === pageContent.key && (
                            <div id="menuIconHolder" className="menuHolder">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 18 18"
                                    onClick={() => {
                                        fireCSharpEvent(
                                            "menuClicked",
                                            pageContent.key
                                        );
                                    }}
                                >
                                    <path d="M5 8l4 4 4-4z" fill="white" />
                                </svg>
                            </div>
                        )}
                    </LazyLoad>
                </div>
            );
        });
        return pages1;
    }, [pageList]);
    // Set up some objects and functions we need as params for our main element.
    // Some of them come in sets "lg" and "sm". Currently the "lg" (two-column)
    // version is always used; the other would be for single column.

    // not currently used.
    const singleColLayout = pageList.map((page, index) => {
        return { i: page.key, x: 0, y: index, w: 1, h: 1 };
    });
    const twoColLayout = pageList.map((page, index) => {
        const left = !(index % 2);
        // review: should we make all xmatter pages non-draggable? Or stick with giving an
        // error message if they make an inappropriate drag?
        const draggable = index !== 0;
        return {
            i: page.key,
            x: left ? 0 : 1,
            y: Math.floor(index / 2),
            w: 1,
            h: 1,
            draggable // todo: not working.
        };
    });
    const layouts = { lg: twoColLayout, sm: singleColLayout };

    // Useful if we get responsive...figures out whether the responsive grid has
    // decided to be single-column or double-column.
    const onLayoutChange = (layouts: ReactGridLayout.Layout[]) => {
        setTwoColumns(layouts && layouts.length > 1 && layouts[1].x > 0);
    };

    return (
        <Responsive
            width={180}
            layouts={layouts}
            // lg (two-column) if it's more than 90px wide. That's barely enough for one column,
            // so may want to increase it if we really go responsive; but currently, single column
            // looks strange if there's any extra white space, with the thumbnails staggered
            // left and right. So for now we've fixed the width of the thumbnail pane, making
            // it big enough for two full columns always.
            breakpoints={{ lg: 90, sm: 0 }}
            rowHeight={rowHeight}
            compactType="wrap"
            cols={{ lg: 2, sm: 1 }}
            onLayoutChange={onLayoutChange}
            onDragStop={onDragStop}
        >
            {pages}
        </Responsive>
    );
};

$(window).ready(() => {
    const pageSize =
        document.body.getAttribute("data-pageSize") || "A5Portrait";
    ReactDOM.render(
        <PageList pageSize={pageSize} />,
        document.getElementById("pageGridWrapper")
    );
});

// Function invoked when dragging a page ends. Note that it is often
// called when all the user intended was to click the page, presumably
// because some tiny movement was made while the mouse is down.
function onDragStop(
    layout: ReactGridLayout.Layout[],
    // oldItem and newItem are the same page, but with the old position (x, y props)
    // and new position. It's quite possible with a small drag that they are the same.
    oldItem: ReactGridLayout.Layout,
    newItem: ReactGridLayout.Layout,
    placeholder: ReactGridLayout.Layout,
    e: MouseEvent,
    element: HTMLElement
) {
    const movedPageId = newItem.i;
    // do nothing if it didn't move (this seems to get fired on any click,
    // even just closing a popup menu)
    if (oldItem.y == newItem.y && oldItem.x == newItem.x) return;
    // Needs more smarts if we ever do other than two columns.
    const newIndex = newItem.y * 2 + newItem.x;

    BloomApi.postJson(
        "pageList/pageMoved",
        { movedPageId, newIndex },
        () => {}
    );
}

function fireCSharpEvent(eventName, eventData) {
    const event = new MessageEvent(eventName, {
        bubbles: true,
        cancelable: true,
        data: eventData
    });
    top.document.dispatchEvent(event);
}
