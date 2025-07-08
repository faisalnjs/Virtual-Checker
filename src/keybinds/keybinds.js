import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as themes from "/src/themes/themes.js";
import { insertFromIndex } from "/src/symbols/symbols.js";
import { moveFromCurrent } from "/src/modules/island.js";

try {
  document.addEventListener("keydown", (e) => {
    const anyDialogOpen = Array.from(document.querySelectorAll("dialog")).some(
      (dialog) => dialog.open,
    );
    const island = document.querySelector('.island');
    const islandOpen = island ? island.classList.contains('visible') : false;
    const isTyping = document.activeElement.matches("input, textarea");
    if (e.ctrlKey) {
      if (e.key == "Enter" && !anyDialogOpen) {
        document.getElementById("submit-button")?.click();
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
      if (e.key == "s" && !anyDialogOpen && document.querySelector('[data-speed]')) {
        e.preventDefault();
        document.querySelector('[data-speed]').click();
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
      if (e.key == "{" && islandOpen && !isTyping) {
        moveFromCurrent(-1);
      }
      if (e.key == "}" && islandOpen && !isTyping) {
        moveFromCurrent(1);
      }
    } else if (e.key == "Enter" && anyDialogOpen) {
      document.querySelector('dialog[open] .submit-button')?.click();
    } else if (e.key == "[" && island && islandOpen && !isTyping) {
      document.querySelector('.island').classList.remove('visible');
    } else if (e.key == "]" && island && !islandOpen && !isTyping) {
      document.querySelector('.island').classList.add('visible');
    } else if (e.key == "Backspace" && !isTyping && !anyDialogOpen) {
      const filterSegmentInput = document.getElementById("filter-segment-input");
      if (filterSegmentInput) {
        filterSegmentInput.value = "";
        filterSegmentInput.dispatchEvent(new Event("change"));
      }
      const sortQuestionInput = document.getElementById("sort-question-input");
      if (sortQuestionInput) {
        sortQuestionInput.value = "";
        sortQuestionInput.dispatchEvent(new Event("input"));
      }
      const sortSeatInput = document.getElementById("sort-seat-input");
      if (sortSeatInput) {
        sortSeatInput.value = "";
        sortSeatInput.dispatchEvent(new Event("input"));
      }
      const filterLogsByUsernameInput = document.getElementById("filter-logs-by-username-input");
      if (filterLogsByUsernameInput) {
        filterLogsByUsernameInput.value = "";
        filterLogsByUsernameInput.dispatchEvent(new Event("input"));
      }
      const filterLogsByActionInput = document.getElementById("filter-logs-by-action-input");
      if (filterLogsByActionInput) {
        filterLogsByActionInput.value = "";
        filterLogsByActionInput.dispatchEvent(new Event("change"));
      }
    }
  });
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ keybinds.js: ${error.message}`);
  };
  throw error;
};