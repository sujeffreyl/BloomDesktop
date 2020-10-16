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
                console.log("TODO: Implement me (elementNode)");
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
        const oldAnchor = new Anchor(sel.anchorNode!, sel.anchorOffset);

        // Limit it to text nodes inside paragraphs, for now.
        // Not really clear what should happen if it's not a paragraph,
        // or how we even arrive at that hypothetical state.
        const oldElement = oldAnchor.node.parentElement;
        if (!oldElement) {
            this.log("SKIP - oldElement was null.");
            return;
        }

        const oldParagraph = oldElement.closest("p");
        if (!oldParagraph) {
            this.log("SKIP - closestParagraph not found.");
            return;
        }

        const oldIndexFromStart = oldAnchor.convertToIndexFromStart(
            oldParagraph
        );
        if (oldIndexFromStart === null) {
            this.log("ABORT - oldIndexFromStart is null.");
            return;
        }

        const { offsets, lineStartIndices } = this.analyze(oldParagraph);
        this.log("lineStarts: " + JSON.stringify(lineStartIndices));

        if (direction === "up") {
            if (!this.isOnFirstLine(oldIndexFromStart, lineStartIndices)) {
                this.log(
                    `SKIP - Index ${oldIndexFromStart} not on first line (ending at ${lineStartIndices[1]})`
                );
                return;
            } else {
                this.log(
                    `Continue - Index ${oldIndexFromStart} is on first line`
                );
            }
        } else {
            if (!this.isOnLastLine(oldIndexFromStart, lineStartIndices)) {
                this.log(
                    `SKIP - Index ${oldIndexFromStart} not on last line (starting at ${
                        lineStartIndices[lineStartIndices.length - 1]
                    })`
                );
                return;
            } else {
                this.log(
                    `Continue - Index ${oldIndexFromStart} is on last line`
                );
            }
        }

        const targetX = this.getCurrentX(oldIndexFromStart, offsets);

        const anchor = this.getNewLocation(direction, oldParagraph, targetX);

        if (!anchor) {
            this.log("ABORT - Could not determine anchor");
            return;
        }

        this.setSelectionTo(sel, anchor.node, anchor.offset);

        // Hmm, for some reason, after modifying the selection, now the default seems to work
        // so now we need to prevent it in order to avoiding moving twice the desired amount.
        this.log("preventDefault called.");
        event.preventDefault();
    }

    private getNewLocation(
        direction: "up" | "down",
        oldParagraph: HTMLParagraphElement,
        targetX: number
    ): Anchor | null {
        const sibling =
            direction === "up"
                ? oldParagraph.previousSibling
                : oldParagraph.nextSibling;
        if (!sibling) {
            this.log("SKIP - sibling was null");
            return null;
        }

        const siblingElement =
            sibling.nodeType === Node.TEXT_NODE
                ? sibling.parentElement!
                : (sibling as Element);
        const newParagraph = siblingElement.closest("p");
        if (!newParagraph) {
            this.log("SKIP - newParagraph not found.");
            return null;
        }

        console.log("Analyzing newParagraph: " + newParagraph.outerHTML);
        const newAnalysis = this.analyze(newParagraph);
        const newIndex = this.getIndexClosestToTargetX(
            direction,
            targetX,
            newAnalysis
        );

        if (newIndex === null) {
            this.log("SKIP - newIndex is null.");
            return null;
        }

        console.log("newIndex = " + newIndex);

        const anchor = this.getAnchorAtIndex(newParagraph, newIndex);
        return anchor;
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

    private getOffsetsPerChar(element: Element): ICharPosInfo[] {
        // Note: If perf happesn to be an issue, this is the most expensive function perf-wise.
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
            this.log(`markedSpans.length = ${markedSpans.length}`);
            return [];
        }

        // Actually measure the position of each character
        const posInfos: ICharPosInfo[] = [];
        for (let i = 0; i < markedSpans.length; ++i) {
            const span = markedSpans[i] as HTMLElement;

            // Note: span.offsetLeft is relative to the immediate parent,
            // whereas getBoundingClientRect() is relative to the viewport.
            // That means the getBoundingClientRect() results are more easily compared.
            const bounds = span.getBoundingClientRect();
            const charPosInfo = {
                index: i,
                char: span.innerText,
                left: bounds.left,
                right: bounds.right,
                top: bounds.top
            };

            this.log(`Processing: ${JSON.stringify(charPosInfo)}`);
            posInfos.push(charPosInfo);
        }

        // Cleanup
        const updatedChildNodes = element.parentElement.childNodes;
        const lastChild = updatedChildNodes[updatedChildNodes.length - 1];
        const removed = element.parentElement.removeChild(lastChild);
        console.assert(removed, "removeChild failed.");

        return posInfos;
    }

    // // This version will mess up your Selection object.
    // private getOffsetsPerCharUnsafe(element: Element): IOffsetInfo[] {
    //     const originalHtml = element.innerHTML;

    //     this.insertMarkingSpansAroundEachChar(element);

    //     const markedSpans = element.querySelectorAll("span.temp");
    //     if (markedSpans.length <= 0) {
    //         return [];
    //     }

    //     const offsets: IOffsetInfo[] = [];
    //     for (let i = 0; i < markedSpans.length; ++i) {
    //         const span = markedSpans[i] as HTMLElement;
    //         const offsetInfo = {
    //             left: span.offsetLeft,
    //             right: span.offsetHeight + span.offsetWidth,
    //             top: span.offsetTop
    //         };
    //         offsets.push(offsetInfo);
    //     }

    //     element.innerHTML = originalHtml;
    //     return offsets;
    // }

    private getLineStartIndices(offsets: ICharPosInfo[]): number[] {
        //this.log("offsets: " + JSON.stringify(offsets));
        let prevOffsetTop: number = Number.NEGATIVE_INFINITY;
        let prevOffsetLeft: number = Number.POSITIVE_INFINITY;
        const startIndices: number[] = [];
        for (let i = 0; i < offsets.length; ++i) {
            const offset = offsets[i];
            // this.log(`${i}: ${offsetTop}`);

            // Note: Now we rely exclusively on horizontal.
            //   Vertical can differ slightly if some elements are nested in more elements than others.
            // Keep track of the offsetTop of each line.
            // When we encounter a span with a greater offsetTop than the previous,
            // that's how we'll know we are at a new line.
            const isVerticalPosChanged = prevOffsetTop < offset.top;

            // TODO: Cleanup
            // // Alternatively, if the horizontal offset has been reset, mark that as a new line too.
            // // (When we are processing spans inside the talking book spans, the offsetTop is always 0) :(
            // const isHorizontalPosReset = this.isLeftToRightLang
            //     ? offset.left <= prevOffsetLeft
            //     : offset.left >= prevOffsetLeft;

            if (isVerticalPosChanged) {
                startIndices.push(i);
            }

            prevOffsetLeft = offset.left;
            prevOffsetTop = offset.top;
        }

        return startIndices;
    }

    private isOnFirstLine(index: number, lineStartIndices: number[]) {
        if (lineStartIndices.length <= 0) {
            return false;
        } else if (lineStartIndices.length === 1) {
            // Apparently only one line. So yes, this is on the first line.
            console.assert(
                index >= lineStartIndices[0],
                `anchorOffset (${index}) was invalid. Expected >= ${lineStartIndices[0]}`
            );
            return true;
        }

        // Note: one awkward thing is that if the cursor is at the very end of the first line,
        // it has the same offset as if it were at the very beginning of the 2nd line.
        // Can't distinguish these cases. :(
        // For now, we'll live with allowing the default behavior if you're at the end of the 1st line.
        return index < lineStartIndices[1];
    }

    private isOnLastLine(index: number, lineStartIndices: number[]) {
        if (lineStartIndices.length <= 0) {
            return false;
        }

        const lastStartIndex = lineStartIndices[lineStartIndices.length - 1];
        return index >= lastStartIndex;
    }

    // Index should be the index from the start of the shared ancestor,
    // as opposed to the index from the start of the text node.
    private getCurrentX(index: number, offsets: ICharPosInfo[]) {
        this.log("getCurrentX called with anchorIndex = " + index);
        // Note that it's actually ok/expected for anchorOffset to be equal to length
        // (Normally, an array index must be strictly less than).
        // This indicates that the cursor is to the right of the last character.
        console.assert(
            0 <= index && index <= offsets.length,
            `anchorOffset should be in range [0, ${offsets.length}] but was: ${index}`
        );

        if (index < offsets.length) {
            return offsets[index].left;
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
        console.log(
            "Relevant offsets: " + relevantOffsets.map(x => x.char).join("")
        );
        let bestIndex = 0;
        let lastDelta = Number.POSITIVE_INFINITY;
        for (let i = 0; i < relevantOffsets.length; ++i) {
            const left = relevantOffsets[i].left;
            const delta = Math.abs(left - targetX);
            this.log(
                `${i} (${relevantOffsets[i].char}): ${left} - ${targetX} = ${delta}`
            );

            // We assume that offsets is always arranged left to right.
            // That means once our absolute error starts increasing, there's no point going any further.
            if (delta > lastDelta) {
                this.log(`BREAK because ${delta} > ${lastDelta}`);
                bestIndex = i - 1;
                break;
            } else {
                lastDelta = delta;
            }

            // On the last char, need to decide what to assign to bestIndex
            if (i === relevantOffsets.length - 1) {
                // Need to decide whether to return to the left or right of the last char
                const deltaEnd = Math.abs(relevantOffsets[i].right - targetX);
                bestIndex = delta < deltaEnd ? i : i + 1;
                break;
            }
        }

        if (direction === "up") {
            this.log("bestIndex (relative to last line): " + bestIndex);
            // In this case, bestIndex is currently relative to start of the last line.
            // We need to make it relative to the start of the whole text.
            bestIndex +=
                targetAnalysis.lineStartIndices[
                    targetAnalysis.lineStartIndices.length - 1
                ];
        }

        return bestIndex;
    }

    private getFirstLineOffsets(analysis: IAnalysis): ICharPosInfo[] {
        if (analysis.lineStartIndices.length > 1) {
            return analysis.offsets.slice(0, analysis.lineStartIndices[1]);
        } else {
            return analysis.offsets;
        }
    }

    private getLastLineOffsets(analysis: IAnalysis): ICharPosInfo[] {
        if (analysis.lineStartIndices.length > 1) {
            const numLines = analysis.lineStartIndices.length;
            const lastStartIndex = analysis.lineStartIndices[numLines - 1];
            return analysis.offsets.slice(lastStartIndex);
        } else {
            return analysis.offsets;
        }
    }

    private insertMarkingSpansAroundEachChar(element: Element): void {
        // ENHANCE: In the 1st call to this function, you only need markingSpans up to oldIndexFromStart.
        const initialChildNodes = Array.from(element.childNodes);
        initialChildNodes.forEach(childNode => {
            if (childNode.nodeType === Node.TEXT_NODE) {
                const chars = Array.from(childNode.textContent!);

                chars.forEach(c => {
                    const tempSpan = document.createElement("span");
                    tempSpan.classList.add("temp");
                    tempSpan.innerText = c;

                    childNode.parentElement!.insertBefore(tempSpan, childNode);
                });

                childNode.parentElement!.removeChild(childNode);
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

    // private getFirstTextNode(node: Node): Node | null {
    //     return this.getFirstOrLastTextNode(node, "first");
    // }

    // // Returns the last text node among the node itself or its descendants.
    // // Last = right-most, if you were to draw it as a tree structure with the root on top.
    // // If no text node could be found, then null will be returned.
    // private getLastTextNode(node: Node): Node | null {
    //     return this.getFirstOrLastTextNode(node, "last");
    // }

    // private getFirstOrLastTextNode(
    //     node: Node,
    //     firstOrLast: "first" | "last"
    // ): Node | null {
    //     if (node.hasChildNodes()) {
    //         const childNodes =
    //             firstOrLast === "first"
    //                 ? node.childNodes
    //                 : Array.from(node.childNodes).reverse();

    //         for (let i = 0; i < childNodes.length; ++i) {
    //             const lastTextNodeOfChild = this.getLastTextNode(
    //                 node.childNodes.item(i)
    //             );
    //             if (lastTextNodeOfChild) {
    //                 return lastTextNodeOfChild;
    //             }
    //             // else, continue through the loop and see if the next child node has a text child
    //         }

    //         // Well, we made it through all the children without finding a text node.
    //         // Guess we have to give up now.
    //         return null;
    //     } else {
    //         if (node.nodeType === Node.TEXT_NODE) {
    //             this.log("Found text node: " + node.textContent);
    //             return node;
    //         } else {
    //             return null;
    //         }
    //     }
    // }

    private getAnchorAtIndex(node: Node, index: number): Anchor | null {
        const val = this.getAnchorAtIndexHelper(node, index);
        return val.anchor ?? null;
    }

    // Either anchor or numCharsProcessed will be set, but not both and not neither
    private getAnchorAtIndexHelper(
        node: Node,
        index: number
    ): { anchor?: Anchor; numCharsProcessed?: number } {
        if (node.nodeType === Node.TEXT_NODE) {
            // Base Case
            // FYI: TextNodes are always leaf nodes and don't have any childNodes

            if (!node.textContent) {
                return { numCharsProcessed: 0 };
            }

            const numCharsProcessed = this.setWithin(
                index,
                0,
                node.textContent.length
            );

            if (numCharsProcessed === index) {
                return {
                    anchor: new Anchor(node, index)
                };
            } else {
                return {
                    numCharsProcessed
                };
            }
        } else if (node.hasChildNodes()) {
            let numCharsProcessed = 0;
            for (let i = 0; i < node.childNodes.length; ++i) {
                const childNode = node.childNodes.item(i);
                const adjustedIndex = index - numCharsProcessed;
                const val = this.getAnchorAtIndexHelper(
                    childNode,
                    adjustedIndex
                );
                if (val.anchor) {
                    // The final result was successfully found. Just propagate it up the stack.
                    this.log("Returning anchor: " + val.anchor.offset);
                    return val;
                }

                // else, mark down the number of chars checked so far, then continue to the next child.
                this.log(
                    `Recursive call consumed ${val.numCharsProcessed!} chars.`
                );
                numCharsProcessed += val.numCharsProcessed!;
            }

            // Well, we made it through all the children without finding a text node.
            // Guess we have to give up now.
            return { numCharsProcessed };
        } else {
            return { numCharsProcessed: 0 };
        }
    }

    private log(message: string): void {
        if (this.debug) {
            console.log(message);
        }
    }

    private setWithin(x: number, min: number, max: number): number {
        x = Math.max(min, x);
        x = Math.min(x, max);
        return x;
    }

    private setAndAssertWithin(x: number, min: number, max: number): number {
        console.assert(
            min <= x && x <= max,
            `x should be in range [${min}, ${max}] but was: ${x}`
        );
        return this.setWithin(x, min, max);
    }
}

interface IAnalysis {
    offsets: ICharPosInfo[];
    lineStartIndices: number[];
}

interface ICharPosInfo {
    index: number; // Not strictly needed. Just for debugging convenience.
    char: string; // Not strictly needed. Just for debugging convenience.
    left: number;
    right: number;
    top: number;
}

export class Anchor {
    public node: Node;
    public offset: number;

    public constructor(node: Node, offset: number) {
        this.node = node;
        this.offset = offset;
    }

    public convertToIndexFromStart(startElement: Element): number | null {
        const val = this.convertToIndexFromStartHelper(startElement, 0);
        return val.answer ?? null;
    }

    private convertToIndexFromStartHelper(
        startNode: Node,
        accumulator: number
    ): { answer?: number; numCharsProcessed?: number } {
        if (startNode === this.node) {
            // Base Case
            return {
                answer: accumulator + this.offset
            };
        } else if (startNode.hasChildNodes()) {
            let numCharsProcessed = 0;
            for (let i = 0; i < startNode.childNodes.length; ++i) {
                const child = startNode.childNodes.item(i);
                const val = this.convertToIndexFromStartHelper(
                    child,
                    accumulator + numCharsProcessed
                );

                // Careful! answer can be 0, which evaluates to falsy.
                if (val.answer !== undefined) {
                    // The final result was successfully found. Just propagate it up the stack.
                    return val;
                }

                // else, mark down the number of chars checked so far, then continue to the next child.
                numCharsProcessed += val.numCharsProcessed!;
            }

            return { numCharsProcessed };
        } else if (startNode.nodeType === Node.TEXT_NODE) {
            const numCharsProcessed = startNode.textContent?.length ?? 0;
            return { numCharsProcessed };
        } else {
            return { numCharsProcessed: 0 };
        }
    }
}
