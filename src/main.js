import "./reset.css";
import "./style.css";
import "./themes.css";
import "remixicon/fonts/remixicon.css";

import * as ui from "./ui.js";
import { submitClick } from "./clicker.js";
import { Storage } from "./storage.js";
import { Autocomplete } from "./autocomplete.js";

import symbols from "./symbols.json";

const storage = new Storage("virtual-clicker-2");

// Version

const VERSION = "3.0.0";
document.querySelectorAll("span.version").forEach(element => {
    element.innerHTML = VERSION;
});

// Modals

const modals = {
    "symbols": () => {
        ui.show(document.getElementById("symbols-modal"), "Symbols", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "code": () => {
        document.getElementById("code-input").value = storage.get("code") || "";
        ui.show(document.getElementById("code-modal"), "Seat Code", [
            {
                text: "Cancel",
                close: true,
            },
            {
                text: "Save",
                close: false,
                onclick: saveCode,
            },
        ]);
    },
    "code-help": () => {
        ui.show(document.getElementById("code-help-modal"), "Seat Code", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "settings": () => {
        ui.show(document.getElementById("settings-modal"), "Settings", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "theme": () => {
        ui.show(document.getElementById("theme-modal"), "Theme", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "storage": () => {
        ui.show(document.getElementById("storage-modal"), "Storage", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "history": () => {
        ui.show(document.getElementById("history-modal"), "History", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "keybinds": () => {
        ui.show(document.getElementById("keybinds-modal"), "Keyboard Shortcuts", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "storage-help": () => {
        ui.show(document.getElementById("storage-help-modal"), "Settings keep resetting?", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
}

document.querySelectorAll("[data-show-modal]").forEach(button => {
    button.addEventListener("click", e => {
        modals[button.getAttribute("data-show-modal")]();
    });
});

// Seat code

// Code from URL parameter
(() => {
    const params = new URLSearchParams(window.location.search);
    const input = params.get("code");
    const regex = /^[1-9][1-6][1-5]$/;
    if (regex.test(input)) {
        storage.set("code", input);
        updateCode();
    }
})();

if (!storage.get("code")) {
    modals["code"]();
}
else {
    updateCode();
}

document.getElementById("code-input").addEventListener("input", e => {
    e.target.value = parseInt(e.target.value) || "";
});

document.getElementById("code-input").addEventListener("keydown", e => {
    if (e.key == "Enter") {
        e.preventDefault();
        saveCode();
    }
});

function saveCode() {
    const input = document.getElementById("code-input").value;
    const regex = /^[1-9][1-6][1-5]$/;
    if (regex.test(input)) {
        storage.set("code", input);
        updateCode();
        document.getElementById("code-modal").close();

        // Update URL parameters with seat code
        const params = new URLSearchParams(window.location.search);
        params.set("code", input);
        console.log(params);
        history.replaceState({}, "", "?" + params.toString());
    }
    else {
        ui.alert("Error", "Seat code isn't possible");
    }
}

function updateCode() {
    if (storage.get("code")) {
        document.querySelectorAll("span.code").forEach(element => {
            element.innerHTML = storage.get("code");
        });
        document.title = `Virtual Clicker (${storage.get("code")})`;
    }
}

for (let col = 1; col <= 5; col++) {
    for (let row = 6; row > 0; row--) {
        document.getElementById("seat-grid").append(
            new ui.Element("button", "", {
                click: () => {
                    const period = document.getElementById("period-input").value;
                    const code = period + row.toString() + col.toString();
                    document.getElementById("code-input").value = code;
                    document.getElementById("code-help-modal").close();
                },
            }).element
        );
    }
}

// Clicker

const questionInput = document.getElementById("question-input");
const answerInput = document.getElementById("answer-input");
let choiceInput = "";

const autocomplete = new Autocomplete(answerInput, document.getElementById("answer-suggestion"));

const submitText = document.getElementById("submit-button").innerHTML;
let submitTimeout;

questionInput.focus();

document.getElementById("submit-button").addEventListener("click", e => {
    const question = questionInput.value?.trim();
    const answer = choiceInput || answerInput.value?.trim();
    if (storage.get("code")) {
        if (question && answer) {
            submitClick(storage.get("code"), question, answer);
            storeClick(storage.get("code"), question, answer);
            resetInputs();

            // Submit feedback
            e.target.innerHTML = `<i class="ri-check-fill"></i> Submitted`;
            clearTimeout(submitTimeout);
            submitTimeout = setTimeout(() => {
                e.target.innerHTML = submitText;
            }, 2000);
        }
        if (!answer) {
            answerInput.classList.add("attention");
            answerInput.focus();
        }
        if (!question) {
            questionInput.classList.add("attention");
            questionInput.focus();
        }
    }
    else {
        modals["code"]();
    }
});

questionInput.addEventListener("input", e => {
    e.target.classList.remove("attention");
});

answerInput.addEventListener("input", e => {
    e.target.classList.remove("attention");
});

function resetInputs() {
    questionInput.value = "";
    answerInput.value = "";
    answerMode("input");
    questionInput.focus();
    autocomplete.update();
}

// Multiple choice

answerMode("input");

const descriptions = {
    "a": ["Agree", "True", "Yes"],
    "b": ["Disagree", "False", "No"],
    "c": ["Both", "Always"],
    "d": ["Neither", "Never"],
    "e": ["Sometimes", "Cannot be determined"],
}

document.querySelectorAll("[data-multiple-choice]").forEach(button => {
    button.addEventListener("click", e => {
        const choice = e.target.getAttribute("data-multiple-choice");
        const content = document.querySelector(`[data-answer-mode="choice"]>div`);

        content.innerHTML = `<p><b>Choice ${choice.toUpperCase()}</b></p>
<p>Equivalent to submitting</p>
<p>${descriptions[choice].join(", ")}</p>`;

        answerMode("choice");
        choiceInput = `CHOICE ${choice.toUpperCase()}`;
    });
});

document.getElementById("remove-choice-button").addEventListener("click", e => {
    answerMode("input");
    choiceInput = "";
});

function answerMode(mode) {
    document.querySelectorAll("[data-answer-mode]").forEach(item => {
        if (item.getAttribute("data-answer-mode") == mode) {
            item.style.removeProperty("display");
        }
        else {
            item.style.display = "none";
        }
    });
}

// History

updateHistory();

function storeClick(code, question, answer) {
    const history = storage.get("history") || [];
    const timestamp = Date.now();
    history.push({
        "code": code,
        "question": question,
        "answer": answer,
        "timestamp": timestamp,
    });
    storage.set("history", history);
    updateHistory();
}

function updateHistory() {
    const history = storage.get("history") || [];
    const feed = document.getElementById("history-feed");
    if (history.length != 0) {
        feed.innerHTML = "";
        history.forEach(item => {
            const button = document.createElement("button");
            button.innerHTML = `<p><b>${item.question}.</b> ${timeToString(item.timestamp)} (${item.code})</p>\n<p>${item.answer}</p>`;
            feed.prepend(button);
            // Resubmit click
            button.addEventListener("click", e => {
                const choice = item.answer.match(/^CHOICE ([A-E])$/);
                questionInput.value = item.question;
                if (!choice) {
                    answerInput.value = item.answer;
                    answerMode("input");
                }
                else {
                    document.querySelector(`[data-multiple-choice="${choice[1].toLowerCase()}"]`).click();
                }

                document.getElementById("history-modal").close();
                questionInput.focus();
                autocomplete.update();
            });
        });
    }
    else {
        feed.innerHTML = "<p>Submitted clicks will show up here!</p>";
    }
}

function timeToString(timestamp) {
    let date = new Date(timestamp);
    if (timestamp) {
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let hours = date.getHours();
        let minutes = date.getMinutes().toString().padStart(2, "0");
        let period;
        if (hours >= 12) {
            hours %= 12;
            period = "PM";
        }
        else {
            period = "AM";
        }
        if (hours == 0) {
            hours = 12;
        }
        return `${month}/${day} ${hours}:${minutes} ${period}`;
    }
}

// Symbols

const uniqueSymbols = [...new Set(Object.values(symbols))];

document.querySelectorAll("[data-insert-symbol]").forEach(button => {
    const index = button.getAttribute("data-insert-symbol");
    const symbol = Object.values(symbols)[index];
    button.innerHTML = symbol;
    button.addEventListener("click", e => {
        insertSymbol(symbol);
    });
});

uniqueSymbols.forEach(symbol => {
    document.querySelector("#symbols-modal>div").append(
        new ui.Element("button", symbol, {
            click: () => {
                document.getElementById("symbols-modal").close();
                insertSymbol(symbol);
            },
        }).element
    )
});

function insertSymbol(symbol) {
    answerInput.setRangeText(symbol, answerInput.selectionStart, answerInput.selectionEnd, "end");
    answerInput.focus();
    autocomplete.update();
}

// Themes

const themes = [
    "classic",
    "abyss",
    "graphite",
    "blizzard",
    "sage",
    "dune",
    "rose",
    "lavender",
    "cream",
]

document.body.setAttribute("data-theme", storage.get("theme") || "");

themes.forEach(theme => {
    const button = document.createElement("button");
    button.setAttribute("data-theme", theme);
    button.innerHTML = theme;
    button.addEventListener("click", e => {
        document.body.setAttribute("data-theme", theme);
        storage.set("theme", theme);
    });
    document.querySelector("#theme-modal>div").append(button);
});

// Storage

const resets = {
    "theme": () => {
        document.body.removeAttribute("data-theme");
        storage.delete("theme");
    },
    "history": () => {
        ui.prompt("Are you sure?", "Click history will be erased. This cannot be undone!", [
            {
                text: "Cancel",
                close: true,
            },
            {
                text: "Clear",
                close: true,
                onclick: () => {
                    storage.delete("history");
                },
            },
        ]);
    },
    "all": () => {
        ui.prompt("Are you sure?", "All stored settings and data will erased. This cannot be undone!", [
            {
                text: "Cancel",
                close: true,
            },
            {
                text: "Reset",
                close: true,
                onclick: () => {
                    storage.obliterate();
                },
            },
        ]);
    },
}

document.querySelectorAll("[data-reset]").forEach(button => {
    button.addEventListener("click", e => {
        resets[e.target.getAttribute("data-reset")]();
    });
});

// Keyboard shortcuts

document.addEventListener("keydown", e => {
    const anyDialogOpen = Array.from(document.querySelectorAll("dialog")).some(dialog => dialog.open);
    if (e.ctrlKey) {
        if (e.key == "Enter" && !anyDialogOpen) {
            document.getElementById("submit-button").click();
        }
        if (e.key == "," && !anyDialogOpen) {
            modals["settings"]();
        }
        if (e.key == "." && !anyDialogOpen) {
            modals["history"]();
        }
        if (e.key == "/" && !anyDialogOpen) {
            modals["keybinds"]();
        }
    }
    else if (e.altKey) {
        if (/[1-9]/.test(e.key)) {
            e.preventDefault();
            insertSymbol(uniqueSymbols[parseInt(e.key) - 1]);
        }
    }
});