import * as ui from "./ui.js";
import { Storage } from "./storage.js";

const storage = new Storage("virtual-clicker-2");

// Modals

const modals = {
    "more-symbols": () => {
        ui.show(document.getElementById("more-symbols-modal"), "Symbols", [
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
    "shortcuts": () => {
        ui.show(document.getElementById("history-modal"), "Shortcuts", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "theme": () => {
        ui.show(document.getElementById("history-modal"), "Theme", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "data": () => {
        ui.show(document.getElementById("history-modal"), "Data", [
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
    document.querySelectorAll("span.code").forEach(element => {
        element.innerHTML = storage.get("code");
    });
}

// History



// Clicker

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