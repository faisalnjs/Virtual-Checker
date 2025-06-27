import * as ui from "./ui.js";
import storage from "./storage.js";

var authModalOpen = false;

export function admin(returnFunction) {
    ui.view();
    if (authModalOpen) return;
    ui.startLoader();
    ui.modal({
        title: 'Authentication Required',
        body: '<p>Authenticate to access Virtual Checker administrator-only secured API endpoints.</p>',
        inputs: [
            {
                label: 'Username',
                type: 'text',
                placeholder: 'Username',
            },
            {
                label: 'Password',
                type: 'password',
                placeholder: 'Password',
            }
        ],
        buttons: [
            {
                text: 'Verify',
                class: 'submit-button',
                onclick: (inputValues) => {
                    storage.set("usr", inputValues[0]);
                    storage.set("pwd", inputValues[1]);
                    ui.view();
                    authModalOpen = false;
                    returnFunction();
                },
                close: true,
            },
        ],
    });
    authModalOpen = true;
    return;
}

export function ta(returnFunction) {
    ui.view();
    if (authModalOpen) return;
    ui.startLoader();
    ui.modal({
        title: 'Enter Password',
        body: `<p>Enter the assigned password for TA seat code <code>${storage.get("code")}</code>.</p>`,
        input: {
            type: 'password'
        },
        buttons: [
            {
                text: 'Verify',
                class: 'submit-button',
                onclick: (inputValue) => {
                    storage.set("pwd", inputValue);
                    ui.view();
                    authModalOpen = false;
                    returnFunction();
                },
                close: true,
            },
        ],
    });
    authModalOpen = true;
    return;
}

export function logout(returnFunction = null) {
    storage.delete("usr");
    storage.delete("pwd");
    storage.delete("code");
    ui.view();
    if (returnFunction) returnFunction();
    return;
}