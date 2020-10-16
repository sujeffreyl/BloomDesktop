import { Anchor } from "./lineNavigator";

describe("Anchor Tests", () => {
    it("Given paragraph with no spans and cursor at start, returns offset as indexFromStart", () => {
        const html = '<div class="bloom-editable"><p id="p1">S1. S2.<p></div>';
        setupElementFromHtml(html);
        const paragraph = document.getElementById("p1")!;
        const anchorNode = paragraph.firstChild!;
        const anchor = new Anchor(anchorNode, 0);

        const result = anchor.convertToIndexFromStart(paragraph);

        expect(result).toBe(0);

        cleanupDocument();
    });

    it("Given paragraph with no spans, returns offset as indexFromStart", () => {
        const html = '<div class="bloom-editable"><p id="p1">S1. S2.<p></div>';
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
            '<div class="bloom-editable"><p id="p1"><span id="s1">S1.</span> <span id="s2">S2.</span><p></div>';
        setupElementFromHtml(html);
        const paragraph = document.getElementById("p1")!;
        const anchorNode = document.getElementById("s2")!.firstChild!;
        const anchor = new Anchor(anchorNode, 0);

        const result = anchor.convertToIndexFromStart(paragraph);

        expect(result).toBe(4);

        cleanupDocument();
    });

    function cleanupDocument() {
        const collection = document.getElementsByClassName("toClean");
        for (let i = 0; i < collection.length; ++i) {
            collection[i].remove();
        }
    }

    function setupElementFromHtml(html: string): Element {
        const body = document.createElement("body");
        body.classList.add("toClean");
        body.innerHTML = html;
        document.firstElementChild!.appendChild(body); // FYI, firstElementChild = the <html> tag
        return body.firstElementChild!;
    }
});
