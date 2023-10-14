import "./reset.css";
import "./layout.css";
import "./design.css";
import "remixicon/fonts/remixicon.css";

import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";

import "/src/clicker/clicker.js";
import "/src/symbols/symbols.js";
import "/src/themes/themes.js";
import "/src/keybinds/keybinds.js";

const VERSION = "3.2.0 BETA";
document.querySelectorAll("span.version").forEach(element => {
    element.innerHTML = VERSION;
});