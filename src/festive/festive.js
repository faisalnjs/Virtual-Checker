import "./festive.css";

import { disableTransitions, enableTransitions } from "/src/themes/themes.js";
import storage from "/src/modules/storage.js";

document.getElementById("festive-theme").addEventListener("click", () => {
    disableTransitions();
    document.body.setAttribute("data-theme", "festive-2023");
    enableTransitions();
    storage.set("theme", "festive-2023");
});