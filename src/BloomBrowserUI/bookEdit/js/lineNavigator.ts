// This handler should be in a keydown event, not a keyup event.
// If you use keyup, the selection will already have changed by the time you get the event.
// But we would like to know the selection before pressing the arrow key.
export function fixUpDownArrowEventHandler(keyEvent: KeyboardEvent) {
    const lineNav = new LineNavigator();
    lineNav.handleUpDownArrowsInFlexboxEditables(keyEvent);
}

class LineNavigator {
    private debug: boolean = true;

    public constructor() {}

    public handleUpDownArrowsInFlexboxEditables(keyEvent: KeyboardEvent): void {
        // Avoid modifying the keydown behavior by returning early unless it's the specific problem case
        if (keyEvent.key !== "ArrowUp" && keyEvent.key !== "ArrowDown") {
            return;
        }

        this.log("Handling " + keyEvent.key);

        const targetElem = keyEvent.target as Element;
        if (!targetElem) {
            this.log("SKIP - Target could not be cast to Element");
            return;
        }

        const style = window.getComputedStyle(targetElem);
        if (style.display !== "flex") {
            // Problem only happens if the bloom-editable is a flexbox.
            this.log("SKIP - Not a flexbox.");
            return;
        }

        const sel = window.getSelection();
        if (!sel) {
            this.log("SKIP - Could not get selection.");
            return;
        } else {
            this.printNode(sel.anchorNode, "[sel.anchorNode] ");
        }

        if (keyEvent.key === "ArrowUp") {
            // Limit it to text nodes
            if (sel.anchorNode?.nodeType !== Node.TEXT_NODE) {
                this.log(
                    "SKIP - Not a text node. nodeType = " +
                        sel.anchorNode?.nodeType
                );
                return;
            }

            this.moveIfAnchorIsTextNode(keyEvent, sel, "up");
        } else {
            // Down arrow
            if (sel.anchorNode?.nodeType === Node.TEXT_NODE) {
                this.moveIfAnchorIsTextNode(keyEvent, sel, "down");
            } else if (sel.anchorNode?.nodeType === Node.ELEMENT_NODE) {
                // It is possible for the selection to be set to an element node.
                //
                // Some cases where this is relevant is if you have 2 paragraphs, but each is only 1 line.
                // When the cursor is automatically set to the 1st char when loaded, this can happen.
                // It can also sometimes happen if you navigate in a certain way to the end of a 1-line paragraph
                // e.g., navigate to the front of the paragraph, then down arrow (takes you to the end), then press up arrow (bug repros)
                this.log("TODO: Implement me (elementNode)");
                return;
            } else {
                // Completely unrecognized case - abort
                this.log(
                    "SKIP - Unrecognized nodeType: " + sel.anchorNode?.nodeType
                );
                return;
            }
        }
    }

