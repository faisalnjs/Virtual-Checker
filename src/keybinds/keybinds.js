import * as ui from "/src/modules/ui.js";

import * as themes from "/src/themes/themes.js";

import { insertFromIndex } from "/src/symbols/symbols.js";

try {
  document.addEventListener("keydown", (e) => {
    const anyDialogOpen = Array.from(document.querySelectorAll("dialog")).some(
      (dialog) => dialog.open,
    );
    const isTyping = document.activeElement.matches("input, textarea");
    if (e.ctrlKey) {
      if (e.key == "Enter" && !anyDialogOpen) {
        document.getElementById("submit-button").click();
      }
      if (e.key == "," && !anyDialogOpen) {
        ui.view("settings");
      }
      if (e.key == "." && !anyDialogOpen) {
        ui.view("history");
      }
      if (e.key == "/" && !anyDialogOpen) {
        ui.view("settings/keybinds");
      }
    } else if (e.altKey) {
      if (/[1-9]/.test(e.key)) {
        e.preventDefault();
        insertFromIndex(parseInt(e.key) - 1);
      }
    } else if (e.shiftKey) {
      if (e.key == "R" && !anyDialogOpen && !isTyping) {
        themes.resetTheme();
      }
    }
  });
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ keybinds.js: ${error.message}`);
  };
  throw error;
};