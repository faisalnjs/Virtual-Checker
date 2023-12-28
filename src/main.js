import "./reset.css";
import "./layout.css";
import "./design.css";
import "remixicon/fonts/remixicon.css";

import "/src/clicker/clicker.js";
import "/src/symbols/symbols.js";
import "/src/themes/themes.js";
import "/src/keybinds/keybinds.js";

import "/src/festive/festive.js";

const VERSION = "3.2.7";
document.querySelectorAll("span.version").forEach(element => {
    element.innerHTML = VERSION;
});
document.querySelectorAll("span.hostname").forEach(element => {
    element.innerHTML = window.location.hostname;
});