    private moveIfAnchorIsTextNode(
        event: Event,
        sel: Selection,
        direction: "up" | "down"
    ): void {
        // Precondition: oldAnchorNode must be a TextNode
        const nodeType = sel.anchorNode?.nodeType;
        console.assert(
            nodeType === Node.TEXT_NODE,
            "textNode was not valid. nodeType: " + nodeType
        );
        const oldTextNode = sel.anchorNode!;
        const oldIndex: number = sel.anchorOffset;

        // TODO: Need to make talking books work.

        // Limit it to text nodes inside paragraphs, for now.
        // Not really clear what should happen if it's not a paragraph,
        // or how we even arrive at that hypothetical state.
        const oldElement = oldTextNode.parentElement;
        if (oldElement?.tagName !== "P") {
            this.log(
                "SKIP - Not a paragraph. tagName = " + oldElement?.tagName
            );
            return;
        }

        const { offsets, lineStartIndices } = this.analyze(oldElement);

        if (direction === "up") {
            if (!this.isOnFirstLine(oldIndex, lineStartIndices)) {
                this.log(
                    `SKIP - Offset ${oldIndex} not on first line (ending at ${lineStartIndices[1]})`
                );
                return;
            } else {
                this.log(`Continue - Offset ${oldIndex} is on first line`);
            }
        } else {
            if (!this.isOnLastLine(oldIndex, lineStartIndices)) {
                this.log(
                    `SKIP - Offset ${oldIndex} not on last line (starting at ${
                        lineStartIndices[lineStartIndices.length - 1]
                    })`
                );
                return;
            } else {
                this.log(`Continue - Offset ${oldIndex} is on last line`);
            }
        }

        const sibling =
            direction === "up"
                ? oldElement.previousSibling
                : oldElement.nextSibling;
        if (!sibling) {
            this.log("SKIP - sibling was null");
            return;
        }

        const newTextNode =
            direction === "up"
                ? this.getLastTextNode(sibling)
                : this.getFirstTextNode(sibling);
        if (!newTextNode) {
            this.log("SKIP - targetNode not determined");
            return;
        }
        if (newTextNode.nodeType !== Node.TEXT_NODE) {
            this.log(
                "SKIP - Unexpected targetNode.nodeType: " +
                    newTextNode.nodeValue
            );
            return;
        }

        // Determine the new offset
        const targetX = this.getCurrentOffsetX(oldIndex, offsets);
        const newParentElement = newTextNode.parentElement;

        if (!newParentElement) {
            this.log("SKIP - newParentElement is null.");
            return;
        }
        const newAnalysis = this.analyze(newParentElement);
        const newIndex = this.getIndexClosestToTargetX(
            direction,
            targetX,
            newAnalysis
        );

        if (newIndex === null) {
            this.log("SKIP - newIndex is null.");
            return;
        }

        this.setSelectionTo(sel, newTextNode, newIndex);

        // Hmm, for some reason, after modifying the selection, now the default seems to work
        // so now we need to prevent it in order to avoiding moving twice the desired amount.
        this.log("preventDefault called.");
        event.preventDefault();
    }

    private setSelectionTo(sel: Selection, node: Node, offset: number): void {
        this.log(`setSelectionTo offset ${offset} within node: `);
        this.printNode(node);
        sel.setBaseAndExtent(node, offset, node, offset);
    }

    private printNode(node: Node | null | undefined, prefix: string = "") {
        if (node === undefined) {
            this.log(`${prefix}Undefined`);
        } else if (node === null) {
            this.log(`${prefix}Null`);
        } else if (node.nodeType === Node.TEXT_NODE) {
            this.log(`${prefix}TextNode: ${node.textContent}`);
        } else {
            this.log(`${prefix}ElementNode: ${(node as Element).outerHTML}`);
        }
    }

    private analyze(element: Element) {
        const offsets = this.getOffsetsPerChar(element);
        const lineStartIndices = this.getLineStartIndices(offsets);

        return {
            offsets,
            lineStartIndices
        };
    }

    private getOffsetsPerChar(element: Element): IOffsetInfo[] {
        if (!element.parentElement) {
            return [];
        }

        // This method clones the element so that we don't directly modify the original element.
        // The benefit is to avoid the selection changing when we modify the element's innerHTML.
        // This allows us to avoid a huge hassle of figuring out the selection again, since not only
        // is the selection object itself changed, but if you hold on to references of the original anchorNode,
        // well those are no longer in the DOM anymore.
        const clone = element.cloneNode(true) as Element;

        // Append the clone into the parent so that it'll have the same width, styling, etc.
        // FYI, I think it's unnecessary to make it invisible. Due to Javascript event loop,
        // as long as we don't await stuff, it should be removed before the UI gets to re-render things
        element.parentElement.appendChild(clone);

        // Insert temporary inline elements around each character so we can measure their position
        this.insertMarkingSpansAroundEachChar(clone);

        const markedSpans = clone.querySelectorAll("span.temp");
        if (markedSpans.length <= 0) {
            return [];
        }

        // Actually measure the position of each character
        const offsets: IOffsetInfo[] = [];
        for (let i = 0; i < markedSpans.length; ++i) {
            const span = markedSpans[i] as HTMLElement;
            const offsetInfo = {
                left: span.offsetLeft,
                right: span.offsetLeft + span.offsetWidth,
                top: span.offsetTop
            };
            offsets.push(offsetInfo);
        }

        // Cleanup
        const updatedChildNodes = element.parentElement.childNodes;
        const lastChild = updatedChildNodes[updatedChildNodes.length - 1];
        const removed = element.parentElement.removeChild(lastChild);
        console.assert(removed, "removeChild failed.");

        return offsets;
    }

