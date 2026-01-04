/* eslint-disable no-undef */
import "./reset.css";
import "./layout.css";
import "./design.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "quill/dist/quill.core.css";
import "quill/dist/quill.snow.css";
import "katex/dist/katex.min.css";

import "/src/modules/mathlive.js";

import "/src/checker/checker.js";
import "/src/symbols/symbols.js";
import "/src/themes/themes.js";
import "/src/keybinds/keybinds.js";

import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import Element from "/src/modules/element.js";

try {
  const version = import.meta.env.PACKAGE_VERSION;

  updateVersionString();
  function updateVersionString(beta = false) {
    const DEVELOPER_MODE = storage.get("developer");
    document.querySelectorAll(".version").forEach((element) => {
      element.innerHTML = "<p>v" + version + "</p>" + (DEVELOPER_MODE ? " <code>dev</code>" : "");
    });
    if (DEVELOPER_MODE) {
      if (document.querySelector('.topbar')) {
        document.querySelector('.topbar').innerHTML = `<span><i class="bi bi-cone-striped"></i>&nbsp;${beta ? "Beta Version" : "Developer Mode"} - v${version}</span>`;
      } else {
        var topbar = document.createElement("div");
        topbar.className = "topbar";
        topbar.innerHTML = `<span><i class="bi bi-cone-striped"></i>&nbsp;${beta ? "Beta Version" : "Developer Mode"} - v${version}</span>`;
        document.body.prepend(topbar);
      }
    }
  }

  document.querySelectorAll(".hostname").forEach((element) => {
    element.innerHTML = window.location.hostname;
  });

  let developerTimeout;
  let developerClicks = 0;
  document.getElementById("version-string")?.addEventListener("click", () => {
    developerClicks++;
    clearTimeout(developerTimeout);
    developerTimeout = setTimeout(() => {
      developerClicks = 0;
    }, 1000);
    if (developerClicks == 10) {
      storage.set("developer", true);
      updateVersionString();
    }
  });

  // Reset modals
  const resets = {
    "all": () => {
      ui.prompt("Reset all settings?", "This action cannot be reversed!", [
        {
          text: "Cancel",
          close: true,
        },
        {
          text: "Reset",
          close: true,
          onclick: () => {
            storage.obliterate();
            window.location.reload();
          },
        },
      ]);
    },
  };

  // Show reset modal
  document.querySelectorAll("[data-reset]").forEach((button) => {
    button.addEventListener("click", async (e) => {
      if (e.target.getAttribute("data-reset") === 'cache') {
        var timestamp = new Date().getTime();
        storage.set("cacheBust", true);
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          link.setAttribute("href", `${link.getAttribute("href")}?_=${timestamp}`);
        });
        document.querySelectorAll("script[src]").forEach(script => {
          script.setAttribute("src", `${script.getAttribute("src")}?_=${timestamp}`);
        });
        await storage.idbReady;
        storage.idbDelete("cache").catch((e) => console.error('IDB delete failed', e));
        storage.delete("lastBulkLoad");
        window.location.reload();
      } else {
        resets[e.target.getAttribute("data-reset")]();
      };
    });
  });

  if (storage.get("cacheBust")) {
    var timestamp = new Date().getTime();
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      link.setAttribute("href", `${link.getAttribute("href")}?_=${timestamp}`);
    });
    document.querySelectorAll("script[src]").forEach(script => {
      script.setAttribute("src", `${script.getAttribute("src")}?_=${timestamp}`);
    });
  }

  // Disable developer mode button
  if (storage.get("developer")) {
    document.querySelector(`[data-modal-page="reset"]`).append(
      new Element("button", "Disable Developer Mode", {
        "click": () => {
          storage.delete("developer");
          window.location.reload();
        },
      }).element,
    );
  }

  if (window.location.hostname.includes('beta')) {
    storage.set("developer", true);
    updateVersionString(true);
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ main.js: ${error.message}`);
  } else {
    ui.reportBugModal(null, String(error.stack));
  }
  throw error;
};