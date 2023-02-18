import * as ui from "./ui.js";

const modals = {
    "more-symbols": () => {
        ui.show(document.getElementById("more-symbols-modal"), "Symbols", [
            new ui.ModalButton("Close", true)
        ]);
    },
    "code": () => {
        ui.show(document.getElementById("code-modal"), "Seat Code", [
            new ui.ModalButton("Cancel", true),
            new ui.ModalButton("Save", false, () => {
                console.log("Seat code save")
            }),
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