export function alert(title, body, callback, blur) {
    modal(title, new Element("p", body).element.outerHTML, [
        new ModalButton("Okay", true, callback)
    ], blur);
}

export function prompt(title, body, accept, decline, blur) {
    modal(title, new Element("p", body).element.outerHTML, [
        new ModalButton("Close", true, decline),
        new ModalButton("Okay", true, accept),
    ], blur);
}

export function modal(title, body, buttons, blur) {
    const dialog = document.createElement("dialog");

    const buttonContainer = document.createElement("div");
    buttons.forEach(button => {
        buttonContainer.append(
            new Element("button", button.text, () => {
                button.close && dialog.close();
                button.callback && button.callback();
            }).element
        );
    });

    dialog.append(new Element("h2", title).element);
    dialog.innerHTML += body;
    dialog.append(buttonContainer);

    document.body.append(dialog);
    dialog.showModal();

    blur && buttonContainer.querySelectorAll("button").forEach(button => button.blur());

    dialog.addEventListener("close", () => {
        dialog.remove();
    });
}

export function show(dialog, title, buttons, blur) {
    const titleElement = new Element("h2", title).element;
    const buttonContainer = document.createElement("div");
    buttons.forEach(button => {
        buttonContainer.append(
            new Element("button", button.text, () => {
                button.close && dialog.close();
                button.callback && button.callback();
            }).element
        );
    });

    dialog.open && dialog.close();

    dialog.prepend(titleElement);
    dialog.append(buttonContainer);

    dialog.showModal();
    
    blur && buttonContainer.querySelectorAll("button").forEach(button => button.blur());

    dialog.addEventListener("close", () => {
        titleElement.remove();
        buttonContainer.remove();
    });
}

export class ModalButton {
    constructor(text, close, callback) {
        this.text = text;
        this.close = close;
        this.callback = callback;
    }
}

export class Element {
    constructor(tag, text, onclick) {
        this.tag = tag;
        this.text = text;
        this.onclick = onclick;
    }

    get element() {
        const element = document.createElement(this.tag);
        element.textContent = this.text;
        this.onclick && element.addEventListener("click", this.onclick);
        return element;
    }
}