import * as ui from "./ui.js";
import storage from "./storage.js";
import * as themes from "../themes/themes.js";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;

var authModalOpen = false;
var hasOTP = false;

function removeDuplicates(array) {
    const seen = new Set();
    return array.filter(item => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function sortKeys(obj) {
    return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
    }, {});
}

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
                    ui.clearToasts();
                    ui.view();
                    authModalOpen = false;
                    ui.setUnsavedChanges(false);
                    returnFunction();
                },
                close: true,
            },
        ],
        required: true,
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
                    ui.clearToasts();
                    ui.view();
                    authModalOpen = false;
                    ui.setUnsavedChanges(false);
                    returnFunction();
                },
                close: true,
            },
        ],
        required: true,
    });
    authModalOpen = true;
    return;
}

export function logout(returnFunction = null) {
    storage.delete("usr");
    storage.delete("pwd");
    storage.delete("code");
    ui.view();
    ui.setUnsavedChanges(false);
    if (returnFunction) returnFunction();
    return;
}

export async function sync(hideWelcome = true) {
    ui.startLoader();
    if (!storage.get("code")) {
        ui.view();
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
        ui.stopLoader();
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
        ui.view();
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
                        ui.setUnsavedChanges(false);
                        sync(hideWelcome);
                    },
                    close: true,
                },
            ],
            required: true,
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
                                sync(hideWelcome);
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
            .then(async r => {
                var OTP = storage.get("otp");
                if (!hideWelcome) ui.toast("Welcome back!", 3000, "success", "bi bi-key");
                const combinedHistory = {
                    "questionsAnswered": (!r.history || Object.keys(r.history).length === 0)
                        ? storage.get("questionsAnswered") || []
                        : removeDuplicates([...r.history.questionsAnswered, ...(storage.get("questionsAnswered") || [])]),
                    "history": (!r.history || Object.keys(r.history).length === 0)
                        ? storage.get("history") || []
                        : removeDuplicates([...r.history.history, ...(storage.get("history") || [])]),
                };
                if ((JSON.stringify(sortKeys(r.settings)) === JSON.stringify(sortKeys(Object.fromEntries(
                    Object.entries(storage.all()).filter(([key]) =>
                        key !== "otp" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history"
                    )
                )))) && (JSON.stringify(sortKeys(r.history)) === JSON.stringify(sortKeys({
                    "questionsAnswered": storage.get("questionsAnswered"),
                    "history": storage.get("history"),
                })))) {
                    ui.stopLoader();
                    return;
                }
                await fetch(domain + '/otp', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "seatCode": storage.get("code"),
                        "OTP": OTP,
                        "settings": (Object.keys(r.settings).length === 0) ? Object.fromEntries(
                            Object.entries(storage.all()).filter(([key]) =>
                                key !== "otp" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history"
                            )
                        ) : r.settings,
                        "history": combinedHistory,
                    })
                })
                    .then(async (r) => {
                        if (!r.ok) {
                            try {
                                var re = await r.json();
                                if (re.error || re.message) {
                                    ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                                    if ((re.error === "Access denied.") || (re.message === "Access denied.")) syncManual();
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
                    .catch((e) => {
                        console.error(e);
                        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
                    });
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
                                        sync(hideWelcome);
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
                    .then(async r => {
                        if (r.settings && Object.keys(r.settings).length > 0) {
                            Object.entries(r.settings).forEach(([key, value]) => {
                                if (key !== "otp" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history") storage.set(key, value);
                            });
                            await themes.syncTheme();
                        }
                        if (r.history && Object.keys(r.history).length > 0) {
                            Object.entries(r.history).forEach(([key, value]) => {
                                if (key === "questionsAnswered" || key === "history") storage.set(key, value);
                            });
                        }
                        ui.setUnsavedChanges(false);
                        window.location.reload();
                    })
                    .catch((e) => {
                        console.error(e);
                        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
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
            body: `<p>Set an OTP for seat code <code>${storage.get("code")}</code>. This OTP will be required to sync, backup, and restore your settings and history between devices, and cannot be reset by students.</p>`,
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
                                ui.setUnsavedChanges(false);
                                sync(hideWelcome);
                            })
                            .catch((e) => {
                                console.error(e);
                                if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
                            });
                    },
                    close: true,
                },
            ],
            required: true,
        });
    }
    return;
}

