/* eslint-disable no-undef */
import "./reset.css";
import "./layout.css";
import "./design.css";
import "bootstrap-icons/font/bootstrap-icons.css";

import "/src/modules/mathlive.js";

import "/src/checker/admin.js";
import "/src/themes/themes.js";
import "/src/keybinds/keybinds.js";

import storage from "/src/modules/storage.js";

const version = import.meta.env.PACKAGE_VERSION;

updateVersionString();
function updateVersionString() {
  document.querySelectorAll("span.version").forEach((element) => {
    const DEVELOPER_MODE = storage.get("developer");
    element.innerHTML = version + (DEVELOPER_MODE ? " <code>dev</code>" : "");
  });
}
document.querySelectorAll("span.hostname").forEach((element) => {
  element.innerHTML = window.location.hostname;
});

let developerTimeout;
let developerClicks = 0;
document.getElementById("version-string").addEventListener("click", () => {
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