    // This version will mess up your Selection object.
    private getOffsetsPerCharUnsafe(element: Element): IOffsetInfo[] {
        const originalHtml = element.innerHTML;

        this.insertMarkingSpansAroundEachChar(element);

        const markedSpans = element.querySelectorAll("span.temp");
        if (markedSpans.length <= 0) {
            return [];
        }

        const offsets: IOffsetInfo[] = [];
        for (let i = 0; i < markedSpans.length; ++i) {
            const span = markedSpans[i] as HTMLElement;
            const offsetInfo = {
                left: span.offsetLeft,
                right: span.offsetHeight + span.offsetWidth,
                top: span.offsetTop
            };
            offsets.push(offsetInfo);
        }

        element.innerHTML = originalHtml;
        return offsets;
    }

    private getLineStartIndices(offsets: IOffsetInfo[]): number[] {
        let prevOffsetTop: number = Number.NEGATIVE_INFINITY;
        const startIndices: number[] = [];
        for (let i = 0; i < offsets.length; ++i) {
            const offsetTop = offsets[i].top;
            // this.log(`${i}: ${offsetTop}`);

            // Keep track of the offsetTop of each line.
            // When we encounter a span with a greater offsetTop than the previous,
            // that's how we'll know we are at a new line.
            if (prevOffsetTop < offsetTop) {
                prevOffsetTop = offsetTop;
                startIndices.push(i);
            }
        }

        return startIndices;
    }

    private isOnFirstLine(anchorOffset: number, lineStartIndices: number[]) {
        if (lineStartIndices.length <= 0) {
            return false;
        } else if (lineStartIndices.length === 1) {
            // Apparently only one line. So yes, this is on the first line.
            console.assert(
                anchorOffset >= lineStartIndices[0],
                `anchorOffset (${anchorOffset}) was invalid. Expected >= ${lineStartIndices[0]}`
            );
            return true;
        }

        return anchorOffset < lineStartIndices[1];
    }

    private isOnLastLine(anchorOffset: number, lineStartIndices: number[]) {
        if (lineStartIndices.length <= 0) {
            return false;
        }

        const lastStartIndex = lineStartIndices[lineStartIndices.length - 1];
        return anchorOffset >= lastStartIndex;
    }

    private getCurrentOffsetX(anchorIndex: number, offsets: IOffsetInfo[]) {
        // Note that it's actually ok/expected for anchorOffset to be equal to length
        // (Normally, an array index must be strictly less than).
        // This indicates that the cursor is to the right of the last character.
        console.assert(
            0 <= anchorIndex && anchorIndex <= offsets.length,
            `anchorOffset should be in range [0, ${offsets.length}] but was: ${anchorIndex}`
        );

        if (anchorIndex < offsets.length) {
            return offsets[anchorIndex].left;
        } else {
            return offsets[offsets.length - 1].right;
        }
    }

    private getIndexClosestToTargetX(
        direction: "up" | "down",
        targetX: number,
        targetAnalysis: IAnalysis
    ): number | null {
        if (
            targetAnalysis.offsets.length <= 0 ||
            targetAnalysis.lineStartIndices.length <= 0
        ) {
            return null;
        }

        const relevantOffsets =
            direction === "up"
                ? this.getLastLineOffsets(targetAnalysis)
                : this.getFirstLineOffsets(targetAnalysis);

        this.log("targetX = " + targetX);
        let bestIndex: number | undefined = undefined;
        let lastDelta = Number.POSITIVE_INFINITY;
        for (let i = 0; i < relevantOffsets.length; ++i) {
            const left = relevantOffsets[i].left;
            const delta = Math.abs(left - targetX);
            this.log(`${i}: ${left} - ${targetX} = ${delta}`);

            // We assume that offsets is always arranged left to right.
            // That means once our absolute error starts increasing, there's no point going any further.
            if (delta > lastDelta) {
                this.log(`BREAK because log > 0`);
                bestIndex = i - 1;
                break;
            } else {
                lastDelta = delta;
            }
        }

        if (bestIndex === undefined) {
            bestIndex = relevantOffsets.length;
        }

        if (direction === "up") {
            // In this case, bestIndex is currently relative to start of the last line.
            // We need to make it relative to the start of the whole text.
            bestIndex +=
                targetAnalysis.lineStartIndices[
                    targetAnalysis.lineStartIndices.length - 1
                ];
        }

        return bestIndex;
    }

