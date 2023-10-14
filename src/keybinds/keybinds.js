import * as ui from "/src/modules/ui.js";

import { insertFromIndex } from "/src/symbols/symbols.js";

document.addEventListener("keydown", e => {
    const anyDialogOpen = Array.from(document.querySelectorAll("dialog")).some(dialog => dialog.open);
    if (e.ctrlKey) {
        if (e.key == "Enter" && !anyDialogOpen) {
            document.getElementById("submit-button").click();
        }
        if (e.key == "," && !anyDialogOpen) {
            ui.view("settings");
        }
        if (e.key == "." && !anyDialogOpen) {
            ui.view("history");
        }
        if (e.key == "/" && !anyDialogOpen) {
            ui.view("settings/keybinds");
        }
    }
    else if (e.altKey) {
        if (/[1-9]/.test(e.key)) {
            e.preventDefault();
            insertFromIndex(parseInt(e.key) - 1);
        }
    }
});