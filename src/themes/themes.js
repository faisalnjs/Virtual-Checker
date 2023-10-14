import "./themes.css";
import themes from "./themes.json";

import storage from "/src/modules/storage.js";

document.body.setAttribute("data-theme", storage.get("theme") || "");

enableTransitions();

themes.forEach(theme => {
    const value = theme[0];
    const name = theme[1] || theme[0];

    const button = document.createElement("button");
    button.setAttribute("data-theme", value);
    button.textContent = name;
    button.addEventListener("click", e => {
        disableTransitions();
        document.body.setAttribute("data-theme", value);
        enableTransitions();
        storage.set("theme", value);
    });
    document.querySelector("#theme-modal>div").append(button);
});

function enableTransitions() {
    setTimeout(() => {
        document.body.classList.add("enable-transitions");
    }, 100);
}

function disableTransitions() {
    document.body.classList.remove("enable-transitions");
}