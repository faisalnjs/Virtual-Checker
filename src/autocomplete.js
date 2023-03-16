const symbols = require("./symbols.json");

export class Autocomplete {
    #start = 0;
    #end = 0;
    #query = ""

    constructor(input, suggestion) {
        this.input = input;
        this.suggestion = suggestion;

        this.input.addEventListener("keydown", e => {
            if (e.key == "Tab" && this.matches.length != 0) {
                e.preventDefault();
                e.target.setRangeText(symbols[this.matches[0]], this.#start, this.#end, "end");
                this.#start = e.target.selectionEnd;
                this.#query = e.target.value.substring(this.#start, this.#end + 1);
                this.#updateSuggestion();
            }
            if (e.key == "Escape") {
                this.#start = e.target.selectionEnd;
                this.#query = e.target.value.substring(this.#start, this.#end + 1);
                this.#updateSuggestion();
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
        if (this.matches.length == 0) {
            this.#start = this.#end;
        }
        this.#updateSuggestion();
        // console.log(this.#start, this.#end, this.#query, this.input.selectionEnd, this.matches);
    }

    get matches() {
        if (this.#query?.trim()) {
            if (this.#query in symbols) {
                return [this.#query];
            }
            else {
                return Object.keys(symbols).filter(string => string.startsWith(this.#query));
            }
        }
        else {
            return [];
        }
    }

    #updateSuggestion() {
        if (this.matches.length != 0) {
            this.suggestion.innerHTML = `<kbd>Tab</kbd> to insert ${symbols[this.matches[0]]} <kbd>Esc</kbd> to cancel`;
        }
        else if (this.#query?.trim()) {
            this.suggestion.innerHTML = "";
        }
        else {
            this.suggestion.innerHTML = "";
        }
    }
}