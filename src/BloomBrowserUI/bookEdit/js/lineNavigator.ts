// This handler should be in a keydown event, not a keyup event.
// If you use keyup, the selection will already have changed by the time you get the event.
// But we would like to know the selection before pressing the arrow key.
export function fixUpDownArrowEventHandler(keyEvent: KeyboardEvent): void {
    const lineNav = new LineNavigator();
    lineNav.handleUpDownArrowsInFlexboxEditables(keyEvent);
}

export class LineNavigator {
    private debug: boolean = false;

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

        //this.printCharPosition(oldParagraph);
        //const { offsets, lineStartIndices } = this.analyze(oldParagraph);
        // this.log("lineStarts: " + JSON.stringify(lineStartIndices));
        const analysis = this.analyzeCurrentPosition(
            direction,
            oldParagraph,
            oldIndexFromStart
        );
        if (!analysis) {
            this.log("SKIP - Error analyzing current position.");
            return;
        }

        // if (direction === "up") {
        //     if (!this.isOnFirstLine(oldParagraph, oldIndexFromStart)) {
        //         this.log(
        //             `SKIP - Index ${oldIndexFromStart} not on first line)`
        //         );
        //         return;
        //     } else {
        //         this.log(
        //             `Continue - Index ${oldIndexFromStart} is on first line`
        //         );
        //     }
        // } else {
        //     //if (!this.isOnLastLineOld(oldIndexFromStart, lineStartIndices)) {
        //     if (!this.isOnLastLine(oldParagraph, oldIndexFromStart)) {
        //         this.log(`SKIP - Index ${oldIndexFromStart} not on last line`);
        //         return;
        //     } else {
        //         this.log(
        //             `Continue - Index ${oldIndexFromStart} is on last line`
        //         );
        //     }
        // }
        if (!analysis.isOnBoundary) {
            this.log(
                `SKIP - Index ${oldIndexFromStart} not on first/last line`
            );
            return;
        } else {
            this.log(
                `Continue - Index ${oldIndexFromStart} on first or last line.`
            );
        }

        const targetX = analysis.currentX;
        this.log(`targetX = ${targetX}`);

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

        this.log("Analyzing newParagraph: " + newParagraph.outerHTML);
        //const newAnalysis = this.analyze(newParagraph);
        //this.printCharPosition(newParagraph);
        // const newIndex = this.getIndexClosestToTargetXOld(
        //     direction,
        //     targetX,
        //     newAnalysis
        // );

        const newAnchor = this.getAnchorClosestToTargetX(
            direction,
            newParagraph,
            targetX
        );

        // if (newIndex === null) {
        //     this.log("SKIP - newIndex is null.");
        //     return null;
        // }

        // console.log("newIndex = " + newIndex);

