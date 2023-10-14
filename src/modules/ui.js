import "./ui.css";

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
            }, button.class).element
        );
    });

    dialog.showModal();

    blur && modalButtons.querySelectorAll("button").forEach(button => button.blur());
}

export function view(path) {
    if (!path) {
        document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
        return;
    }
    const pages = path.split("/");
    const target = document.querySelector(`[data-modal-page="${pages[pages.length - 1]}"]`);
    const title = target.getAttribute("data-page-title") || path;
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
    const previous = pages.slice(0, pages.length - 1).join("/");
    const buttons = [
        {
            text: `<i class="ri-close-fill"></i> Close`,
            class: "pill",
            close: true,
        },
    ];
    if (previous) {
        buttons.unshift({
            text: `<i class="ri-arrow-left-s-line"></i> Back`,
            class: "pill",
            close: false,
            onclick: () => {
                view(previous);
            },
        });
    }
    show(
        document.querySelector(`[data-modal-page="${pages[0]}"]`),
        title,
        buttons,
    );
}

export function modeless(icon, message) {
    document.querySelector("div.modeless")?.remove();
    const element = document.createElement("div");
    const keyframes = [
        { opacity: 0 },
        { opacity: 1 },
    ];
    element.className = "modeless";
    element.append(
        new Element("h2", icon).element,
        new Element("p", message).element,
    );
    element.animate(keyframes, {
        duration: 100,
        fill: "forwards",
    });
    setTimeout(() => {
        element.animate(keyframes, {
            duration: 100,
            direction: "reverse",
            fill: "forwards",
        });
        setTimeout(() => {
            element.remove();
        }, 100);
    }, 2400);
    document.body.append(element);
}

export class Element {
    constructor(tag, text, events, className) {
        this.tag = tag;
        this.text = text;
        this.events = events;
        this.className = className;
    }

    get element() {
        const element = document.createElement(this.tag);
        element.innerHTML = this.text;
        element.className = this.className;
        this.events && Object.keys(this.events).forEach(type => {
            const listener = this.events[type];
            element.addEventListener(type, listener);
        });
        return element;
    }
}

document.querySelectorAll("[data-modal-view]").forEach(element => {
    element.addEventListener("click", e => {
        const path = element.getAttribute("data-modal-view");
        view(path);
    });
});