export async function syncPush(type, key = null) {
    if (!type) return;
    if ((type !== "settings") && (type !== "history")) return;
    if ((type === "settings") && !key) return;
    if (!storage.get("code")) {
        ui.view();
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
        ui.view();
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
                        ui.setUnsavedChanges(false);
                        syncPush();
                    },
                    close: true,
                },
            ],
            required: true,
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
                                syncPush();
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
            .then(async r => {
                var OTP = storage.get("otp");
                var out = {};
                if (type === "settings") {
                    r.settings[key] = storage.get(key);
                    out = r.settings;
                } else if (type === "history") {
                    out = {
                        "questionsAnswered": (!r.history || Object.keys(r.history).length === 0)
                            ? storage.get("questionsAnswered") || []
                            : removeDuplicates([...r.history.questionsAnswered, ...(storage.get("questionsAnswered") || [])]),
                        "history": (!r.history || Object.keys(r.history).length === 0)
                            ? storage.get("history") || []
                            : removeDuplicates([...r.history.history, ...(storage.get("history") || [])]),
                    };
                }
                await fetch(domain + '/otp', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "seatCode": storage.get("code"),
                        "OTP": OTP,
                        [type]: out,
                    })
                })
                    .then(async (r) => {
                        if (!r.ok) {
                            try {
                                var re = await r.json();
                                if (re.error || re.message) {
                                    ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                                    if ((re.error === "Access denied.") || (re.message === "Access denied.")) syncManual();
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
                        ui.setUnsavedChanges(false);
                    })
                    .catch((e) => {
                        console.error(e);
                        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
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
            body: `<p>Set an OTP for seat code <code>${storage.get("code")}</code>. This OTP will be required to sync, backup, and restore your settings and history between devices, and cannot be reset by students.</p>`,
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
                                ui.setUnsavedChanges(false);
                                syncPush();
                            })
                            .catch((e) => {
                                console.error(e);
                                if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
                            });
                    },
                    close: true,
                },
            ],
            required: true,
        });
    }
    return;
}

export async function syncManual(hideWelcome = false) {
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
                        ui.setUnsavedChanges(false);
                        syncManual();
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
                                syncManual();
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
                var OTP = storage.get("otp");
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
                                                        "OTP": OTP,
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
                                                                    if ((re.error === "Access denied.") || (re.message === "Access denied.")) syncManual();
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
                                        }, domain, OTP)
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
                                                        "OTP": OTP,
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
                                                                    if ((re.error === "Access denied.") || (re.message === "Access denied.")) syncManual();
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
                                        }, domain, OTP)
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
                                        }, domain, OTP)
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
                                        }, domain, OTP)
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
            body: `<p>Set an OTP for seat code <code>${storage.get("code")}</code>. This OTP will be required to sync, backup, and restore your settings and history between devices, and cannot be reset by students.</p>`,
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
                                ui.setUnsavedChanges(false);
                                syncManual();
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
                    ui.setUnsavedChanges(false);
                    syncManual(true);
                },
                close: true,
            },
            {
                text: 'Continue',
                class: 'submit-button',
                onclick: async () => {
                    func();
                    if (otp) storage.set("otp", otp);
                    ui.setUnsavedChanges(false);
                    syncManual(true);
                },
                close: true,
            },
        ],
    });
}

export async function loadAdminSettings(courses) {
    await fetch(domain + '/user/settings', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "usr": (window.location.pathname === '/ta/') ? storage.get("code") : storage.get("usr"),
            "pwd": storage.get("pwd"),
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
            if ((window.location.pathname !== '/ta/') && (r.default_page !== null) && document.referrer && (document.referrer.split(window.location.origin)[1] === '/') && (r.default_page !== window.location.pathname)) window.location.href = r.default_page;
            if (r.default_course !== null) ui.setDefaultCourse(r.default_course);
            const pagesList = document.getElementById("default-page");
            const coursesList = document.getElementById("default-course");
            if (!pagesList || !coursesList) return;
            pagesList.innerHTML = '';
            if (window.location.pathname === '/ta/') {
                const option = document.createElement("option");
                option.value = '/ta/';
                option.textContent = 'Responses';
                pagesList.appendChild(option);
                pagesList.disabled = true;
            } else {
                [...document.querySelector('.menu-icons').children].forEach(item => {
                    if (!item.getAttribute('href').includes('/admin')) return;
                    const option = document.createElement("option");
                    option.value = item.getAttribute('href');
                    option.textContent = item.getAttribute('tooltip');
                    if (r.default_page && (option.value === r.default_page)) option.selected = true;
                    pagesList.appendChild(option);
                });
            }
            coursesList.innerHTML = '<option value="">Select Course</option>';
            courses.forEach(course => {
                const option = document.createElement("option");
                option.value = course.id;
                option.textContent = course.name;
                if (r.default_course && (String(option.value) === String(r.default_course))) option.selected = true;
                coursesList.appendChild(option);
            });
            ui.reloadUnsavedInputs();
            document.getElementById("save-admin-settings").addEventListener("click", async () => {
                await fetch(domain + '/user/settings', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "usr": (window.location.pathname === '/ta/') ? storage.get("code") : storage.get("usr"),
                        "pwd": storage.get("pwd"),
                        "page": pagesList.value,
                        "course": coursesList.value,
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
                    .then(() => {
                        ui.setUnsavedChanges(false);
                        ui.toast("Successfully saved settings.", 3000, "success", "bi bi-check-lg");
                    })
                    .catch((e) => {
                        console.error(e);
                        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
                    });
            });
        })
        .catch((e) => {
            console.error(e);
            if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        });
}