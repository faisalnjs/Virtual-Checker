import "./ui.css";
import storage from "/src/modules/storage.js";

export function alert(title, text, callback, blur) {
    return modal({
        title,
        body: new Element("p", text).element.outerHTML,
        buttons: [{
            text: "Close",
            close: true,
            onclick: callback,
        }],
        blur,
    });
}

export function prompt(title, text, buttons, blur) {
    return modal({
        title,
        body: new Element("p", text).element.outerHTML,
        buttons,
        blur,
    });
}

export function modal(options) {
    // Create dialog element
    const dialog = document.createElement("dialog");
    dialog.innerHTML = options.body;
    // Append dialog element to DOM
    document.body.append(dialog);
    // Show modal
    show(dialog, options.title, options.buttons, options.blur);
    // Remove dialog element on close
    dialog.addEventListener("close", () => {
        dialog.remove();
    });
    return dialog;
}

export function show(dialog, title, buttons, blur) {
    const modalTitle = (() => {
        const existing = dialog.querySelector("[data-modal-title]");
        if (existing) {
            existing.textContent = title;
            return existing;
        }
        else if (title) {
            const element = new Element("h2", title).element;
            element.setAttribute("data-modal-title", "");
            dialog.prepend(element);
            return element;
        }
    })();

    const modalButtons = (() => {
        const existing = dialog.querySelector("[data-modal-buttons]");
        if (existing) {
            existing.innerHTML = "";
            return existing;
        }
        else if (buttons?.length > 0) {
            const element = document.createElement("div");
            element.setAttribute("data-modal-buttons", "");
            dialog.append(element);
            return element;
        }
    })();

    buttons.forEach(button => {
        modalButtons.append(
            new Element("button", button.text, {
                click: () => {
                    button.close && dialog.close();
                    button.onclick && button.onclick();
                },
            }).element
        );
    });

    dialog.showModal();

    blur && modalButtons.querySelectorAll("button").forEach(button => button.blur());
}

export class Element {
    constructor(tag, text, events) {
        this.tag = tag;
        this.text = text;
        this.events = events;
    }

    get element() {
        const element = document.createElement(this.tag);
        element.textContent = this.text;
        this.events && Object.keys(this.events).forEach(type => {
            const listener = this.events[type];
            element.addEventListener(type, listener);
        });
        return element;
    }
}

const modals = {
    "symbols": () => {
        show(document.getElementById("symbols-modal"), "Symbols", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "code": () => {
        document.getElementById("code-input").value = storage.get("code") || "";
        show(document.getElementById("code-modal"), "Seat Code", [
            {
                text: "Cancel",
                close: true,
            },
            {
                text: "Save",
                close: false,
                // onclick: saveCode,
            },
        ]);
    },
    "code-help": () => {
        show(document.getElementById("code-help-modal"), "Seat Code", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "settings": () => {
        show(document.getElementById("settings-modal"), "Settings", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "theme": () => {
        show(document.getElementById("theme-modal"), "Theme", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "storage": () => {
        show(document.getElementById("storage-modal"), "Storage", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "history": () => {
        show(document.getElementById("history-modal"), "History", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "keybinds": () => {
        show(document.getElementById("keybinds-modal"), "Keyboard Shortcuts", [
            {
                text: "Close",
                close: true,
            },
        ]);
    },
    "storage-help": () => {
        show(document.getElementById("storage-help-modal"), "Settings keep resetting?", [
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

document.querySelectorAll("[data-modal-view]").forEach(element => {
    element.addEventListener("click", e => {
        const path = element.getAttribute("data-modal-view");
        view(path);
    });
});

export function view(path) {
    const pages = path.split("/");
    const target = document.querySelector(`[data-modal-page="${pages[pages.length - 1]}"]`);
    const title = target.getAttribute("data-modal-title") || path;
    for (let i = 0; i < pages.length; i++) {
        const query = pages.slice(0, i + 1).map(item => `[data-modal-page="${item}"]`).join(">");
        const element = document.querySelector(query);
        element.querySelectorAll(":not([data-modal-title], [data-modal-buttons]").forEach(element => {
            const page = element.getAttribute("data-modal-page");
            if (page == pages[i + 1]) {
                element.style.removeProperty("display");
            }
            else {
                element.style.display = "none";
            }
        });
    }
    show(document.querySelector(`[data-modal-page="${pages[0]}"]`), title, [
        {
            text: "Close",
            close: true,
        },
    ]);
}