        //const anchor = this.getAnchorAtIndex(newParagraph, newIndex);
        return newAnchor;
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
            this.log(`${prefix}TextNode: "${node.textContent}"`);
        } else {
            this.log(`${prefix}ElementNode: ${(node as Element).outerHTML}`);
        }
    }

    public static printNode(
        node: Node | null | undefined,
        prefix: string = ""
    ) {
        if (node === undefined) {
            console.log(`${prefix}Undefined`);
        } else if (node === null) {
            console.log(`${prefix}Null`);
        } else if (node.nodeType === Node.TEXT_NODE) {
            console.log(`${prefix}TextNode: "${node.textContent}"`);
        } else {
            console.log(`${prefix}ElementNode: ${(node as Element).outerHTML}`);
        }
    }

    public static printCharPositions(element: Element): void {
        const myNav = new LineNavigator();
        myNav.debug = true;

        if (!element.parentElement) {
            return;
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
        myNav.insertMarkingSpansAroundEachChar(clone);

        const markedSpans = clone.querySelectorAll("span.temp");
        if (markedSpans.length <= 0) {
            return;
        }

        // Actually measure the position of each character
        for (let i = 0; i < markedSpans.length; ++i) {
            const span = markedSpans[i] as HTMLElement;

            // Note: span.offsetLeft is relative to the immediate parent,
            // whereas getBoundingClientRect() is relative to the viewport.
            // That means the getBoundingClientRect() results are more easily compared.
            const bounds = span.getBoundingClientRect();
            // const charPosInfo = {
            //     index: i,
            //     char: span.innerText,
            //     left: bounds.left,
            //     right: bounds.right,
            //     top: bounds.top
            // };

            console.log(
                `index:\t${i}\tchar:\t${span.innerText}\tleft:\t${Math.round(
                    bounds.left
                )}\tright:\t${Math.round(bounds.right)}\ttop:\t${Math.round(
                    bounds.top
                )}`
            );
            //this.log(`Processing: ${JSON.stringify(charPosInfo)}`);
            //posInfos.push(charPosInfo);
        }

        // Cleanup
        const updatedChildNodes = element.parentElement.childNodes;
        const lastChild = updatedChildNodes[updatedChildNodes.length - 1];
        const removed = element.parentElement.removeChild(lastChild);
        console.assert(removed, "removeChild failed.");
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

    // TODO: Test how effective this function is.
    private analyzeCurrentPosition(
        direction: "up" | "down",
        ancestor: Element,
        index: number
    ) {
        this.log(
            `Calling analyzeCurrentPosition(${direction}, ${index}) on node: `
        );
        this.printNode(ancestor, "\t[ancestor]");

        const clone = ancestor.cloneNode(true);
        ancestor.parentElement!.appendChild(clone);

        const action = (node, index) => {
            console.assert(node, `Node should not be null. Index=${index}`);
            return {
                node,
                indexWithinNode: index
            };
        };
        //this.debug = false;
        const val1 =
            direction === "up"
                ? this.doActionAtIndex(clone, 0, action, "\t\t")
                : this.doActionAtLastIndex(clone, action, "\t\t");

        if (!val1.actionPerformed) {
            return undefined;
        }

        //this.debug = true;
        const val2 = this.doActionAtIndex(clone, index, action, "\t\t");

        if (!val2.actionPerformed && !val2.isAtEndOfNode) {
            return undefined;
        }

        const textNode1 = val1.actionResult.node as Node;
        const index1 = val1.actionResult.indexWithinNode;

        let textNode2: Node;
        let index2: number;
        if (!val2.isAtEndOfNode) {
            // Normal case
            textNode2 = val2.actionResult.node as Node;
            index2 = val2.actionResult.indexWithinNode;
        } else {
            // Special processing if it's to the right of the last char
            const last = val2.lastIndex!;
            textNode2 = last.node;
            index2 = last.indexWithinNode;
        }

        let position1: ICharPosInfo;
        let position2: ICharPosInfo;
        if (textNode1 !== textNode2) {
            this.log(`\tCase 1: index1=${index1}, index2=${index2}`);
            const parent1 = this.insertMarkingSpansInNode(textNode1, index1);
            position1 = this.getPosOfNthMarkingSpan(parent1, index1);

            // Remove the marking spans (sort of) just enough for it not to interfere
            // with getting the position of the next item.
            // (even though textNode1 !== textNode2, parent1 could still equal parent2
            parent1.querySelectorAll("span.temp").forEach(matchingElem => {
                matchingElem.classList.remove("temp");
            });

            const parent2 = this.insertMarkingSpansInNode(textNode2, index2);
            position2 = this.getPosOfNthMarkingSpan(parent2, index2);
        } else {
            // A more complicated version that avoids marking up the same textNode twice.
            this.log("\tCase 2");
            const higherIndex = Math.max(index1, index2);
            const parent = this.insertMarkingSpansInNode(
                textNode1,
                higherIndex
            );
            this.printNode(parent, "\t\t[parent, After] ");

            position1 = this.getPosOfNthMarkingSpan(parent, index1);
            position2 = this.getPosOfNthMarkingSpan(parent, index2);
        }

        // Completely remove the temporary clone and with it, the marking spans in it
        ancestor.parentElement!.removeChild(clone);

        const currentX = !val2.isAtEndOfNode ? position2.left : position2.right;
        const y1 = position1.top;
        const y2 = position2.top;

        this.log(`y1=${y1} vs. y2=${y2}`);

        const isOnBoundary = this.isOnSameLine(y1, y2);
        return {
            isOnBoundary,
            currentX
        };
    }

    private isOnSameLine(y1, y2, toleranceInPixels = 1): boolean {
        return Math.abs(y1 - y2) < toleranceInPixels;
    }

    // Our goal is to create as few spans as possible
    // Returns the parent element which contains the marking spans.
    // Precondition: node must have a parentElement.
    private insertMarkingSpansInNode(node: Node, index?: number): HTMLElement {
        const parent = node.parentElement!;

        if (!node.textContent) {
            return parent;
        }

        const relevantText = index
            ? node.textContent.slice(0, index + 1)
            : node.textContent;
        const remainingText = index ? node.textContent.slice(index + 1) : "";
        const chars = Array.from(relevantText);

        chars.forEach(c => {
            const tempSpan = document.createElement("span");
            tempSpan.classList.add("temp");
            tempSpan.innerText = c;

            parent.insertBefore(tempSpan, node);
        });

        if (remainingText) {
            const remTextNode = document.createTextNode(remainingText);
            parent.insertBefore(remTextNode, node);
        }

        parent.removeChild(node);

        return parent;
    }

    private getPosOfNthMarkingSpan(
        parentElement: Element,
        n: number
    ): ICharPosInfo {
        this.log("Calling getPosOfNthMarkingSpan. n= " + n + ", Node is: ");
        this.printNode(parentElement);
        const markingSpans = parentElement.querySelectorAll("span.temp");
        console.assert(markingSpans.length > n);
        if (markingSpans.length <= n) {
            this.log(
                "Not enough marking spans found. n= " + n + ", parentElement: "
            );
            this.printNode(parentElement, "[parentElement]");
        }
        const span = markingSpans.item(n);
        const bounds = span.getBoundingClientRect();
        return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top
        };
    }

    // private isOnFirstLineOld(index: number, lineStartIndices: number[]) {
    //     if (lineStartIndices.length <= 0) {
    //         return false;
    //     } else if (lineStartIndices.length === 1) {
    //         // Apparently only one line. So yes, this is on the first line.
    //         console.assert(
    //             index >= lineStartIndices[0],
    //             `anchorOffset (${index}) was invalid. Expected >= ${lineStartIndices[0]}`
    //         );
    //         return true;
    //     }

    //     // Note: one awkward thing is that if the cursor is at the very end of the first line,
    //     // it has the same offset as if it were at the very beginning of the 2nd line.
    //     // Can't distinguish these cases. :(
    //     // For now, we'll live with allowing the default behavior if you're at the end of the 1st line.
    //     return index < lineStartIndices[1];
    // }

    // private isOnLastLineOld(index: number, lineStartIndices: number[]) {
    //     if (lineStartIndices.length <= 0) {
    //         return false;
    //     }

    //     const lastStartIndex = lineStartIndices[lineStartIndices.length - 1];
    //     return index >= lastStartIndex;
    // }

    // Index should be the index from the start of the shared ancestor,
    // as opposed to the index from the start of the text node.
    // private getCurrentXOld(index: number, offsets: ICharPosInfo[]) {
    //     this.log("getCurrentX called with anchorIndex = " + index);
    //     // Note that it's actually ok/expected for anchorOffset to be equal to length
    //     // (Normally, an array index must be strictly less than).
    //     // This indicates that the cursor is to the right of the last character.
    //     console.assert(
    //         0 <= index && index <= offsets.length,
    //         `anchorOffset should be in range [0, ${offsets.length}] but was: ${index}`
    //     );

    //     if (index < offsets.length) {
    //         return offsets[index].left;
    //     } else {
    //         return offsets[offsets.length - 1].right;
    //     }

    // }

    private getAnchorClosestToTargetX(
        direction: "up" | "down",
        newAncestor: Element,
        targetX: number
    ): Anchor | null {
        let anchor: Anchor | null = null;

        // You need to mark up one node at a time, check if you've reached the stopping condition,
        // and return or keep processing as needed.
        const clone = newAncestor.cloneNode(true) as Element;
        newAncestor.parentElement!.appendChild(clone);
        try {
            let expectedTop: number | undefined = undefined;
            let bestIndexWithinNode = 0;
            let lastDelta = Number.POSITIVE_INFINITY;
            let bestNode: Node | undefined; // Should stay undefined until we compute the right answer.

            let numTimesInLoop = 0;
            const nodeStack: Node[] = [clone];
            while (nodeStack.length > 0) {
                if (this.debug) {
                    ++numTimesInLoop;
                    if (numTimesInLoop > 10000) {
                        throw new Error(
                            "probable infinite loop. nodeStack.length = " +
                                nodeStack.length
                        );
                    }
                }
                const current = nodeStack.pop();

                if (!current) {
                    continue;
                }

                if (current.nodeType === Node.TEXT_NODE) {
                    // Leaf node. Insert marking spans into it and see if we're close enough.
                    const parent = current.parentElement!;

                    this.insertMarkingSpansInNode(current);
                    const markingSpans = parent.querySelectorAll("span.temp");

                    let bestForCurrent: Node | undefined;
                    for (let i = 0; i < markingSpans.length; ++i) {
                        const adjustedIndex =
                            direction === "up"
                                ? markingSpans.length - 1 - i
                                : i;
                        const span = markingSpans[adjustedIndex];

                        const bounds = span.getBoundingClientRect();
                        const top = bounds.top;

                        if (expectedTop === undefined) {
                            expectedTop = top;
                        }

                        if (i === 0) {
                            bestForCurrent = span;

                            if (direction === "up") {
                                // We'll be processing these right to left.
                                // ENHANCE: Handle RTLlanguages?
                                // I think you would want bounds.left here instead.
                                // I think that's just an off by one error if you're supposed to match the end.
                                // That's not too terrible.
                                lastDelta = Math.abs(bounds.right - targetX);
                                bestIndexWithinNode = 1;
                            } else {
                                // We'll be processing these left to right.
                                bestIndexWithinNode = 0;
                            }
                        }

                        const left = bounds.left;
                        const delta = Math.abs(left - targetX);

                        if (this.isOnSameLine(top, expectedTop)) {
                            // This character is still on relevant line.
                            this.log(
                                `${adjustedIndex} (${span.innerHTML}): ${left} - ${targetX} = ${delta}`
                            );

                            // We assume that spans is always arranged left to right.
                            // That means once our absolute error starts increasing, there's no point going any further.
                            if (delta > lastDelta) {
                                this.log(
                                    `BREAK because ${delta} > ${lastDelta}`
                                );
                                console.assert(bestForCurrent != null);
                                bestNode = bestForCurrent;
                                break;
                            } else {
                                lastDelta = delta;
                                bestForCurrent = span;
                                bestIndexWithinNode = 0;
                            }
                        } else {
                            // No longer on relevant line.
                            if (direction === "down") {
                                // Up direction: No fancy checks necessary
                                bestNode = bestForCurrent;
                                // bestIndexWithinNode = 0;
                            } else {
                                // Down direction: Need to decide whether to return to the left or right of this char
                                const deltaEnd = Math.abs(
                                    bounds.right - targetX
                                );
                                bestNode = span;
                                bestIndexWithinNode = delta < deltaEnd ? 0 : 1;
                            }
                            break;
                        }
                    }

                    if (bestNode) {
                        break;
                    } else {
                        // Clean up enough so that you don't mess up the next iteration.
                        markingSpans.forEach(span => {
                            span.classList.remove("temp");
                        });
                    }
                } else if (current.hasChildNodes()) {
                    const childCount = current.childNodes.length;

                    // Note: since this is a "stack", the next element to process should be at the array's end.
                    const oldCount = nodeStack.length;
                    nodeStack.length += childCount;
                    for (let i = 0; i < childCount; ++i) {
                        const adjustedIndex =
                            direction === "up" ? i : childCount - 1 - i;
                        nodeStack[oldCount + i] = current.childNodes.item(
                            adjustedIndex
                        );
                    }

                    continue;
                } else {
                    // Just ignore leaf nodes with other attribute types.
                    continue;
                }

                // // TODO: Get rid of me.
                // break;
            }

            // This points into our temp node, but we need to point into our original node...
            this.printNode(bestNode, "[bestTextNode]");
            const tempAnchor = new Anchor(bestNode!, bestIndexWithinNode);

            const bestIndex = tempAnchor.convertToIndexFromStart(clone);
            this.log("BestIndex = " + bestIndex);
            anchor = this.getAnchorAtIndex(newAncestor, bestIndex!);
        } finally {
            // TODO: Maybe the other similar places should get a finally.
            clone.remove();
        }

        return anchor;
    }

    private getIndexClosestToTargetXOld(
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

        this.log(
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

    private getAnchorAtIndex(node: Node, index: number): Anchor | null {
        const action = (node, index) => {
            return new Anchor(node, index);
        };
        const val = this.doActionAtIndex(node, index, action);

        if (val.actionPerformed) {
            return val.actionResult as Anchor;
        } else if (val.isAtEndOfNode) {
            const lastIndex = val.lastIndex!;
            return new Anchor(lastIndex.node, lastIndex.indexWithinNode + 1);
        } else {
            return null;
        }
    }

    // Applies an action at the specified index.
    private doActionAtIndex(
        node: Node,
        index: number,
        action: (node: Node, index: number, char: string) => any,
        logPrefix: string = ""
    ): {
        actionPerformed?: boolean;
        actionResult?: any;
        numCharsProcessed?: number;
        isAtEndOfNode?: boolean; // True if the index points to the exact end of the last thing in the node
        // If isAtEndOfNode is true, then this will be set to point to the last character within the node.
        // (Note: the end of the node is 1 past lastIndex.indexWithinNode)
        lastIndex?: {
            node: Node;
            indexWithinNode: number;
            char: string;
        };
    } {
        this.log(`${logPrefix}Calling doActionAtIndex with index = ${index}`);
        this.printNode(node, `${logPrefix}[node]=`);
        if (node.nodeType === Node.TEXT_NODE) {
            // Base Case
            // FYI: TextNodes are always leaf nodes and don't have any childNodes

            if (!node.textContent || node.textContent.length <= 0) {
                this.log(`${logPrefix}RETURN: 0 (BaseCase1)`);
                return { numCharsProcessed: 0 };
            } else if (index < node.textContent.length) {
                // Note: Theoretically, one should only apply an action if index is strictly less than the length.
                // But if you're dealing with offsets, it may also validly represent the case where it is to the right
                // of the last character as index = length, in which case you would be OK with applying the action here
                const char = node.textContent.charAt(index);
                const actionResult = action(node, index, char);
                this.log(`${logPrefix}RETURN: actionResult (BaseCase2)`);
                return {
                    actionPerformed: true,
                    actionResult
                };
            } else if (index === node.textContent.length) {
                this.log(
                    `${logPrefix}RETURN: ${node.textContent.length} (BaseCase4)`
                );
                return {
                    numCharsProcessed: node.textContent.length,
                    isAtEndOfNode: true,
                    lastIndex: {
                        node,
                        indexWithinNode: index - 1,
                        char: node.textContent.charAt(index - 1)
                    }
                };
            } else {
                // That is, index > allowed index
                this.log(
                    `${logPrefix}RETURN: ${node.textContent.length} (BaseCase4)`
                );
                return { numCharsProcessed: node.textContent.length };
            }
        } else if (node.hasChildNodes()) {
            const numChildren = node.childNodes.length;
            this.log(
                `${logPrefix}Recursively processing ${numChildren} children.`
            );
            const result: any = {};
            let numCharsProcessed = 0;
            for (let i = 0; i < numChildren; ++i) {
                this.log(`${logPrefix}i=${i}`);
                const childNode = node.childNodes.item(i);
                const adjustedIndex = index - numCharsProcessed;
                const val = this.doActionAtIndex(
                    childNode,
                    adjustedIndex,
                    action,
                    logPrefix + "\t"
                );
                if (val.actionPerformed) {
                    this.log(
                        `${logPrefix}actionPerformed = true, returning up the stack.`
                    );
                    return val;
                }
                // Else: No action performed yet.

                if (val.numCharsProcessed! > 0) {
                    // If we processed any chars, reset isAtEndOfNode to whatever val retursn.
                    result.isAtEndOfNode = val.isAtEndOfNode;
                    result.lastIndex = val.lastIndex;
                }

                // Mark down the number of chars checked so far, then continue to the next child.
                numCharsProcessed += val.numCharsProcessed!;
                this.log(
                    `${logPrefix}Recursive call consumed ${val.numCharsProcessed!} chars. numChars now = ${numCharsProcessed}`
                );
            }

            result.numCharsProcessed = numCharsProcessed;
            return result;
        } else {
            this.log(`${logPrefix}Unknown case, returning numCharsProcessed=0`);
            return { numCharsProcessed: 0 };
        }
    }

    // Applies an action at the specified index.
    private doActionAtLastIndex(
        node: Node,
        action: (node: Node, index: number, char: string) => any,
        logPrefix: string = ""
    ): {
        actionPerformed?: boolean;
        actionResult?: any;
    } {
        this.log(`${logPrefix}Calling doActionAtLastIndex`);
        this.printNode(node, `${logPrefix}[node]=`);
        if (node.nodeType === Node.TEXT_NODE) {
            // Base Case
            // FYI: TextNodes are always leaf nodes and don't have any childNodes

            if (!node.textContent || node.textContent.length <= 0) {
                this.log(`${logPrefix}RETURN: false (BaseCase1)`);
                return { actionPerformed: false };
            } else {
                const index = node.textContent.length - 1;
                const char = node.textContent.charAt(index);
                const actionResult = action(node, index, char);
                return {
                    actionPerformed: true,
                    actionResult
                };
            }
        } else if (node.hasChildNodes()) {
            this.log(
                `${logPrefix}Recursively processing ${node.childNodes.length} children.`
            );
            for (let i = node.childNodes.length - 1; i >= 0; --i) {
                this.log(`${logPrefix}i=${i}`);
                const childNode = node.childNodes.item(i);
                const val = this.doActionAtLastIndex(
                    childNode,
                    action,
                    logPrefix + "\t"
                );
                if (val.actionPerformed) {
                    this.log(
                        `${logPrefix}actionPerformed = true, returning up the stack.`
                    );
                    return val;
                }
                // else, continue to the next child.
            }

            // Went thru all the children w/o applying any actions.
            return { actionPerformed: false };
        } else {
            this.log(`${logPrefix}Unknown case`);
            return { actionPerformed: false };
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
    // TODO: Cleanup interface
    //index: number; // Not strictly needed. Just for debugging convenience.
    char?: string; // Not strictly needed. Just for debugging convenience.
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
        // console.log(
        //     "convertToIndexFromStartHelper called, accumulator = " + accumulator
        // );
        //LineNavigator.printNode(startNode, "[startNode]");

        if (startNode === this.node) {
            // Base Case
            //console.log("BASE CASE reached.");
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
