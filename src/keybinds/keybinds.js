import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as themes from "/src/themes/themes.js";
import { insertFromIndex } from "/src/symbols/symbols.js";
import { moveFromCurrent, renderExtras } from "/src/modules/island.js";

try {
  document.addEventListener("keydown", async (e) => {
    const anyDialogOpen = Array.from(document.querySelectorAll("dialog")).some(
      (dialog) => dialog.open,
    );
    const island = document.querySelector('.island');
    const islandOpen = island ? island.classList.contains('visible') : false;
    const isTyping = document.activeElement.matches("input, textarea, [contenteditable]");
    const isWelcomeActive = document.querySelector('.welcome-container');
    const zoomOverlay = document.querySelector('.medium-zoom-overlay');
    if (e.ctrlKey) {
      if (e.key == "Enter" && !anyDialogOpen) document.getElementById("submit-button")?.click();
      if (e.key == "," && !anyDialogOpen) ui.view("settings");
      if (e.key == "." && !anyDialogOpen) ui.view("history");
      if (e.key == "/" && !anyDialogOpen) ui.view("settings/keybinds");
      if (e.key == "s" && !anyDialogOpen && document.querySelector('[data-speed]')) {
        e.preventDefault();
        document.querySelector('[data-speed]').click();
      }
      if (e.key == "i" && !anyDialogOpen) {
        e.preventDefault();
        ui.launchWelcome();
      }
      if (e.key == "ArrowLeft" && document.querySelector('[data-prev-question]')) {
        e.preventDefault();
        document.querySelector('[data-prev-question]').click();
      }
      if (e.key == "ArrowRight" && document.querySelector('[data-next-question]')) {
        e.preventDefault();
        document.querySelector('[data-next-question]').click();
      }
    } else if (e.altKey) {
      if (/[1-9]/.test(e.key)) {
        e.preventDefault();
        insertFromIndex(parseInt(e.key) - 1);
      }
    } else if (e.shiftKey) {
      if (e.key == "R" && !anyDialogOpen && !isTyping) {
        themes.resetTheme();
        await storage.idbReady;
        storage.idbDelete("cache").catch((e) => console.error('IDB delete failed', e));
        storage.delete("lastBulkLoad");
        storage.idbDelete("adminCache").catch((e) => console.error('IDB delete failed', e));
        storage.delete("lastAdminBulkLoad");
        location.reload();
      }
      if (e.key == "{" && islandOpen && !isTyping) moveFromCurrent(-1);
      if (e.key == "}" && islandOpen && !isTyping) moveFromCurrent(1);
    } else if (e.key == "Enter" && anyDialogOpen) {
      document.querySelector('dialog[open] .submit-button')?.click();
    } else if (e.key == "[" && island && islandOpen && !isTyping) {
      island.classList.remove('visible');
    } else if (e.key == "]" && island && !islandOpen && !isTyping) {
      island.classList.add('visible');
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
      const filterReportResponses = document.getElementById("filter-report-responses");
      if (filterReportResponses) filterReportResponses.children[0].click();
    } else if (e.key == "ArrowRight" && isWelcomeActive) {
      ui.clearWelcomeTimeouts();
      ui.toWelcomeSlide(Number(isWelcomeActive.getAttribute('step')) + 1);
    } else if (e.key == "ArrowLeft" && isWelcomeActive) {
      ui.clearWelcomeTimeouts();
      ui.toWelcomeSlide(Number(isWelcomeActive.getAttribute('step')) - 1);
    } else if (e.key == "Escape" && isWelcomeActive) {
      ui.removeWelcome();
    } else if (e.key == "=" && island && islandOpen && !isTyping) {
      island.querySelectorAll('.extra').forEach(el => {
        el.classList.toggle('hidden');
      });
      renderExtras();
    } else if (e.key == "ArrowRight" && zoomOverlay) {
      var next = document.querySelector('.medium-zoom-image--hidden').nextElementSibling;
      zoomOverlay.click();
      if (next) setTimeout(() => next.click(), 500);
    } else if (e.key == "ArrowLeft" && zoomOverlay) {
      var next = document.querySelector('.medium-zoom-image--hidden').previousElementSibling;
      zoomOverlay.click();
      if (next) setTimeout(() => next.click(), 500);
    } else if (e.key == "y" && island && islandOpen && !isTyping) {
      document.querySelector('.island-extends #mark-correct-button')?.click();
    } else if (e.key == "n" && island && islandOpen && !isTyping) {
      document.querySelector('.island-extends #mark-incorrect-button')?.click();
      setTimeout(() => {
        if (document.querySelector(".dialog-input.selectAll")) document.querySelector(".dialog-input.selectAll").value = '';
      }, 100);
    } else if (e.key == "q" && island && islandOpen && !isTyping) {
      var responseData = document.querySelector('.island-extends #response-question-input');
      if (!responseData || !responseData.getAttribute('data-segment') || !responseData.getAttribute('data-question-id')) return;
      const url = `/${window.location.pathname.startsWith('/ta/') ? 'ta' : 'admin'}/questions?segment=${responseData.getAttribute('data-segment')}&question=${responseData.getAttribute('data-question-id')}`;
      const width = window.outerWidth;
      const height = window.outerHeight;
      const left = window.screenLeft;
      const top = window.screenTop;
      const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
      window.open(url, '_blank', windowFeatures);
    }
  });
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ keybinds.js: ${error.message}`);
  };
  throw error;
};