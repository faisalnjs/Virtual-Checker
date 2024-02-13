import "./themes.css";
import themes from "./themes.json";

import storage from "/src/modules/storage.js";

themes.forEach(theme => {
    const value = theme[0];
    const name = theme[1] || theme[0];

    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    document.querySelector("#theme-selector").append(option);
});

if (storage.get("theme") == "custom") {
    // Custom theme
    applyCustomTheme();
    document.getElementById("theme-selector").value = "";
} else {
    // Built-in theme
    document.body.setAttribute("data-theme", storage.get("theme") || "");
    document.getElementById("theme-preview").setAttribute("data-theme", storage.get("theme") || "");
    document.getElementById("theme-selector").value = storage.get("theme") || "";
}
enableTransitions();

document.getElementById("theme-selector").addEventListener("input", e => {
    const value = e.target.value;
    document.getElementById("theme-preview").setAttribute("data-theme", value);
})

document.getElementById("theme-apply").addEventListener("click", () => {
    const value = document.getElementById("theme-selector").value;
    disableTransitions();
    document.body.setAttribute("data-theme", value);
    removeCustomTheme();
    enableTransitions();
    storage.set("theme", value);
})

document.getElementById("theme-reset").addEventListener("click", resetTheme);

function resetTheme() {
    disableTransitions();
    document.body.removeAttribute("data-theme");
    removeCustomTheme();
    document.getElementById("theme-preview").removeAttribute("data-theme");
    document.getElementById("theme-selector").value = "";
    enableTransitions();
    storage.delete("theme");
    storage.delete("custom-theme");
}

export function disableTransitions() {
    document.body.classList.remove("enable-transitions");
}

export function enableTransitions() {
    document.body.offsetHeight;
    document.body.classList.add("enable-transitions");
}

// Editor

const defaultTheme = {
    "color-scheme": "light",
    "text-color": "#242424",
    "background-color": "#fafafa",
    "surface-color": "#e7e7e7",
    "accent-color": "#242424",
    "accent-text-color": "#ffffff",
    "error-color": "#fa8796",
};

const customTheme = storage.get("custom-theme") || defaultTheme;

updateEditorFields();
updateEditorPreview();
updateThemeCode();

document.querySelectorAll("#theme-editor :is(input, select)").forEach(input => {
    input.addEventListener("input", e => {
        customTheme[e.target.name] = e.target.value;
        updateEditorPreview();
        updateThemeCode();
    });
});

document.getElementById("editor-apply").addEventListener("click", () => {
    storage.set("custom-theme", customTheme);
    storage.set("theme", "custom");
    applyCustomTheme();
});

document.getElementById("editor-reset").addEventListener("click", () => {
    Object.assign(customTheme, defaultTheme);
    updateEditorFields();
    updateEditorPreview();
    updateThemeCode();
});

document.getElementById("theme-code").addEventListener("input", e => {
    if (e.target.value?.trim()) {
        const theme = decodeThemeCode(e.target.value);
        theme && updateEditorPreview(theme);
    }
});

document.getElementById("theme-code").addEventListener("blur", validateThemeCode);
document.getElementById("theme-code").addEventListener("keydown", e => {
    if (e.key == "Enter") {
        validateThemeCode();
    }
});

function validateThemeCode() {
    const code = document.getElementById("theme-code").value;
    const theme = decodeThemeCode(code);
    if (theme) {
        Object.assign(customTheme, theme);
        updateEditorFields();
        updateEditorPreview();
    }
    updateThemeCode();
}

function updateEditorFields() {
    Object.entries(customTheme).forEach(([key, value]) => {
        const event = new Event("update");
        const input = document.querySelector(`#theme-editor [name="${key}"]`);
        input.value = value;
        input.dispatchEvent(event);
    });
}

function updateEditorPreview(theme = customTheme) {
    const preview = document.getElementById("editor-preview");
    Object.entries(theme).forEach(([key, value]) => {
        const prefix = key == "color-scheme" ? "" : "--";
        preview.style.setProperty(prefix + key, value);
    });
}

function applyCustomTheme() {
    if (!storage.get("custom-theme")) return;
    Object.entries(storage.get("custom-theme")).forEach(([key, value]) => {
        const prefix = key == "color-scheme" ? "" : "--";
        document.body.style.setProperty(prefix + key, value);
    });
    document.getElementById("theme-selector").value = "";
    document.getElementById("theme-preview").removeAttribute("data-theme");
}

function removeCustomTheme() {
    if (!storage.get("custom-theme")) return;
    Object.keys(storage.get("custom-theme")).forEach(key => {
        const prefix = key == "color-scheme" ? "" : "--";
        document.body.style.removeProperty(prefix + key);
    });
}

function updateThemeCode() {
    document.getElementById("theme-code").value = encodeThemeCode(customTheme);
}

function encodeThemeCode(theme) {
    return "VC" + btoa(Object.values(theme).join(","));
}

function decodeThemeCode(code) {
    try {
        const keys = Object.keys(defaultTheme);
        const values = atob(code.substring(2)).split(",");
        if (values.length != keys.length) {
            throw new Error();
        }
        return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
    } catch (e) {
        return false;
    }
}

// Load theme editor
document.querySelector(`[data-modal-page="editor"]`).addEventListener("view", () => {
    Object.assign(customTheme, storage.get("custom-theme") || defaultTheme);
    updateEditorFields();
    updateEditorPreview();
    updateThemeCode();
});

document.addEventListener("keydown", e => {
    if (e.shiftKey && e.key == "R") {
        resetTheme();
    }
});