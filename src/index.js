import * as ui from "./ui.js";
import { Storage } from "./storage.js";
import { Autocomplete } from "./autocomplete.js";

const storage = new Storage("virtual-clicker-2");

// Version

const VERSION = "2.0";
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
    "data": () => {
        ui.show(document.getElementById("data-modal"), "Data", [
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
        modals[e.target.getAttribute("data-show-modal")]();
    });
});

// Seat code

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

// History



// Clicker

const questionInput = document.getElementById("question-input");
const answerInput = document.getElementById("answer-input");

document.getElementById("submit-button").addEventListener("click", e => {
    const question = questionInput.value?.trim();
    const answer = answerInput.value?.trim();
    console.log(question, answer);
    if (storage.get("code")) {
        if (question && answer) {
            submitClick(storage.get("code"), question, answer);
            resetInputs();
        }
        if (!question) {
            questionInput.classList.add("attention");
            questionInput.focus();
        }
        if (!answer) {
            answerInput.classList.add("attention");
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
}

function resetInputs() {
    questionInput.value = "";
    answerInput.value = "";
    questionInput.focus();
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
                    }),
                ]);
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
});

// Symbols

new Autocomplete(answerInput, answerInput.nextElementSibling);

const symbols = require("./symbols.json");
const uniqueSymbols = [...new Set(Object.values(symbols))];

document.querySelectorAll("[data-insert-symbol]").forEach(button => {
    const index = button.getAttribute("data-insert-symbol");
    const symbol = Object.values(symbols)[index];
    button.innerHTML = symbol;
    button.addEventListener("click", e => {
        answerInput.value += symbol;
        answerInput.dispatchEvent(new Event("input"));
        answerInput.focus();
    });
});

uniqueSymbols.forEach(symbol => {
    document.querySelector("#symbols-modal>div").append(
        new ui.Element("button", symbol, () => {
            answerInput.value += symbol;
            answerInput.dispatchEvent(new Event("input"));
            answerInput.focus();
        }).element
    )
});