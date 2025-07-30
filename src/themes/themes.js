/* eslint-disable no-inner-declarations */
import "./themes.css";
import themes from "./themes.json";

import "./butterfly/butterfly.js";
import "./festive/festive.js";

import storage from "/src/modules/storage.js";
import * as auth from "/src/modules/auth.js";
import Element from "/src/modules/element.js";

let selectedTheme = "";
const defaultTheme = {
  "color-scheme": "light",
  "text-color": "#2c2c2c",
  "background-color": "#fafafa",
  "surface-color": "#e7e7e7",
  "accent-color": "#424242",
  "accent-text-color": "#ffffff",
  "error-color": "#fa8796",
};
Object.freeze(defaultTheme);

const customTheme = Object.assign({}, storage.get("custom-theme") || defaultTheme);

export function resetTheme() {
  disableTransitions();
  document.body.removeAttribute("data-theme");
  removeCustomTheme();
  document.getElementById("theme-preview").removeAttribute("data-theme");
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

export async function syncTheme() {
  const value = storage.get("theme");
  disableTransitions();
  if (value === "custom") {
    applyCustomTheme();
    selectedTheme = "";
  } else {
    document.body.setAttribute("data-theme", value);
    removeCustomTheme();
    enableTransitions();
    // Update developer theme input
    if (document.getElementById("theme-debug")) document.getElementById("theme-debug").value = value;
  }
}

function copyThemeCSS() {
  const properties = Object.entries(customTheme)
    .filter(([key]) => key?.trim())
    .map(([key, value]) => {
      const prefix = key == "color-scheme" ? "" : "--";
      return `${prefix}${key}: ${value};`;
    });
  const css = `[data-theme="custom"] {\n  ${properties.join("\n  ")}\n}`;
  navigator.clipboard.writeText(css);
}

function validateThemeCode() {
  const code = document.getElementById("theme-code")?.value;
  const theme = decodeThemeCode(code);
  storage.get("developer") && console.log(theme);
  updateThemeCode();
  if (theme) {
    Object.assign(customTheme, theme);
    updateEditorFields();
    updateEditorPreview();
  }
}

function updateEditorFields() {
  Object.entries(customTheme).forEach(([key, value]) => {
    const event = new Event("update");
    const input = document.querySelector(`#theme-editor [name="${key}"]`);
    if (input) {
      input.value = value;
      input.dispatchEvent(event);
    }
  });
}

function updateEditorPreview(theme = customTheme) {
  const preview = document.getElementById("editor-preview");
  Object.entries(theme).forEach(([key, value]) => {
    const prefix = key == "color-scheme" ? "" : "--";
    preview?.style.setProperty(prefix + key, value);
  });
}

function applyCustomTheme() {
  if (!storage.get("custom-theme")) return;
  Object.entries(storage.get("custom-theme")).forEach(([key, value]) => {
    const prefix = key == "color-scheme" ? "" : "--";
    document.body.style.setProperty(prefix + key, value);
  });
  document.getElementById("theme-preview")?.removeAttribute("data-theme");
}

function removeCustomTheme() {
  if (!storage.get("custom-theme")) return;
  Object.keys(storage.get("custom-theme")).forEach((key) => {
    const prefix = key == "color-scheme" ? "" : "--";
    document.body.style.removeProperty(prefix + key);
  });
}

function updateThemeCode() {
  if (document.getElementById("theme-code")) document.getElementById("theme-code").value = encodeThemeCode(customTheme);
}

function sortKeys(obj) {
  return Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
  }, {});
}

function encodeThemeCode(theme) {
  return "VC" + btoa(Object.values(sortKeys(theme)).join(","));
}

function decodeThemeCode(code) {
  try {
    const keys = Object.keys(defaultTheme);
    const values = atob(code.substring(2)).split(",");
    if (values.length < keys.length) {
      throw new Error();
    }
    return Object.fromEntries(keys.sort().map((key, i) => [key, values[i]]));
  } catch (e) {
    return false;
  }
}

export function renderThemesGrid(originalTheme = null) {
  const themesGrid = document.querySelector(".themes-grid");
  if (!themesGrid) return;
  themesGrid.innerHTML = "";
  themes.forEach((theme) => {
    const value = theme[0];
    const name = theme[1] || theme[0];
    const button = document.createElement("button");
    button.textContent = name;
    button.setAttribute("data-theme", value);
    if (value === originalTheme) button.classList.add('selected');
    button.addEventListener("click", () => {
      if (document.querySelector('.welcome-container').getAttribute('step') !== '11') return;
      selectedTheme = value;
      document.querySelector('.welcome-container').setAttribute("data-theme", value);
      originalTheme = value;
      storage.set("theme", value);
      syncTheme();
    });
    button.addEventListener("mouseover", () => {
      if (document.querySelector('.welcome-container').getAttribute('step') === '11') document.querySelector('.welcome-container').setAttribute("data-theme", value);
    });
    button.addEventListener("mouseout", () => {
      if (document.querySelector('.welcome-container').getAttribute('step') === '11') document.querySelector('.welcome-container').setAttribute("data-theme", originalTheme);
    });
    themesGrid.append(button);
  });
}

