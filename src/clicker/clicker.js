import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";

import { autocomplete } from "/src/symbols/symbols.js";
import { timeToString } from "/src/modules/time.js";

const questionInput = document.getElementById("question-input");
const answerInput = document.getElementById("answer-input");

let multipleChoice = "";

// Initialization
{
    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    // Test for valid seat code
    const regex = /^[1-9][1-6][1-5]$/;
    if (regex.test(code)) {
        // Update seat code
        storage.set("code", code);
        updateCode();
    }
    // Show seat code modal if no saved code exists
    if (storage.get("code")) {
        updateCode();
    }
    else {
        ui.view("settings/code");
    }
    // Show clear data fix guide
    if (storage.get("created")) {
        document.querySelector(`[data-modal-view="clear-data-fix"]`).style.display = "none";
    }
    else {
        storage.set("created", Date.now());
    }
    // Focus question input
    questionInput.focus();
    // Set default answer mode
    answerMode("input");
    // Populate seat code finder grid
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
    // Update history feed
    updateHistory();
}

// Submit click
document.getElementById("submit-button").addEventListener("click", () => {
    const question = questionInput.value?.trim();
    const answer = multipleChoice || answerInput.value?.trim();
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
        ui.view("settings/code");
    }
});

// Remove attention ring when user types in either input
questionInput.addEventListener("input", e => {
    e.target.classList.remove("attention");
});
answerInput.addEventListener("input", e => {
    e.target.classList.remove("attention");
});

// Reset inputs to default state
function resetInputs() {
    questionInput.value = "";
    answerInput.value = "";
    answerMode("input");
    multipleChoice = "";
    questionInput.focus();
    autocomplete.update();
}

// Submit to Google Forms
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

// Limit seat code input to integers
document.getElementById("code-input").addEventListener("input", e => {
    e.target.value = parseInt(e.target.value) || "";
});

// Save seat code on enter
document.getElementById("code-input").addEventListener("keydown", e => {
    if (e.key == "Enter") {
        e.preventDefault();
        saveCode();
    }
});

// Save seat code button
document.getElementById("save-code-button").addEventListener("click", saveCode);

// Save seat code
function saveCode() {
    const input = document.getElementById("code-input").value;
    // Tests for valid seat code
    const regex = /^[1-9][1-6][1-5]$/;
    if (regex.test(input)) {
        storage.set("code", input);
        updateCode();
        // Close all modals
        ui.view("");
        // Update URL parameters with seat code
        const params = new URLSearchParams(window.location.search);
        params.set("code", input);
        history.replaceState({}, "", "?" + params.toString());
    }
    else {
        ui.alert("Error", "Seat code isn't possible");
    }
}

// Update elements with new seat code
function updateCode() {
    if (storage.get("code")) {
        document.getElementById("code-input").value = storage.get("code");
        document.querySelectorAll("span.code").forEach(element => {
            element.innerHTML = storage.get("code");
        });
        document.title = `Virtual Clicker (${storage.get("code")})`;
    }
}

// Show multiple choice card
document.querySelectorAll("[data-multiple-choice]").forEach(button => {
    const descriptions = {
        "a": ["Agree", "True", "Yes"],
        "b": ["Disagree", "False", "No"],
        "c": ["Both", "Always"],
        "d": ["Neither", "Never"],
        "e": ["Sometimes", "Cannot be determined"],
    }
    button.addEventListener("click", e => {
        const choice = e.target.getAttribute("data-multiple-choice");
        // Set content of multiple choice card
        const content = document.querySelector(`[data-answer-mode="choice"]>div`);
        content.innerHTML = `<p><b>Choice ${choice.toUpperCase()}</b></p>
<p>Equivalent to submitting</p>
<p>${descriptions[choice].join(", ")}</p>`;
        // Show multiple choice card
        answerMode("choice");
        multipleChoice = `CHOICE ${choice.toUpperCase()}`;
    });
});

// Hide multiple choice card
document.getElementById("remove-choice-button").addEventListener("click", () => {
    answerMode("input");
    multipleChoice = "";
});

// Set answer mode
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

// Store click to storage and history
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

// Update history feed
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
            button.addEventListener("click", () => {
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
                autocomplete.update();
            });
        });
        feed.prepend(new ui.Element("p", "Click to resubmit").element);
    }
    else {
        feed.innerHTML = "<p>Submitted clicks will show up here!</p>";
    }
}

// Reset modals
const resets = {
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

// Show reset modal
document.querySelectorAll("[data-reset]").forEach(button => {
    button.addEventListener("click", e => {
        resets[e.target.getAttribute("data-reset")]();
    });
});

{
    // Start of period in ms
    const start = getPeriodStart();
    // Start 5 minutes in
    const delay = start + 5 * 60000 - Date.now();
    // Create element
    const element = document.createElement("p");
    element.textContent = "Happy Birthday Mr. Lipsky!!";
    Object.assign(element.style, {
        "position": "absolute",
        "inset": "0",
        "z-index": "9999",
        "display": "flex",
        "align-items": "center",
        "justify-content": "center",
        "pointer-events": "none",
        "background-color": "transparent",
        "font-size": "5em",
    });
    // Set timeout
    if (delay && delay >= 0) {
        setTimeout(() => {
            // Append and run animation
            document.body.append(element);
            element.animate([
                {
                    transform: "scale(0.5) rotateY(-360deg)",
                    opacity: "0",
                },
                {
                    transform: "scale(1) rotateY(0deg)",
                    opacity: "1",
                },
            ], {
                duration: 1000,
            });
            setTimeout(() => {
                // Fade out and remove
                element.animate([
                    { opacity: "1", },
                    { opacity: "0", },
                ], {
                    duration: 500,
                    fill: "forwards",
                });
                setTimeout(() => {
                    element.remove();
                }, 500);
            }, 10000);
        }, delay);
    }
}

function getPeriodStart() {
    const schedule = [
        {
            "from": "07:50",
            "to": "08:38"
        },
        {
            "from": "08:42",
            "to": "09:23"
        },
        {
            "from": "09:27",
            "to": "10:09"
        },
        {
            "from": "10:13",
            "to": "10:55"
        },
        {
            "from": "10:59",
            "to": "11:41"
        },
        {
            "from": "11:45",
            "to": "12:27"
        },
        {
            "from": "12:31",
            "to": "13:13"
        },
        {
            "from": "13:17",
            "to": "13:58"
        },
        {
            "from": "14:02",
            "to": "14:43"
        },
    ];
    const from = schedule.map(item => timeToMs(item.from));
    const to = schedule.map(item => timeToMs(item.to));
    const now = Date.now();
    // const now = timeToMs("8:30");
    const after = from.findLastIndex(time => now > time);
    const before = to.findIndex(time => now < time);

    if (after == before) {
        return from[after];
    }
    return;
}

function timeToMs(time) {
    const now = new Date();
    const hours = time.split(":")[0];
    const minutes = time.split(":")[1];
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).getTime();
}