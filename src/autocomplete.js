const symbols = require("./symbols.json");

export class Autocomplete {
    #start = 0;
    #end = 0;
    #query = ""

    constructor(input, result) {
        this.input = input;
        this.result = result;

        this.input.addEventListener("keydown", e => {
            if (e.key == "Tab" && this.matches.length != 0) {
                e.preventDefault();
                e.target.setRangeText(symbols[this.matches[0]], this.#start, this.#end, "end");
                this.#start = e.target.selectionEnd;
                this.#query = e.target.value.substring(this.#start, this.#end + 1);
                this.#updateResult();
            }
            if (e.key == "Escape") {
                this.#start = e.target.selectionEnd;
                this.#query = e.target.value.substring(this.#start, this.#end + 1);
                this.#updateResult();
            }
            if (e.key == " ") {
                this.#start = e.target.selectionEnd;
                this.#start++;
                this.#end++;
            }
            if (this.#start > this.#end) {
                this.#start = this.#end;
            }
        });

        this.input.addEventListener("input", e => {
            this.update();
        });
    }

    update() {
        this.#end = this.input.selectionEnd;
        this.#query = this.input.value.substring(this.#start, this.#end + 1);
        this.#updateResult();
        // console.log(this.#start, this.#end, this.#query, this.input.selectionEnd, this.matches);
    }

    get matches() {
        if (this.#query?.trim()) {
            return Object.keys(symbols).filter(string => string.startsWith(this.#query));
        }
        else {
            return [];
        }
    }

    #updateResult() {
        if (this.matches.length != 0) {
            this.result.innerHTML = `<kbd>Tab</kbd> to insert ${symbols[this.matches[0]]}`;
        }
        else if (this.#query?.trim()) {
            this.result.innerHTML = "<kbd>Esc</kbd> to cancel";
        }
        else {
            this.result.innerHTML = "";
        }
    }
}