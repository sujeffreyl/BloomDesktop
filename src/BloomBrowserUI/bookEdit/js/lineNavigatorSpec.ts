import {
    Anchor,
    fixUpDownArrowEventHandler,
    LineNavigator
} from "./lineNavigator";

const kArrowUp = "ArrowUp";
const kArrowDown = "ArrowDown";
const kNoAudio = "NoAudio";
const kSentence = "Sentence";

fdescribe("LineNavigator Tests", () => {
    // Debugging tip: LineNavigator.printCharPositions(editable) can help you see if the test case is line-wrapping the way you want it to.

    function runLineNavTest(
        setup: () => HTMLElement,
        verify: () => void,
        key: "ArrowUp" | "ArrowDown"
    ) {
        const elementToSendEventTo = setup();

        sendKeyboardEvent(elementToSendEventTo, key);

        verify();

        cleanupDocument();
    }

    function runPreventDefaultTest(
        direction: "ArrowUp" | "ArrowDown",
        setup: () => HTMLElement,
        expectation: boolean
    ) {
        const element = setup();

        let myEvent: KeyboardEvent | undefined;
        const spySetup = (event: KeyboardEvent) => {
            myEvent = event;
            spyOn(event, "preventDefault");
        };

        // System under test
        sendKeyboardEvent(element, direction, spySetup);

        // Verification
        if (expectation) {
            expect(myEvent!.preventDefault).toHaveBeenCalled();
        } else {
            expect(myEvent!.preventDefault).not.toHaveBeenCalled();
        }

        // Cleanup
        cleanupDocument();
    }

    function runScenarioTest(
        key: "ArrowUp" | "ArrowDown",
        scenario: 1 | 2,
        getAnchorNode: () => Node, // Needs to be a function so that it can be deferred until after setup.
        initialOffset: number,
        expectedText: string,
        talkingBookSetting: "NoAudio" | "Sentence"
    ) {
        const setup = () => {
            const editable =
                scenario === 1
                    ? setupScenario1(talkingBookSetting)
                    : setupScenario2(talkingBookSetting);

            // Optional - Make sure the layout got setup properly.
            const styleInfo = window.getComputedStyle(editable);
            expect(styleInfo.flexWrap).toEqual(
                "wrap",
                "Flexwrap not setup properly."
            );
            expect(styleInfo.textAlign).toEqual(
                "center",
                "text-align not setup properly."
            );

            // Uncomment for help in debugging.
            //LineNavigator.printCharPositions(editable);

            setSelectionTo(getAnchorNode(), initialOffset);

            return editable;
        };

        const verify = () => {
            const sel2 = window.getSelection();
            verifySelectionText(sel2, expectedText);
        };

        runLineNavTest(setup, verify, key);
    }

    function runScenario1Test(
        key: "ArrowUp" | "ArrowDown",
        getAnchorNode: () => Node, // Needs to be a function so that it can be deferred until after setup.
        initialOffset: number,
        expectedText: string,
        talkingBookSetting: "NoAudio" | "Sentence"
    ) {
        runScenarioTest(
            key,
            1,
            getAnchorNode,
            initialOffset,
            expectedText,
            talkingBookSetting
        );
    }

    function runScenario2Test(
        key: "ArrowUp" | "ArrowDown",
        getAnchorNode: () => Node, // Needs to be a function so that it can be deferred until after setup.
        initialOffset: number,
        expectedText: string,
        talkingBookSetting: "NoAudio" | "Sentence"
    ) {
        runScenarioTest(
            key,
            2,
            getAnchorNode,
            initialOffset,
            expectedText,
            talkingBookSetting
        );
    }

    function sendKeyboardEvent(
        element: HTMLElement,
        key: "ArrowUp" | "ArrowDown",
        // If defined, eventSpySetup will be called after keyEvent is created.
        // This gives you an opportunity to attach a spy to it if you wish to observe what happesn to it
        // e.g if a certain function was called on it, etc.
        eventSpySetup?: (keyEvent: KeyboardEvent) => void
    ) {
        element.onkeydown = fixUpDownArrowEventHandler;

        const event = new KeyboardEvent("keydown", {
            key
        });
        if (eventSpySetup) {
            eventSpySetup(event);
        }

        element.dispatchEvent(event);
    }

    function verifySelection(
        selection: Selection | null,
        anchorNode: Node,
        offset: number
    ) {
        expect(selection).not.toBeNull();
        if (selection) {
            expect(selection.anchorNode).toEqual(
                anchorNode,
                "AnchorNode does not match."
            );
            expect(selection.anchorOffset).toEqual(
                offset,
                "anchorOffset does not match."
            );
        }
    }

    function verifySelectionText(
        selection: Selection | null,
        expectedTextFromAnchor: string
    ) {
        expect(selection).not.toBeNull();
        if (selection) {
            const text = selection.anchorNode?.textContent;
            const textFromAnchor = text?.substring(selection.anchorOffset);
            expect(textFromAnchor).toEqual(expectedTextFromAnchor);
        }
    }

    function setupScenario1(
        talkingBookSetting: "NoAudio" | "Sentence",
        isFlex: boolean = true
    ) {
        const phrase1 = "111111111111";
        const phrase2 = "222.";
        const p1Text = `${phrase1} ${phrase2}`;

        let p1Inner: string;
        let p2Inner: string;
        if (talkingBookSetting === "NoAudio") {
            p1Inner = p1Text;

            p2Inner = "3A3A. 3B3B. 444444444444.";
        } else if (talkingBookSetting === "Sentence") {
            p1Inner = `<span id="s1" class="audio-sentence">${p1Text}</span>`;
            p2Inner = `<span id="s3a" class="audio-sentence">3A3A.</span> <span id="s3b" class="audio-sentence">3B3B.</span> <span id="s4" class="audio-sentence">444444444444.</span>`;
        } else {
            throw new Error(
                "Unrecognized talkingBookSetting: " + talkingBookSetting
            );
        }

        return setupFromParagraphInnerHtml([p1Inner, p2Inner], isFlex);
    }

    function setupScenario2(
        talkingBookSetting: "NoAudio" | "Sentence",
        isFlex: boolean = true
    ) {
        const phrase1 = "111111111111";
        const phrase2A = "2A2A";
        const phrase2B = "2B2B.";

        let p1Inner: string;
        let p2Inner: string;
        if (talkingBookSetting === "NoAudio") {
            p1Inner = `${phrase1} ${phrase2A} ${phrase2B}.`;
            p2Inner = "3A3A. 3B3B. 444444444444.";
        } else if (talkingBookSetting === "Sentence") {
            p1Inner = `<span id="s1" class="audio-sentence">${phrase1}</span> <span id="s2a" class="audio-sentence">${phrase2A}</span> <span id="s2b" class="audio-sentence">${phrase2B}</span>`;
            p2Inner = `<span id="s3a" class="audio-sentence">3A3A.</span> <span id="s3b" class="audio-sentence">3B3B.</span> <span id="s4" class="audio-sentence">444444444444.</span>`;
        } else {
            throw new Error(
                "Unrecognized talkingBookSetting: " + talkingBookSetting
            );
        }

        return setupFromParagraphInnerHtml([p1Inner, p2Inner], isFlex);
    }

    function setupFromParagraphInnerHtml(
        pInnerHtmls: string[],
        isFlex: boolean
    ) {
        // Not sure why we have to copy these styles and they're not getting applied from our styleshseets.
        // I tried to copy the classes / attributes / etc to make it match the selector rules, but it doesn't seem to be applying.
        // So, manually add things like flex-wrap etc.
        const display = isFlex ? " display: flex; flex-wrap: wrap;" : "";
        const editableStyle = `text-align: center;${display}`;
        const pStyle = isFlex ? "flex-basis: 100%; flex-grow: 0;" : "";

        const editableInnerHtml = pInnerHtmls
            .map((innerHtml, index) => {
                const id = `p${index + 1}`;
                return `<p id="${id}" style="${pStyle}">${innerHtml}</p>`;
            })
            .join("");

        const editableHtml = `<div id="div1" class="bloom-editable bloom-visibility-code-on" style="${editableStyle}">${editableInnerHtml}</div>`;
        createImageContainer(editableHtml);
        const editable = document.getElementById("div1")!;
        return editable;
    }

    const setupS1AndMoveTo = (setting, id, i) => {
        const editable = setupScenario1(setting);
        setSelectionTo(getFirstTextNodeOfElement(id)!, i);
        return editable;
    };

    ["NoAudio", "Sentence"].forEach(setting => {
        it(`Given ArrowUp on non-flexbox (setting = ${setting}), does nothing`, () => {
            const setup = () => {
                const editable = setupScenario1(setting as any, false);

                let id;
                if (setting === kNoAudio) {
                    id = "p2";
                } else {
                    id = "s3a";
                }
                const initialAnchorNode = document.getElementById(id)!
                    .firstChild!;
                const initialOffset = 0;
                setSelectionTo(initialAnchorNode, initialOffset);

                return editable;
            };

            const expectation = false;
            runPreventDefaultTest(kArrowUp, setup, expectation);
        });
    });

    describe("Given ArrowUp on non talking book", () => {
        const l2Start = 13;

        describe("preventDefault tests", () => {
            // Test that the event has defaultPrevented IFF on boundary line.
            it(`Given ArrowUp on non talking book, cursor on Paragraph 2, Line 1, default behavior is prevented`, () => {
                const setup = () => setupS1AndMoveTo(kNoAudio, "p2", 0);
                const expectedResult = true;
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });

            it(`Given ArrowUp on non talking book, cursor on Paragraph 2, Line 2, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kNoAudio, "p2", 14);
                const expectedResult = false;
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });

            it(`Given ArrowUp on non talking book, cursor on first line of Paragraph 1, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kNoAudio, "p1", 0);
                const expectedResult = false; // because nothing to move to
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });

            it(`Given ArrowUp on non talking book, cursor on last line of Paragraph 1, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kNoAudio, "p1", l2Start);
                const expectedResult = false; // because not on relevant boundary line
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });
        });

        // The text should be aligned center, so if the line below is longer than the line above, multiple values will move to far-left of the line above.
        [0, 1].forEach(offset => {
            it(`Given ArrowUp on non talking book, cursor on Line 3, Span 2, Offset ${offset}, moves to far-left of Paragraph1, Line 2`, () => {
                runScenario1Test(kArrowUp, getP2, offset, "222.", kNoAudio);
            });
        });

        it(`Given ArrowUp on non talking book, cursor on Line 3, Span 2, Offset 4, moves to 2nd char of Paragraph1, Line 2`, () => {
            runScenario1Test(kArrowUp, getP2, 4, "2.", kNoAudio);
        });

        it(`Given ArrowUp on non talking book, cursor on Line 3 on whitespace between spans, moves to position above`, () => {
            runScenario1Test(kArrowUp, getP2, 5, "2.", kNoAudio);
        });

        it(`Given ArrowUp on non talking book, cursor on Line 3, Offset 6, moves to position above`, () => {
            runScenario1Test(kArrowUp, getP2, 6, ".", kNoAudio);
        });

        // These are all to the right of the last character
        [9, 10].forEach(offset => {
            it(`Given ArrowUp on non talking book, cursor on Line 3, Offset ${offset}, moves to position above`, () => {
                runScenario1Test(kArrowUp, getP2, offset, "", kNoAudio);
            });
        });
    });

    describe("Given ArrowDown on non talking book", () => {
        const l2Start = 13;

        describe("preventDefault tests", () => {
            // Test that the event has defaultPrevented IFF on boundary line.
            [0, Math.round(l2Start / 2), l2Start - 1].forEach(i => {
                it(`Given ArrowDown on non talking book, cursor on Paragraph 1, Offset ${i}, default not prevented`, () => {
                    const setup = () => setupS1AndMoveTo(kNoAudio, "p1", i);
                    const expectedResult = false;
                    runPreventDefaultTest(kArrowDown, setup, expectedResult);
                });
            });

            [l2Start + 1].forEach(i => {
                it(`Given ArrowDown on non talking book, cursor on Paragraph 1, Offset ${i}, default behavior is prevented`, () => {
                    const setup = () => setupS1AndMoveTo(kNoAudio, "p1", i);
                    const expectedResult = true;
                    runPreventDefaultTest(kArrowDown, setup, expectedResult);
                });
            });

            it(`Given ArrowDown on non talking book, cursor on first line of Paragraph 2, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kNoAudio, "p2", 0);
                const expectedResult = false; // because not on relevant boundary line
                runPreventDefaultTest(kArrowDown, setup, expectedResult);
            });

            it(`Given ArrowDown on non talking book, cursor on last line of Paragraph 2, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kNoAudio, "p2", 14);
                const expectedResult = false; // because nothing to move to
                runPreventDefaultTest(kArrowDown, setup, expectedResult);
            });
        });

        // Offset 0 is valid too, but it's ambiguous whether that's the end of the 1st line or start fo 2nd, so skip testing that
        it(`Given ArrowDown on non talking book, cursor on Line 2, Offset 1, moves one line down to Line 3`, () => {
            const i = l2Start + 1;
            const expected = "A. 3B3B. 444444444444.";
            runScenario1Test(kArrowDown, getP1, i, expected, kNoAudio);
        });

        it(`Given ArrowDown on non talking book, cursor on Line 2, Offset 4, moves one line down to Line 3`, () => {
            const i = l2Start + 4;
            const expected = "B3B. 444444444444.";
            runScenario1Test(kArrowDown, getP1, i, expected, kNoAudio);
        });
    });

    describe("Given ArrowUp on TalkingBookSentenceSplit", () => {
        describe("preventDefault tests", () => {
            const l2Start = 13;

            // Test that the event has defaultPrevented IFF on boundary line.
            it(`Given ArrowUp on TalkingBookSentenceSplit, cursor on Paragraph 2, Line 1, default behavior is prevented`, () => {
                const setup = () => setupS1AndMoveTo(kSentence, "s3a", 0);
                const expectedResult = true;
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit, cursor on Paragraph 2, Line 2, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kSentence, "s4", 1);
                const expectedResult = false;
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit, cursor on first line of Paragraph 1, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kSentence, "s1", 0);
                const expectedResult = false; // because nothing to move to
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit, cursor on last line of Paragraph 1, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kSentence, "s1", l2Start);
                const expectedResult = false; // because not on relevant boundary line
                runPreventDefaultTest(kArrowUp, setup, expectedResult);
            });
        });

        describe("Scenario1 onBoundary tests", () => {
            // These are both to the first of the first character of the line above
            [0, 2].forEach(i => {
                it(`Given ArrowUp on TalkingBookSentenceSplit Scenario1, cursor on Line 3, Span A, Offset ${i}, moves to far-left of Paragraph1, Line 2`, () => {
                    runScenario1Test(kArrowUp, getS3a, i, "222.", kSentence);
                });
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario1, cursor on Line 3, Span 3A, Offset 4, moves to 2nd char of Paragraph1, Line 2`, () => {
                runScenario1Test(kArrowUp, getS3a, 4, "2.", kSentence);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario1, cursor on Line 3 on whitespace between spans, moves to position above`, () => {
                const getNode = () =>
                    document.getElementById("p2")!.childNodes[1];
                runScenario1Test(kArrowUp, getNode, 0, "2.", kSentence);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario1, cursor on Line 3, Span 3B, Offset 0, moves to position above`, () => {
                runScenario1Test(kArrowUp, getS3b, 0, ".", kSentence);
            });

            // These are both to the right of the last character of the line above
            [1, 4].forEach(i => {
                it(`Given ArrowUp on TalkingBookSentenceSplit Scenario1, cursor on Line 3, Span 3B, Offset ${i}, moves to position above`, () => {
                    runScenario1Test(kArrowUp, getS3b, i, "", kSentence);
                });
            });
        });

        describe("Scenario2 onBoundary tests", () => {
            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario2, cursor on Line 3, Span 3 start, moves one line up`, () => {
                runScenario2Test(kArrowUp, getS3a, 0, "2A2A", kSentence);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario2, cursor on Line 3, Span 3A End-1, moves one line up`, () => {
                runScenario2Test(kArrowUp, getS3a, 3, "A", kSentence);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario2, cursor on Line 3 on whitespace between spans, moves one line up`, () => {
                const getNode = () =>
                    document.getElementById("p2")!.childNodes[1];
                runScenario2Test(kArrowUp, getNode, 0, "2B2B.", kSentence);
            });

            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario2, cursor on Line 3, Span 3B start, moves to position above`, () => {
                runScenario2Test(kArrowUp, getS3b, 0, "B2B.", kSentence);
            });

            // These are both to the right of the last character of the line above
            it(`Given ArrowUp on TalkingBookSentenceSplit Scenario2, cursor on Line 3, Span 3B end, moves to position above`, () => {
                runScenario2Test(kArrowUp, getS3b, 4, "", kSentence);
            });
        });
    });

    describe("Given ArrowDown on TalkingBookSentenceSplit", () => {
        const l2Start = 13;

        describe("preventDefault tests", () => {
            // Test that the event has defaultPrevented IFF on boundary line.
            [0, Math.round(l2Start / 2), l2Start - 1].forEach(i => {
                it(`Given ArrowDown on TalkingBookSentenceSplit, cursor on Paragraph 1, Line 1, default not prevented`, () => {
                    const setup = () => setupS1AndMoveTo(kSentence, "s1", i);
                    const expectedResult = false;
                    runPreventDefaultTest(kArrowDown, setup, expectedResult);
                });
            });

            [l2Start + 1].forEach(i => {
                it(`Given ArrowDown on TalkingBookSentenceSplit, cursor on Paragraph 1, Line 2, default behavior is prevented`, () => {
                    const setup = () => setupS1AndMoveTo(kSentence, "s1", i);
                    const expectedResult = true;
                    runPreventDefaultTest(kArrowDown, setup, expectedResult);
                });
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit, cursor on first line of Paragraph 2, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kSentence, "s3a", 0);
                const expectedResult = false; // because not on relevant boundary line
                runPreventDefaultTest(kArrowDown, setup, expectedResult);
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit, cursor on last line of Paragraph 2, default not prevented`, () => {
                const setup = () => setupS1AndMoveTo(kSentence, "s4", 1);
                const expectedResult = false; // because nothing to move to
                runPreventDefaultTest(kArrowDown, setup, expectedResult);
            });
        });

        describe("Scenario1 onBoundary tests", () => {
            // Offset 0 is valid too, but it's ambiguous whether that's the end of the 1st line or start fo 2nd, so skip testing that
            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario1, cursor on Line 2, Offset 1, moves one line down to Line 3`, () => {
                const i = l2Start + 1;
                const expected = "A.";
                runScenario1Test(kArrowDown, getS1, i, expected, kSentence);
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario1, cursor on Line 2, Offset 4, moves one line down to Line 3`, () => {
                const i = l2Start + 4;
                const expected = "B3B.";
                runScenario1Test(kArrowDown, getS1, i, expected, kSentence);
            });
        });

        describe("Scenario2 onBoundary tests", () => {
            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario2, cursor on Line 2, Span 2A start, moves one line down to Line 3`, () => {
                const expected = "3A3A.";
                runScenario2Test(kArrowDown, getS2a, 0, expected, kSentence);
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario2, cursor on Line 2, Span 2A end, moves one line down to Line 3`, () => {
                const expected = "A.";
                runScenario2Test(kArrowDown, getS2a, 3, expected, kSentence);
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario2, cursor on Line 2, whitespace between S2A and S2B, moves one line down to Line 3`, () => {
                const getNode = () => {
                    // 0 = span1
                    // 1 = whitespace
                    // 2 = span2a
                    // 3 = whitespace
                    return document.getElementById("p1")!.childNodes[3];
                };
                const expected = " "; // The space between spans 3A and 3B
                runScenario2Test(kArrowDown, getNode, 0, expected, kSentence);
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario2, cursor on Line 2, Span 2B start, moves one line down to Line 3`, () => {
                const expected = " "; // The space between spans 3A and 3B
                runScenario2Test(kArrowDown, getS2b, 0, expected, kSentence);
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario2, cursor on Line 2, Span 2B middle, moves one line down to Line 3`, () => {
                const expected = "B3B.";
                runScenario2Test(kArrowDown, getS2b, 2, expected, kSentence);
            });

            it(`Given ArrowDown on TalkingBookSentenceSplit Scenario2, cursor on Line 2, Span 2B end, moves one line down to Line 3`, () => {
                const expected = "B."; // The space after span 3B
                runScenario2Test(kArrowDown, getS2b, 4, expected, kSentence);
            });
        });
    });
});

describe("Anchor Tests", () => {
    it("Given paragraph with no spans and cursor at start, returns offset as indexFromStart", () => {
        const html = '<div class="bloom-editable"><p id="p1">S1. S2.</p></div>';
        setupElementFromHtml(html);
        const paragraph = document.getElementById("p1")!;
        const anchorNode = paragraph.firstChild!;
        const anchor = new Anchor(anchorNode, 0);

        const result = anchor.convertToIndexFromStart(paragraph);

        expect(result).toBe(0);

        cleanupDocument();
    });

    it("Given paragraph with no spans, returns offset as indexFromStart", () => {
        const html = '<div class="bloom-editable"><p id="p1">S1. S2.</p></div>';
        setupElementFromHtml(html);
        const paragraph = document.getElementById("p1")!;
        const anchorNode = paragraph.firstChild!;
        const anchor = new Anchor(anchorNode, 5);

        const result = anchor.convertToIndexFromStart(paragraph);

        expect(result).toBe(5);

        cleanupDocument();
    });

    it("Given 2nd span inside paragraph, calculates indexFromStart correctly", () => {
        const html =
            '<div class="bloom-editable"><p id="p1"><span id="s1">S1.</span> <span id="s2">S2.</span></p></div>';
        setupElementFromHtml(html);
        const paragraph = document.getElementById("p1")!;
        const anchorNode = document.getElementById("s2")!.firstChild!;
        const anchor = new Anchor(anchorNode, 0);

        const result = anchor.convertToIndexFromStart(paragraph);

        expect(result).toBe(4);

        cleanupDocument();
    });
});

function setupElementFromHtml(html: string): Element {
    const body = document.createElement("body");
    body.classList.add("toClean");
    body.innerHTML = html;
    document.firstElementChild!.appendChild(body); // FYI, firstElementChild = the <html> tag
    return body.firstElementChild!;
}

function createImageContainer(
    editableHtml: string,
    left = 0,
    top = 0,
    width = 1000,
    height = 1000
): Element {
    // For test purposes, we set the image container position using absolute so that they can be manually positioned in such a way to produce easy numbers to work with.
    const textOverPicHtml = `<div class="bloom-textOverPicture" data-bubble="{\'style\':\'caption\'}" style="left: 0%; top: 0%; width: 10%; height: 20%; position: absolute;">${editableHtml}</div>`;
    const html = `<div class="bloom-page customPage"><div class="bloom-imageContainer" style="width: ${width}px; height: ${height}px; left: ${left}px; top: ${top}px; position: absolute;">${textOverPicHtml}</div></div>`;
    return setupElementFromHtml(html);
}

function cleanupDocument() {
    const collection = document.getElementsByClassName("toClean");
    for (let i = 0; i < collection.length; ++i) {
        collection[i].remove();
    }
}

function setSelectionTo(node: Node, offset: number) {
    const sel1 = window.getSelection()!;
    sel1.setBaseAndExtent(node, offset, node, offset);
}

function getFirstTextNodeOfElement(id: string) {
    return document.getElementById(id)!.firstChild;
}

// A bunch of utility functions that can be passed directly without needing to create anonymous arrow functions for them over and over
const getP1 = () => getFirstTextNodeOfElement("p1")!;
const getP2 = () => getFirstTextNodeOfElement("p2")!;
const getS1 = () => getFirstTextNodeOfElement("s1")!;
const getS2a = () => getFirstTextNodeOfElement("s2a")!;
const getS2b = () => getFirstTextNodeOfElement("s2b")!;
const getS3a = () => getFirstTextNodeOfElement("s3a")!;
const getS3b = () => getFirstTextNodeOfElement("s3b")!;
