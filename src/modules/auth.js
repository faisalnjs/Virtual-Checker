import * as ui from "./ui.js";
import storage from "./storage.js";
import * as themes from "../themes/themes.js";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;

var authModalOpen = false;
var hasPassword = false;

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
                text: 'Back',
                class: 'cancel-button',
                onclick: () => {
                    authModalOpen = false;
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
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
    ui.setUnsavedChanges(false);
    if (returnFunction) returnFunction();
    return;
}

export async function sync(hideWelcome = true, returnFunction = null) {
    ui.startLoader();
    if (!storage.get("code")) {
        ui.view();
        authModalOpen = false;
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
    try {
        var userPassword = await fetch(domain + '/password', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "seatCode": storage.get("code"),
            })
        });
        hasPassword = userPassword.ok ? true : false;
    } catch (e) {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        return;
    }
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
                        authModalOpen = false;
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
                        sync(hideWelcome, returnFunction);
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
                                sync(hideWelcome, returnFunction);
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
                ui.stopLoader();
                var password = storage.get("password");
                if (!hideWelcome) ui.toast("Welcome back!", 3000, "success", "bi bi-key");
                ui.setNotifications(r.notifications);
                if (r.notifications.length > 0) ui.toast(`You have ${r.notifications.length} unread notification${(r.notifications.length === 1) ? '' : 's'}.`, 5000, 'info', 'bi bi-bell-fill');
                const combinedSettings = sortKeys({
                    ...Object.fromEntries(
                        Object.entries(storage.all()).filter(([key]) => key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "history" && key !== "questionsAnswered" && key !== "developer" && key !== "cache" && key !== "lastBulkLoad" && key !== "adminCache" && key !== "lastAdminBulkLoad")
                    ),
                    ...Object.fromEntries(
                        Object.entries(r.settings).filter(([key]) => key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "history" && key !== "questionsAnswered" && key !== "developer" && key !== "cache" && key !== "lastBulkLoad" && key !== "adminCache" && key !== "lastAdminBulkLoad")
                    ),
                });
                var settingsIsSynced = JSON.stringify(sortKeys(Object.fromEntries(
                    Object.entries(r.settings).filter(([key]) => key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "history" && key !== "questionsAnswered" && key !== "developer" && key !== "cache" && key !== "lastBulkLoad" && key !== "adminCache" && key !== "lastAdminBulkLoad")
                ))) === JSON.stringify(sortKeys(Object.fromEntries(
                    Object.entries(storage.all()).filter(([key]) => key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "history" && key !== "questionsAnswered" && key !== "developer" && key !== "cache" && key !== "lastBulkLoad" && key !== "adminCache" && key !== "lastAdminBulkLoad")
                )));
                console.log(`${settingsIsSynced ? '🟢' : '🟡'} Settings is ${!settingsIsSynced ? 'not ' : ''}synced!`);
                if (settingsIsSynced) {
                    if (document.getElementById('checker')) document.getElementById('checker').classList = r.settings['layout'] || '';
                    if (returnFunction) returnFunction();
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
                                if (key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "history" && key !== "questionsAnswered" && key !== "developer" && key !== "cache" && key !== "lastBulkLoad" && key !== "adminCache" && key !== "lastAdminBulkLoad") storage.set(key, value);
                            });
                            await themes.syncTheme();
                            if (document.getElementById('checker')) document.getElementById('checker').classList = r.settings['layout'] || '';
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
            body: `<p>Set a password for seat code <code>${storage.get("code")}</code>. This password will be required to sync, backup, and restore your settings between devices, and cannot be reset by students.</p>`,
            input: {
                type: 'password'
            },
            buttons: [
                {
                    text: 'Back',
                    class: 'cancel-button',
                    onclick: () => {
                        authModalOpen = false;
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
                            .then(async r => {
                                ui.stopLoader();
                                ui.toast(r.message, 3000, "success", "bi bi-key");
                                ui.setUnsavedChanges(false);
                                await ui.launchWelcome(returnFunction);
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

export async function syncPush(key = null) {
    if (!key || !storage.get("code")) return;
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
            r.settings[key] = storage.get(key);
            await fetch(domain + '/password', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "seatCode": storage.get("code"),
                    "password": password,
                    "settings": r.settings,
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
    authModalOpen = false;
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
                title: 'Manual Sync',
                body: `<p>Backup and restore your current settings to seat code <code>${storage.get("code")}</code>. This action is not reversible. Contact an administrator to restore a backup of your settings.</p>`,
                buttonGroups: [
                    {
                        label: 'Backup',
                        icon: 'bi-cloud-arrow-up',
                        buttons: [
                            {
                                icon: 'bi-gear',
                                text: 'Settings',
                                onclick: () => {
                                    prompt(true, async () => {
                                        if (storage.all() && Object.keys(storage.all()).length > 0) {
                                            await fetch(domain + '/password', {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({
                                                    "seatCode": storage.get("code"),
                                                    "password": password,
                                                    "settings": Object.fromEntries(Object.entries(storage.all()).filter(([key]) => key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "history" && key !== "questionsAnswered" && key !== "developer" && key !== "cache" && key !== "lastBulkLoad" && key !== "adminCache" && key !== "lastAdminBulkLoad")),
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
                                    prompt(false, () => {
                                        if (r.settings && Object.keys(r.settings).length > 0) {
                                            Object.entries(r.settings).forEach(([key, value]) => {
                                                if (key !== "password" && key !== "code" && key !== "usr" && key !== "pwd" && key !== "history" && key !== "questionsAnswered" && key !== "developer" && key !== "cache" && key !== "lastBulkLoad" && key !== "adminCache" && key !== "lastAdminBulkLoad") storage.set(key, value);
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

function prompt(backingUp = true, func = () => { }, domain, password) {
    ui.modal({
        title: 'Are you sure?',
        body: `<p>${backingUp ? 'Backing up' : 'Restoring'} settings will forever remove your currently ${backingUp ? 'backed up' : 'set'} settings. This action is not reversible.</p>`,
        buttons: [
            {
                text: 'Back',
                class: 'cancel-button',
                onclick: () => {
                    if (password) storage.set("password", password);
                    authModalOpen = false;
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
            "usr": window.location.pathname.startsWith('/ta/') ? storage.get("code") : storage.get("usr"),
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
            const rowsPerPageList = document.getElementById("default-rows-per-page");
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
            rowsPerPageList.value = r.default_rows_per_page || '10';
            storage.set('rowsPerPage', rowsPerPageList.value);
            ui.reloadUnsavedInputs();
            document.getElementById("save-admin-settings").addEventListener("click", async () => {
                await fetch(domain + '/user/settings', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "usr": window.location.pathname.startsWith('/ta/') ? storage.get("code") : storage.get("usr"),
                        "pwd": storage.get("pwd"),
                        "page": pagesList.value,
                        "course": coursesList.value,
                        "rows": rowsPerPageList.value,
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
                        storage.delete('period');
                        ui.setUnsavedChanges(false);
                        ui.toast("Successfully saved settings. Reload to see changes.", 3000, "success", "bi bi-check-lg");
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

export async function bulkLoad(fields = [], usr = null, pwd = null, isAdmin = false, isTA = false, ifAccessDenied = () => { }) {
    const startTime = Date.now();
    await storage.idbReady;
    const syncDeleted = async () => {
        const cacheIds = {};
        const cache = (await storage.idbGet((isAdmin || isTA) ? "adminCache" : "cache")) ||
            storage.get((isAdmin || isTA) ? "adminCache" : "cache") || {};
        for (const table in cache) {
            if (Array.isArray(cache[table] || []))
                cacheIds[table] = (cache[table] || []).map(data =>
                    String(data.id || data.seatCode || data.period || data.key || data.username || 0));
        }
        return cacheIds;
    };
    var bulkLoadResponse;
    try {
        bulkLoadResponse = await fetch(`${domain}/bulk_load${isTA ? '?ta=true' : ''}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usr,
                pwd,
                fields,
                lastFetched: storage.get((isAdmin || isTA) ? "lastAdminBulkLoad" : "lastBulkLoad") || null,
                syncDeleted: await syncDeleted(),
            }),
        });
    } catch (e) {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        return false;
    }
    var fetchedBulkLoad = await bulkLoadResponse.json();
    if (!bulkLoadResponse.ok) {
        if (!fetchedBulkLoad.message || (fetchedBulkLoad.message && !fetchedBulkLoad.message.includes("."))) ui.view("api-fail");
        if ((fetchedBulkLoad.error === "Access denied.") || (fetchedBulkLoad.message === "Access denied.")) ifAccessDenied();
        return false;
    }
    if (fetchedBulkLoad.maintenanceMode) {
        ui.startLoader();
        ui.view("maintenance-mode");
        return false;
    }
    if (fields.includes('courses') ? (!(await storage.idbGet((isAdmin || isTA) ? "adminCache" : "cache") || {})?.['courses']?.length && !fetchedBulkLoad?.courses?.length) : false) {
        console.log('🔴 Bulk load out of sync, reloading');
        await clearBulkLoad();
        location.reload();
        return false;
    }
    var updatedBulkLoad = {};
    for (const table in fetchedBulkLoad) {
        if (table === 'asOf' || table === 'syncDeleted') continue;
        const fetchedTableData = fetchedBulkLoad[table];
        if (!Array.isArray(fetchedTableData)) {
            updatedBulkLoad[table] = fetchedTableData;
            continue;
        }
        const currentCacheKey = (isAdmin || isTA) ? "adminCache" : "cache";
        const lastBulkLoadKey = (isAdmin || isTA) ? "lastAdminBulkLoad" : "lastBulkLoad";
        if (storage.get(lastBulkLoadKey)) {
            let deletedData = fetchedBulkLoad.syncDeleted?.[table] || [];
            const cacheObj = (await storage.idbGet(currentCacheKey)) || storage.get(currentCacheKey) || {};
            const deletedSet = new Set(deletedData.map(item => String(item.id || item.seatCode || item.period || item.key || item.username || 0)));
            const existingData = Array.isArray(cacheObj[table]) ? cacheObj[table].filter(item => !deletedSet.has(String(item.id || item.seatCode || item.period || item.key || item.username || 0))) : [];
            const mergedMap = {};
            existingData.forEach(item => {
                mergedMap[String(item.id || item.seatCode || item.period || item.key || item.username || 0)] = item;
            });
            (fetchedBulkLoad[table] || []).forEach(newItem => {
                mergedMap[String(newItem.id || newItem.seatCode || newItem.period || newItem.key || newItem.username || 0)] = newItem;
            });
            updatedBulkLoad[table] = Object.values(mergedMap);
        } else {
            updatedBulkLoad[table] = fetchedBulkLoad[table];
        }
    }
    storage.set((isAdmin || isTA) ? "lastAdminBulkLoad" : "lastBulkLoad", fetchedBulkLoad.asOf || null);
    try {
        await storage.idbSet((isAdmin || isTA) ? "adminCache" : "cache", updatedBulkLoad || fetchedBulkLoad || {});
    } catch (e) {
        storage.set((isAdmin || isTA) ? "adminCache" : "cache", updatedBulkLoad || fetchedBulkLoad || {});
    }
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`${(loadTime < 1) ? '🟢' : ((loadTime > 5) ? '🔴' : '🟡')} Bulk load fetched in ${loadTime}s`);
    return true;
}

export async function clearBulkLoad() {
    await storage.idbReady;
    await storage.idbDelete("cache").catch((e) => console.error('IDB delete failed', e));
    storage.delete("lastBulkLoad");
    await storage.idbDelete("adminCache").catch((e) => console.error('IDB delete failed', e));
    storage.delete("lastAdminBulkLoad");
    console.log('🟢 Bulk load cleared');
}

export async function buyTheme(theme = null, cost = 0) {
    if (!theme || !cost || !storage.get("code")) return;
    await fetch(domain + '/buy_theme', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "seatCode": storage.get("code"),
            "password": storage.get("password"),
            "theme": theme,
            "cost": cost,
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
        .catch((e) => {
            console.error(e);
            if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        });
}