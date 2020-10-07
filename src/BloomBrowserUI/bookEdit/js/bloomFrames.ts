/* The Bloom "Edit"" pane currently works by having an outer window/html with a number of iframes.
        For better or worse, these iframes currently communicate with each other.
        These functions allow any of the iframes or the root to find any of the others. Each of these
        has an "entry point" javacript which is a file bundled by webpack and <script>-included by the
        the html of that frame.
        In order to make the contents of that bundle and the context of that frame accessible from the
        outside, Webpack is set so that the first line of each of these "entry point" files
        is something like
        var FrameExports = {.....}

        So this module just hides all that and allows code in any frame to access the exports on any other frame.
        Not to make it simpler (because it's already simple... see how few lines are here...) but in order
        to hide the details so that we can easily change it later.
*/

import { IPageFrameExports } from "../editablePage";

interface WindowWithExports extends Window {
    FrameExports: any;
}
export function getToolboxFrameExports() {
    return getFrameExports("toolbox");
}
export function getPageFrameExports(): IPageFrameExports | null {
    return getFrameExports("page") as IPageFrameExports | null;
}
export function getEditViewFrameExports() {
    return (<any>getRootWindow()).FrameExports;
}

export async function getPageFrameExportsAsync(): Promise<IPageFrameExports | null> {
    return getFrameExportsAsync("page") as Promise<IPageFrameExports | null>;
}

function getRootWindow(): Window {
    //if parent is null, we're the root
    return window.parent || window;
}

function getFrame(id: string): WindowWithExports | null {
    const element = getRootWindow().document.getElementById(id);
    if (!element) {
        return null;
    }

    return (<HTMLIFrameElement>element).contentWindow as WindowWithExports;
}

async function getFrameAsync(id: string): Promise<WindowWithExports | null> {
    const element = await getFrameElementAsync(id);
    if (!element) {
        return null;
    }

    return element.contentWindow as WindowWithExports;
}

// Returns an HTMLIFrameElement corresponding to the specified id.
// Promise is only fulfilled when that iframe has completed laoding.
async function getFrameElementAsync(
    id: string
): Promise<HTMLIFrameElement | null> {
    const element = getRootWindow().document.getElementById(id);

    if (!element) {
        // No element with that ID
        return Promise.resolve(null);
    }

    const iframe = element as HTMLIFrameElement;
    const iframeDoc = iframe.contentDocument;

    if (!iframeDoc) {
        // Not sure what this means... just return null
        return Promise.resolve(null);
    }

    if (iframeDoc.readyState === "complete") {
        // Easy case (and hopefully main case): iframe completely loaded and ready
        return iframe;
    } else {
        // Yuck. The iframe is still loading. We need to wait until until it finishes loading.
        console.log(
            "iframeDoc is still loading! readyState = " + iframeDoc.readyState
        );
        return new Promise<HTMLIFrameElement>((resolve, reject) => {
            iframeDoc.addEventListener("load", () => {
                resolve(iframe);
            });

            iframeDoc.addEventListener("error", () => {
                reject(new Error("iframe document encountered error."));
            });
        });
    }
}

function getFrameExports(id: string): any {
    return getFrame(id)?.FrameExports;
}

async function getFrameExportsAsync(id: string): Promise<any> {
    return (await getFrameAsync(id))?.FrameExports;
}