    private getFirstLineOffsets(analysis: IAnalysis): IOffsetInfo[] {
        if (analysis.lineStartIndices.length > 1) {
            return analysis.offsets.slice(0, analysis.lineStartIndices[1]);
        } else {
            return analysis.offsets;
        }
    }

    private getLastLineOffsets(analysis: IAnalysis): IOffsetInfo[] {
        if (analysis.lineStartIndices.length > 1) {
            const numLines = analysis.lineStartIndices.length;
            const lastStartIndex = analysis.lineStartIndices[numLines - 1];
            return analysis.offsets.slice(lastStartIndex);
        } else {
            return analysis.offsets;
        }
    }

    private insertMarkingSpansAroundEachChar(element: Element): void {
        const initialChildNodes = Array.from(element.childNodes);
        initialChildNodes.forEach(childNode => {
            if (childNode.nodeType === Node.TEXT_NODE) {
                const chars = Array.from(childNode.textContent!);
                const newInnerHtml = chars
                    .map(c => `<span class="temp">${c}</span>`)
                    .join("");
                childNode.parentElement!.innerHTML = newInnerHtml;
            } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                // Recursion.
                this.log(
                    "Recursive call on: " + (childNode as Element).outerHTML
                );
                this.insertMarkingSpansAroundEachChar(childNode as Element);
            } else {
                // Just ignore any other node types.
            }
        });
    }

    private getFirstTextNode(node: Node): Node | null {
        return this.getFirstOrLastTextNode(node, "first");
    }

    // Returns the last text node among the node itself or its descendants.
    // Last = right-most, if you were to draw it as a tree structure with the root on top.
    // If no text node could be found, then null will be returned.
    private getLastTextNode(node: Node): Node | null {
        return this.getFirstOrLastTextNode(node, "last");
    }

    private getFirstOrLastTextNode(
        node: Node,
        firstOrLast: "first" | "last"
    ): Node | null {
        if (node.hasChildNodes()) {
            const childNodes =
                firstOrLast === "first"
                    ? node.childNodes
                    : Array.from(node.childNodes).reverse();

            for (let i = 0; i < childNodes.length; ++i) {
                const lastTextNodeOfChild = this.getLastTextNode(
                    node.childNodes.item(i)
                );
                if (lastTextNodeOfChild) {
                    return lastTextNodeOfChild;
                }
                // else, continue through the loop and see if the next child node has a text child
            }

            // Well, we made it through all the children without finding a text node.
            // Guess we have to give up now.
            return null;
        } else {
            if (node.nodeType === Node.TEXT_NODE) {
                this.log("Found text node: " + node.textContent);
                return node;
            } else {
                return null;
            }
        }
    }

    private log(message: string): void {
        if (this.debug) {
            console.log(message);
        }
    }

    // private setWithin(x: number, min: number, max: number): number {
    //     console.assert(
    //         min <= x && x <= max,
    //         `x should be in range [${min}, ${max}] but was: ${x}`
    //     );
    //     x = Math.max(min, x);
    //     x = Math.min(x, max);
    //     return x;
    // }
}

interface IAnalysis {
    offsets: IOffsetInfo[];
    lineStartIndices: number[];
}

interface IOffsetInfo {
    // note: you could also record the index and character in here, if needed.
    left: number;
    right: number;
    top: number;
}
