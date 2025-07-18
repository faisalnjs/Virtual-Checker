import * as ui from "./ui.js";
import storage from "./storage.js";
import * as themes from "../themes/themes.js";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;

var authModalOpen = false;
var hasPassword = false;

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

function highestQuestionsAnswered(array) {
    const newArray = [];
    array.forEach(question => {
        var a = newArray.find(q => (q.segment === question.segment) && (q.question === question.question));
        if (a) {
            if (((question.status === 'In Progress') && (a.status === 'Pending')) || ((question.status === 'Correct') && (a.status === 'In Progress'))) {
                a.status = question.status;
                console.log(`Found ${a.status}, replacing with ${question.status}`)
            }
        } else {
            newArray.push(question);
        }
    });
    return newArray;
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
                text: 'Back',
                class: 'cancel-button',
                onclick: () => {
                    ui.view("settings/code");
                },
                close: true,
            },
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
    storage.delete("password");
    storage.delete("history");
    storage.delete("questionsAnswered");
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
    await fetch(domain + '/password', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "seatCode": storage.get("code"),
        })
    })
        .then(r => {
            hasPassword = r.ok ? true : false;
        })
        .catch((e) => {
            console.error(e);
            if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        });
    if (hasPassword && !storage.get("password")) {
        ui.view();
        ui.modal({
            title: 'Enter Password',
            body: `<p>Enter the existing password for seat code <code>${storage.get("code")}</code>. Contact an administrator to reset your password.</p>`,
            input: {
                type: 'password'
            },
            buttons: [
                {
                    text: 'Back',
                    class: 'cancel-button',
                    onclick: () => {
                        ui.view("settings/code");
                    },
                    close: true,
                },
                {
                    text: 'Verify',
                    class: 'submit-button',
                    onclick: (inputValue) => {
                        storage.set("password", inputValue);
                        ui.setUnsavedChanges(false);
                        sync(hideWelcome);
                    },
                    close: true,
                },
            ],
            required: true,
        });
    } else if (hasPassword && storage.get("password")) {
        await fetch(domain + '/password', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "seatCode": storage.get("code"),
                "password": storage.get("password"),
            })
        })
            .then(async (r) => {
                if (!r.ok) {
                    try {
                        var re = await r.json();
                        if (re.error || re.message) {
                            ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                            if ((re.error === "Access denied.") || (re.message === "Access denied.")) {
                                if (storage.get("password")) storage.delete("password");
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
                var password = storage.get("password");
                if (!hideWelcome) ui.toast("Welcome back!", 3000, "success", "bi bi-key");
                const combinedSettings = sortKeys({
                    ...Object.fromEntries(
                        Object.entries(storage.all()).filter(([key]) =>
                            key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history"
                        )
                    ),
                    ...r.settings,
                });
                const combinedHistory = sortKeys({
                    "questionsAnswered": (!r.history || Object.keys(r.history).length === 0)
                        ? highestQuestionsAnswered(removeDuplicates(storage.get("questionsAnswered") || []))
                        : highestQuestionsAnswered(removeDuplicates([...r.history.questionsAnswered, ...(storage.get("questionsAnswered") || [])])),
                    "history": (!r.history || Object.keys(r.history).length === 0)
                        ? removeDuplicates(storage.get("history") || [])
                        : removeDuplicates([...r.history.history, ...(storage.get("history") || [])]),
                });
                var settingsIsSynced = JSON.stringify(sortKeys(r.settings)) === JSON.stringify(sortKeys(Object.fromEntries(
                    Object.entries(storage.all()).filter(([key]) =>
                        key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history"
                    )
                )));
                var historyIsSynced = JSON.stringify(sortKeys(r.history)) === JSON.stringify(sortKeys({
                    "questionsAnswered": highestQuestionsAnswered(removeDuplicates(storage.get("questionsAnswered") || [])),
                    "history": removeDuplicates(storage.get("history") || []),
                }));
                console.log(`Settings is ${!settingsIsSynced ? 'not ' : ''}synced!`);
                console.log(`History is ${!historyIsSynced ? 'not ' : ''}synced!`);
                if (settingsIsSynced && historyIsSynced) {
                    ui.stopLoader();
                    return;
                }
                await fetch(domain + '/password', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "seatCode": storage.get("code"),
                        "password": password,
                        "settings": combinedSettings,
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
                    .then(async () => {
                        if (r.settings && Object.keys(r.settings).length > 0) {
                            Object.entries(r.settings).forEach(([key, value]) => {
                                if (key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history") storage.set(key, value);
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
    } else if (!hasPassword) {
        if (storage.get("password")) storage.delete("password");
        ui.modal({
            title: 'Set Password',
            body: `<p>Set a password for seat code <code>${storage.get("code")}</code>. This password will be required to sync, backup, and restore your settings and history between devices, and cannot be reset by students.</p>`,
            input: {
                type: 'password'
            },
            buttons: [
                {
                    text: 'Back',
                    class: 'cancel-button',
                    onclick: () => {
                        ui.view("settings/code");
                    },
                    close: true,
                },
                {
                    text: 'Set Password',
                    class: 'submit-button',
                    onclick: async (inputValue) => {
                        storage.set("password", inputValue);
                        await fetch(domain + '/password', {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                "seatCode": storage.get("code"),
                                "password": inputValue,
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
    await fetch(domain + '/password', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "seatCode": storage.get("code"),
        })
    })
        .then(r => {
            hasPassword = r.ok ? true : false;
        })
        .catch((e) => {
            console.error(e);
            if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        });
    if (!hasPassword || !storage.get("password")) {
        window.location.reload();
        return;
    }
    await fetch(domain + '/password', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "seatCode": storage.get("code"),
            "password": storage.get("password"),
        })
    })
        .then(async (r) => {
            if (!r.ok) {
                try {
                    var re = await r.json();
                    if (re.error || re.message) {
                        ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                        if ((re.error === "Access denied.") || (re.message === "Access denied.")) {
                            if (storage.get("password")) storage.delete("password");
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
            var password = storage.get("password");
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
            await fetch(domain + '/password', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "seatCode": storage.get("code"),
                    "password": password,
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
    await fetch(domain + '/password', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "seatCode": storage.get("code"),
        })
    })
        .then(r => {
            hasPassword = r.ok ? true : false;
        })
        .catch((e) => {
            console.error(e);
            if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        });
    if (!hasPassword || !storage.get("password")) {
        window.location.reload();
        return;
    }
    await fetch(domain + '/password', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "seatCode": storage.get("code"),
            "password": storage.get("password"),
        })
    })
        .then(async (r) => {
            if (!r.ok) {
                try {
                    var re = await r.json();
                    if (re.error || re.message) {
                        ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
                        if ((re.error === "Access denied.") || (re.message === "Access denied.")) {
                            if (storage.get("password")) storage.delete("password");
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
            var password = storage.get("password");
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
                                            await fetch(domain + '/password', {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({
                                                    "seatCode": storage.get("code"),
                                                    "password": password,
                                                    "settings": Object.fromEntries(
                                                        Object.entries(storage.all()).filter(([key]) =>
                                                            key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history"
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
                                    }, domain, password)
                                },
                                close: true,
                            },
                            {
                                icon: 'bi-clock-history',
                                text: 'History',
                                onclick: () => {
                                    prompt(true, 'history', async () => {
                                        if (storage.get("history") && storage.get("history").length > 0) {
                                            await fetch(domain + '/password', {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({
                                                    "seatCode": storage.get("code"),
                                                    "password": password,
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
                                    }, domain, password)
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
                                                if (key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "questionsAnswered" && key !== "history") storage.set(key, value);
                                            });
                                            ui.toast("Settings restored successfully!", 3000, "success", "bi bi-check-circle-fill");
                                            window.location.reload();
                                        } else {
                                            ui.toast("No settings found to restore.", 3000, "warning", "bi bi-exclamation-triangle-fill");
                                        }
                                    }, domain, password)
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
                                    }, domain, password)
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
}

function prompt(backingUp = true, type = 'settings', func = () => { }, domain, password) {
    ui.modal({
        title: 'Are you sure?',
        body: `<p>${backingUp ? 'Backing up' : 'Restoring'} ${type} will forever remove your currently ${backingUp ? 'backed up' : 'set'} ${type}. This action is not reversible.</p>`,
        buttons: [
            {
                text: 'Back',
                class: 'cancel-button',
                onclick: () => {
                    if (password) storage.set("password", password);
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
                    if (password) storage.set("password", password);
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