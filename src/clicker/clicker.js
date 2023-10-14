import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";

const questionInput = document.getElementById("question-input");
const answerInput = document.getElementById("answer-input");
let choiceInput = "";

questionInput.focus();

document.getElementById("submit-button").addEventListener("click", e => {
    const question = questionInput.value?.trim();
    const answer = choiceInput || answerInput.value?.trim();
    if (storage.get("code")) {
        if (question && answer) {
            submitClick(storage.get("code"), question, answer);
            storeClick(storage.get("code"), question, answer);
            resetInputs();
            // Show submit confirmation
            ui.modeless(`<i class="ri-check-fill"></i>`, "Submitted!");
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
    choiceInput = "";
    questionInput.focus();
}

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

{
    const params = new URLSearchParams(window.location.search);
    const input = params.get("code");
    const regex = /^[1-9][1-6][1-5]$/;
    if (regex.test(input)) {
        storage.set("code", input);
        updateCode();
    }
}

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
                    ui.view("settings/code");
                },
                mouseenter: e => {
                    const period = document.getElementById("period-input").value;
                    const code = period + row.toString() + col.toString();
                    e.target.textContent = code;
                },
                mouseleave: e => {
                    e.target.textContent = "";
                },
            }).element
        );
    }
}

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

import { timeToString } from "/src/modules/time.js";
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

                ui.view("");
                questionInput.focus();
            });
        });

        feed.prepend(new ui.Element("p", "Click to resubmit").element);
    }
    else {
        feed.innerHTML = "<p>Submitted clicks will show up here!</p>";
    }
}

const resets = {
    "theme": () => {
        document.body.removeAttribute("data-theme");
        storage.delete("theme");
    },
    "history": () => {
        ui.prompt("Clear history?", "This action cannot be reversed!", [
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
        ui.prompt("Reset all settings?", "This action cannot be reversed!", [
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