export function initializeThemeEditor() {
  document.querySelectorAll("#theme-editor :is(input, select):not(#theme-code)").forEach((input) => {
    input.addEventListener("input", () => {
      customTheme[input.name] = input.value;
      updateEditorPreview();
      updateThemeCode();
      updateEditorFields();
    });
  });
}

try {
  themes.forEach((theme) => {
    const value = theme[0];
    const name = theme[1] || theme[0];

    const button = document.createElement("button");
    button.textContent = name;
    button.addEventListener("click", () => {
      selectedTheme = value;
      document.getElementById("theme-preview").setAttribute("data-theme", value);
    });
    document.getElementById("theme-selector")?.append(button);
  });

  if (storage.get("theme") == "custom") {
    // Custom theme
    applyCustomTheme();
    selectedTheme = "";
  } else {
    // Built-in theme
    const theme = storage.get("theme") || "";
    document.body.setAttribute("data-theme", theme);
    document.getElementById("theme-preview")?.setAttribute("data-theme", theme);
    selectedTheme = theme;
  }
  enableTransitions();

  document.getElementById("theme-apply")?.addEventListener("click", async () => {
    const value = selectedTheme;
    disableTransitions();
    document.body.setAttribute("data-theme", value);
    removeCustomTheme();
    enableTransitions();
    storage.set("theme", value);
    // Update developer theme input
    if (document.getElementById("theme-debug")) document.getElementById("theme-debug").value = value;
    await auth.syncPush("theme");
    await auth.syncPush("custom-theme");
  });

  document.getElementById("theme-reset")?.addEventListener("click", resetTheme);

  // Editor

  updateEditorFields();
  updateEditorPreview();
  updateThemeCode();

  document.getElementById("editor-apply")?.addEventListener("click", async () => {
    storage.set("custom-theme", customTheme);
    storage.set("theme", "custom");
    applyCustomTheme();
    await auth.syncPush("custom-theme");
    await auth.syncPush("theme");
  });

  document.getElementById("editor-reset")?.addEventListener("click", () => {
    Object.assign(customTheme, defaultTheme);
    updateEditorFields();
    updateEditorPreview();
    updateThemeCode();
  });

  document.getElementById("theme-code")?.addEventListener("input", (e) => {
    if (e.target.value?.trim()) {
      const theme = decodeThemeCode(e.target.value);
      theme && updateEditorPreview(theme);
    }
  });

  document.getElementById("theme-code")?.addEventListener("blur", validateThemeCode);
  document.getElementById("theme-code")?.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
      validateThemeCode();
    }
  });

  // Load theme editor
  document.querySelector(`[data-modal-page="editor"]`)?.addEventListener("view", () => {
    Object.assign(customTheme, storage.get("custom-theme") || defaultTheme);
    updateEditorFields();
    updateEditorPreview();
    updateThemeCode();
  });

  if (storage.get("developer")) {
    // Add developer theme input
    document.querySelector(`[data-modal-page="theme"]`)?.append(
      new Element(
        "input",
        null,
        {
          input: (e) => {
            disableTransitions();
            document.getElementById("theme-preview").setAttribute("data-theme", e.target.value);
            document.body.setAttribute("data-theme", e.target.value);
            removeCustomTheme();
            enableTransitions();
            storage.set("theme", e.target.value);
          },
        },
        null,
        {
          id: "theme-debug",
        },
      ).element,
    );
    // Populate field
    if (document.getElementById("theme-debug")) document.getElementById("theme-debug").value = storage.get("theme") || "";
    // Add Copy CSS button
    document.querySelector(`[data-modal-page="editor"]`)?.append(
      new Element("button", "Copy CSS", {
        "click": copyThemeCSS,
      }).element,
    );
  }

  // Seasonal themes

  var seasonalTheme = "";
  var seasonalEmoji = "";

  if ((Date.now() < new Date(`${new Date().getFullYear()}-10-31`).getTime()) && (Date.now() > new Date(`${new Date().getFullYear()}-10-23`).getTime())) {
    seasonalTheme = "halloween";
    seasonalEmoji = "🎃";
  } else if ((Date.now() < new Date(`${new Date().getFullYear()}-12-25`).getTime()) && (Date.now() > new Date(`${new Date().getFullYear()}-12-01`).getTime())) {
    seasonalTheme = "festive";
    seasonalEmoji = "🎄";
  }

  if ((seasonalTheme != "") && (seasonalEmoji != "")) {
    var seasonalThemeButton = document.createElement("button");
    seasonalThemeButton.className = "icon";
    seasonalThemeButton.onclick = function () {
      disableTransitions();
      document.body.setAttribute("data-theme", seasonalTheme);
      enableTransitions();
      storage.set("theme", seasonalTheme);
    };
    seasonalThemeButton.innerHTML = seasonalEmoji;
    document.getElementById("controls-container")?.appendChild(seasonalThemeButton);
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ themes.js: ${error.message}`);
  };
  throw error;
};