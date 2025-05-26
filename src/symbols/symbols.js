import * as ui from "/src/modules/ui.js";
import symbols from "./symbols.json";

class Autocomplete {
  #start = 0;
  #end = 0;
  #query = "";

  constructor(input, suggestion) {
    this.input = input;
    this.suggestion = suggestion;

    this.input.addEventListener("keydown", (e) => {
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

    this.input.addEventListener("input", () => {
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
      } else {
        return Object.keys(symbols).filter((string) => string.startsWith(this.#query));
      }
    } else {
      return [];
    }
  }

  #updateSuggestion() {
    if (this.matches.length != 0) {
      this.suggestion.innerHTML = `<kbd>Tab</kbd> to insert ${symbols[this.matches[0]]} <kbd>Esc</kbd> to cancel`;
    } else if (this.#query?.trim()) {
      this.suggestion.innerHTML = "";
    } else {
      this.suggestion.innerHTML = "";
    }
  }
}

const uniqueSymbols = [...new Set(Object.values(symbols))];
const answerInput = document.getElementById("answer-input");

export const autocomplete = (answerInput && document.getElementById("answer-suggestion")) ? new Autocomplete(
  answerInput,
  document.getElementById("answer-suggestion"),
) : null;

// Track input focus
let lastFocusedInput = null;
let currentFocusedInput = null;
document.addEventListener('focusin', (event) => {
  if ((event.target.tagName.toLowerCase() === 'input') && event.target.getAttribute("type") && (event.target.getAttribute("type") === "text")) {
    lastFocusedInput = currentFocusedInput;
    currentFocusedInput = event.target;
  };
});

// Insert symbol by index
document.querySelectorAll("[data-insert-symbol]").forEach((button) => {
  const index = button.getAttribute("data-insert-symbol");
  const symbol = Object.values(symbols)[index];
  button.innerHTML = symbol;
  button.addEventListener("click", () => {
    var answerMode = document.querySelector('#answer-mode-selector [aria-selected="true"]').getAttribute("data-value");
    if (currentFocusedInput && document.querySelector(`[data-answer-mode="${answerMode}"]`).contains(currentFocusedInput)) {
      insert(symbol, currentFocusedInput);
    } else if (lastFocusedInput && document.querySelector(`[data-answer-mode="${answerMode}"]`).contains(lastFocusedInput)) {
      insert(symbol, lastFocusedInput);
    } else if (button.getAttribute("data-target-input") && document.getElementById(button.getAttribute("data-target-input"))) {
      insert(symbol, document.getElementById(button.getAttribute("data-target-input")));
    } else {
      insert(symbol);
    };
  });
});

// Loop through unique symbols and append them to DOM
uniqueSymbols.forEach((symbol) => {
  const button = new ui.Element("button", symbol, {
    click: () => {
      // Close the modal
      ui.view("");
      // Insert symbol
      var answerMode = document.querySelector('#answer-mode-selector [aria-selected="true"]').getAttribute("data-value");
      if (currentFocusedInput && document.querySelector(`[data-answer-mode="${answerMode}"]`).contains(currentFocusedInput)) {
        insert(symbol, currentFocusedInput);
      } else if (lastFocusedInput && document.querySelector(`[data-answer-mode="${answerMode}"]`).contains(lastFocusedInput)) {
        insert(symbol, lastFocusedInput);
      } else if (button.getAttribute("data-target-input") && document.getElementById(button.getAttribute("data-target-input"))) {
        insert(symbol, document.getElementById(button.getAttribute("data-target-input")));
      } else {
        insert(symbol);
      };
    },
  }).element;
  // Show symbol name
  const keys = [];
  Object.entries(symbols).forEach(([key, value]) => {
    if (value == symbol) {
      keys.push(key);
    }
  });
  button.title = keys.join(", ");
  document.querySelector("#symbols-grid").append(button);
  ui.addTooltip(button, keys.join(", "));
});

// Fill missing space
const emptySpaces = 6 - (uniqueSymbols.length % 6);
for (let i = 0; i < emptySpaces; i++) {
  document.querySelector("#symbols-grid").append(document.createElement("div"));
}

// Insert symbol at cursor position
function insert(symbol, customInput) {
  if (customInput) {
    customInput.setRangeText(symbol, customInput.selectionStart, customInput.selectionEnd, "end");
    customInput.focus();
  } else {
    answerInput.setRangeText(symbol, answerInput.selectionStart, answerInput.selectionEnd, "end");
    answerInput.focus();
  };
  autocomplete.update();
}

// Insert symbol from index
export function insertFromIndex(index) {
  insert(uniqueSymbols[index]);
}