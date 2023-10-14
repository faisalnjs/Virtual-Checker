import "./reset.css";
import "./layout.css";
import "./design.css";
import "remixicon/fonts/remixicon.css";

import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";

import "/src/clicker/clicker.js";
import "/src/symbols/symbols.js";
import "/src/themes/themes.js";
import "/src/keybinds/keybinds.js";

const VERSION = "3.2.0 BETA";
document.querySelectorAll("span.version").forEach(element => {
    element.innerHTML = VERSION;
});

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