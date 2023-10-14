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
    button.addEventListener("click", () => {
        disableTransitions();
        document.body.setAttribute("data-theme", value);
        enableTransitions();
        storage.set("theme", value);
    });
    document.querySelector("#theme-grid").append(button);
});

document.getElementById("reset-theme-button").addEventListener("click", () => {
    disableTransitions();
    document.body.removeAttribute("data-theme");
    enableTransitions();
    storage.delete("theme");
});

function disableTransitions() {
    document.body.classList.remove("enable-transitions");
}

function enableTransitions() {
    document.body.offsetHeight;
    document.body.classList.add("enable-transitions");
}

if (Date.now() < new Date("2023-10-23").getTime()) {
    document.getElementById("halloween-theme").style.display = "none";
}

document.getElementById("halloween-theme").addEventListener("click", () => {
    const theme = "halloween-2023";
    disableTransitions();
    document.body.setAttribute("data-theme", theme);
    enableTransitions();
    storage.set("theme", theme);
});