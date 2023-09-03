import "./reset.css";
import "./style.css";
import "./themes.css";

import * as ui from "./ui.js";
import { Storage } from "./storage.js";
import { Autocomplete } from "./autocomplete.js";

import symbols from "./symbols.json";

const storage = new Storage("virtual-clicker-2");

// Version

const VERSION = "3.0.0 BETA";
document.querySelectorAll("span.version").forEach(element => {
    element.innerHTML = VERSION;
});

// Modals

const modals = {
    "symbols": () => {
        ui.show(document.getElementById("symbols-modal"), "Symbols", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "code": () => {
        document.getElementById("code-input").value = storage.get("code") || "";
        ui.show(document.getElementById("code-modal"), "Seat Code", [
            new ui.ModalButton("Cancel", true),
            new ui.ModalButton("Save", false, saveCode),
        ]);
    },
    "code-help": () => {
        ui.show(document.getElementById("code-help-modal"), "Seat Code", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "settings": () => {
        ui.show(document.getElementById("settings-modal"), "Settings", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "theme": () => {
        ui.show(document.getElementById("theme-modal"), "Theme", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "storage": () => {
        ui.show(document.getElementById("storage-modal"), "Storage", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "history": () => {
        ui.show(document.getElementById("history-modal"), "History", [
            new ui.ModalButton("Close", true)
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
            new ui.Element("button", "", () => {
                const period = document.getElementById("period-input").value;
                const code = period + row.toString() + col.toString();
                document.getElementById("code-input").value = code;
                document.getElementById("code-help-modal").close();
            }).element
        );
    }
}

// Clicker

const questionInput = document.getElementById("question-input");
const answerInput = document.getElementById("answer-input");

const autocomplete = new Autocomplete(answerInput, document.getElementById("answer-suggestion"));

questionInput.focus();

document.getElementById("submit-button").addEventListener("click", e => {
    const question = questionInput.value?.trim();
    const answer = answerInput.value?.trim();
    if (storage.get("code")) {
        if (question && answer) {
            submitClick(storage.get("code"), question, answer);
            resetInputs();
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

function submitClick(code, question, answer) {
    const fields = {
        "entry.1896388126": code,
        "entry.1232458460": question,
        "entry.1065046570": answer
    }
    const params = new URLSearchParams(fields).toString();
    const url = "https://docs.google.com/forms/d/e/1FAIpQLSfwDCxVqO2GuB4jhk9iAl7lzoA2TsRlX6hz052XkEHbLrbryg/formResponse?";
    fetch(url + params, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    });
    storeClick(code, question, answer);
}

function resetInputs() {
    questionInput.value = "";
    answerInput.value = "";
    questionInput.focus();
    autocomplete.update();
}

// Multiple choice

const descriptions = {
    "a": ["Agree", "True", "Yes"],
    "b": ["Disagree", "False", "No"],
    "c": ["Both", "Always"],
    "d": ["Neither", "Never"],
    "e": ["Sometimes", "Cannot be determined"],
}

document.querySelectorAll("[data-multiple-choice]").forEach(button => {
    button.addEventListener("click", e => {
        const question = questionInput.value?.trim();
        const choice = e.target.getAttribute("data-multiple-choice");
        const body = `<p>Are you sure? This is the same as</p>\n${ui.createList(false, descriptions[choice])}`;
        if (storage.get("code")) {
            if (question) {
                ui.modal(`Submit choice ${choice.toUpperCase()}`, body, [
                    new ui.ModalButton("Cancel", true),
                    new ui.ModalButton("Submit", true, () => {
                        submitClick(storage.get("code"), question, `CHOICE ${choice.toUpperCase()}`);
                        resetInputs();
                    }),
                ]);
            }
            if (!question) {
                answerInput.classList.remove("attention");
                questionInput.classList.add("attention");
                questionInput.focus();
            }
        }
        else {
            modals["code"]();
        }
    });
});

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
            button.addEventListener("click", e => {
                questionInput.value = item.question;
                answerInput.value = item.answer;
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
        new ui.Element("button", symbol, () => {
            document.getElementById("symbols-modal").close();
            insertSymbol(symbol);
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
            new ui.ModalButton("Cancel", true),
            new ui.ModalButton("Clear", true, () => {
                storage.delete("history");
            }),
        ]);
    },
    "all": () => {
        ui.prompt("Are you sure?", "All stored settings and data will erased. This cannot be undone!", [
            new ui.ModalButton("Cancel", true),
            new ui.ModalButton("Reset", true, () => {
                storage.obliterate();
            }),
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
    }
    else if (e.altKey) {
        if (/[1-9]/.test(e.key)) {
            e.preventDefault();
            insertSymbol(uniqueSymbols[parseInt(e.key) - 1]);
        }
    }
});