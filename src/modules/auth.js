import * as ui from "./ui.js";
import storage from "./storage.js";

var authModalOpen = false;
var hasOTP = false;

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

export async function sync(domain, hideWelcome = false) {
    ui.view();
    if (!storage.get("code")) {
        ui.modal({
            title: 'Error',
            body: '<p>No seat code found. Please enter a valid seat code first.</p>',
            buttons: [
                {
                    text: 'OK',
                    class: 'submit-button',
                    close: true,
                },
            ],
        });
        return;
    }
    await fetch(domain + '/otp', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "seatCode": storage.get("code"),
        })
    })
        .then(r => {
            hasOTP = r.ok ? true : false;
        })
        .catch((e) => {
            console.error(e);
            if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        });
    if (hasOTP && !storage.get("otp")) {
        ui.modal({
            title: 'Enter OTP',
            body: `<p>Enter the existing OTP for seat code <code>${storage.get("code")}</code>. Contact an administrator to reset your OTP.</p>`,
            input: {
                type: 'password'
            },
            buttons: [
                {
                    text: 'Verify',
                    class: 'submit-button',
                    onclick: (inputValue) => {
                        storage.set("otp", inputValue);
                        sync(domain);
                    },
                    close: true,
                },
            ],
        });
    } else if (hasOTP && storage.get("otp")) {
        await fetch(domain + '/otp', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "seatCode": storage.get("code"),
                "OTP": storage.get("otp"),
            })
        })
            .then(async (r) => {
                if (!r.ok) {
                    try {
                        var re = await r.json();
                        if (re.error || re.message) {
                            ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                            if ((re.error === "Access denied.") || (re.message === "Access denied.")) {
                                if (storage.get("otp")) storage.delete("otp");
                                sync(domain);
                            }
                            throw new Error(re.error || re.message);
                        } else {
                            throw new Error("API error");
                        }
                    } catch (e) {
                        throw new Error(e.message || "API error");
                    }
                }
                return await r.json();
            })
            .then(r => {
                var tempOTP = storage.get("otp");
                storage.delete("otp");
                if (!hideWelcome) ui.toast("Welcome back!", 3000, "success", "bi bi-key");
                ui.modal({
                    title: 'Sync Settings & History',
                    body: `<p>Backup and restore your current settings and history to seat code <code>${storage.get("code")}</code>. This action is not reversible. Contact an administrator to restore a backup of your settings or history.</p>`,
                    buttonGroups: [
                        {
                            label: 'Backup',
                            icon: 'bi-cloud-arrow-up',
                            buttons: [
                                {
                                    icon: 'bi-gear',
                                    text: 'Settings',
                                    onclick: () => {
                                        prompt(true, 'settings', async () => {
                                            if (storage.all() && Object.keys(storage.all()).length > 0) {
                                                await fetch(domain + '/otp', {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        "seatCode": storage.get("code"),
                                                        "OTP": tempOTP,
                                                        "settings": Object.fromEntries(
                                                            Object.entries(storage.all()).filter(([key]) =>
                                                                key !== "otp" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history"
                                                            )
                                                        ),
                                                    })
                                                })
                                                    .then(async (r) => {
                                                        if (!r.ok) {
                                                            try {
                                                                var re = await r.json();
                                                                if (re.error || re.message) {
                                                                    ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                                                                    if ((re.error === "Access denied.") || (re.message === "Access denied.")) sync(domain);
                                                                    throw new Error(re.error || re.message);
                                                                } else {
                                                                    throw new Error("API error");
                                                                }
                                                            } catch (e) {
                                                                throw new Error(e.message || "API error");
                                                            }
                                                        }
                                                        return await r.json();
                                                    })
                                                    .then(() => {
                                                        ui.toast("Settings backed up successfully!", 3000, "success", "bi bi-check-circle-fill");
                                                    })
                                                    .catch((e) => {
                                                        console.error(e);
                                                        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
                                                    });
                                            } else {
                                                ui.toast("No settings found to backup.", 3000, "warning", "bi bi-exclamation-triangle-fill");
                                            }
                                        }, domain, tempOTP)
                                    },
                                    close: true,
                                },
                                {
                                    icon: 'bi-clock-history',
                                    text: 'History',
                                    onclick: () => {
                                        prompt(true, 'history', async () => {
                                            if (storage.get("history") && storage.get("history").length > 0) {
                                                await fetch(domain + '/otp', {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        "seatCode": storage.get("code"),
                                                        "OTP": tempOTP,
                                                        "history": {
                                                            "questionsAnswered": storage.get("questionsAnswered"),
                                                            "history": storage.get("history"),
                                                        },
                                                    })
                                                })
                                                    .then(async (r) => {
                                                        if (!r.ok) {
                                                            try {
                                                                var re = await r.json();
                                                                if (re.error || re.message) {
                                                                    ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                                                                    if ((re.error === "Access denied.") || (re.message === "Access denied.")) sync(domain);
                                                                    throw new Error(re.error || re.message);
                                                                } else {
                                                                    throw new Error("API error");
                                                                }
                                                            } catch (e) {
                                                                throw new Error(e.message || "API error");
                                                            }
                                                        }
                                                        return await r.json();
                                                    })
                                                    .then(() => {
                                                        ui.toast("History backed up successfully!", 3000, "success", "bi bi-check-circle-fill");
                                                    })
                                                    .catch((e) => {
                                                        console.error(e);
                                                        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
                                                    });
                                            } else {
                                                ui.toast("No history found to backup.", 3000, "warning", "bi bi-exclamation-triangle-fill");
                                            }
                                        }, domain, tempOTP)
                                    },
                                    close: true,
                                },
                            ],
                        },
                        {
                            label: 'Restore',
                            icon: 'bi-cloud-arrow-down',
                            buttons: [
                                {
                                    icon: 'bi-gear',
                                    text: 'Settings',
                                    onclick: () => {
                                        prompt(false, 'settings', () => {
                                            if (r.settings && Object.keys(r.settings).length > 0) {
                                                Object.entries(r.settings).forEach(([key, value]) => {
                                                    if (key !== "otp" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history") storage.set(key, value);
                                                });
                                                ui.toast("Settings restored successfully!", 3000, "success", "bi bi-check-circle-fill");
                                                window.location.reload();
                                            } else {
                                                ui.toast("No settings found to restore.", 3000, "warning", "bi bi-exclamation-triangle-fill");
                                            }
                                        }, domain, tempOTP)
                                    },
                                    close: true,
                                },
                                {
                                    icon: 'bi-clock-history',
                                    text: 'History',
                                    onclick: () => {
                                        prompt(false, 'history', () => {
                                            if (r.history && Object.keys(r.history).length > 0) {
                                                Object.entries(r.history).forEach(([key, value]) => {
                                                    if (key === "questionsAnswered" || key === "history") storage.set(key, value);
                                                });
                                                ui.toast("History restored successfully!", 3000, "success", "bi bi-check-circle-fill");
                                                window.location.reload();
                                            } else {
                                                ui.toast("No history found to restore.", 3000, "warning", "bi bi-exclamation-triangle-fill");
                                            }
                                        }, domain, tempOTP)
                                    },
                                    close: true,
                                },
                            ],
                        },
                    ],
                });
            })
            .catch((e) => {
                console.error(e);
                if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
            });
    } else if (!hasOTP) {
        if (storage.get("otp")) storage.delete("otp");
        ui.modal({
            title: 'Set OTP',
            body: `<p>Set an OTP for seat code <code>${storage.get("code")}</code>. This OTP will be required to backup and/or restore your settings and history between devices, and cannot be reset by students.</p>`,
            input: {
                type: 'password'
            },
            buttons: [
                {
                    text: 'Set OTP',
                    class: 'submit-button',
                    onclick: async (inputValue) => {
                        storage.set("otp", inputValue);
                        await fetch(domain + '/otp', {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                "seatCode": storage.get("code"),
                                "OTP": inputValue,
                            })
                        })
                            .then(async (r) => {
                                if (!r.ok) {
                                    try {
                                        var re = await r.json();
                                        if (re.error || re.message) {
                                            ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                                            throw new Error(re.error || re.message);
                                        } else {
                                            throw new Error("API error");
                                        }
                                    } catch (e) {
                                        throw new Error(e.message || "API error");
                                    }
                                }
                                return await r.json();
                            })
                            .then(r => {
                                ui.toast(r.message, 3000, "success", "bi bi-key");
                                sync(domain);
                            })
                            .catch((e) => {
                                console.error(e);
                                if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
                            });
                    },
                    close: true,
                },
            ],
        });
    }
    return;
}

function prompt(backingUp = true, type = 'settings', func = () => { }, domain, otp) {
    ui.modal({
        title: 'Are you sure?',
        body: `<p>${backingUp ? 'Backing up' : 'Restoring'} ${type} will forever remove your currently ${backingUp ? 'backed up' : 'set'} ${type}. This action is not reversible.</p>`,
        buttons: [
            {
                text: 'Back',
                class: 'cancel-button',
                onclick: () => {
                    if (otp) storage.set("otp", otp);
                    sync(domain, true);
                },
                close: true,
            },
            {
                text: 'Continue',
                class: 'submit-button',
                onclick: async () => {
                    func();
                    if (otp) storage.set("otp", otp);
                    sync(domain, true);
                },
                close: true,
            },
        ],
    });
}