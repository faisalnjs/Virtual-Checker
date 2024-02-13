import "./themes.css";
import themes from "./themes.json";

import storage from "/src/modules/storage.js";

document.body.setAttribute("data-theme", storage.get("theme") || "");

enableTransitions();

themes.forEach(theme => {
    const value = theme[0];
    const name = theme[1] || theme[0];

    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    document.querySelector("#theme-selector").append(option);
});

document.getElementById("theme-preview").setAttribute("data-theme", storage.get("theme") || "");
document.getElementById("theme-selector").value = storage.get("theme") || "";

document.getElementById("theme-selector").addEventListener("input", e => {
    const value = e.target.value;
    document.getElementById("theme-preview").setAttribute("data-theme", value);
})

document.getElementById("theme-apply").addEventListener("click", () => {
    const value = document.getElementById("theme-selector").value;
    disableTransitions();
    document.body.setAttribute("data-theme", value);
    enableTransitions();
    storage.set("theme", value);
})

document.getElementById("theme-reset").addEventListener("click", () => {
    disableTransitions();
    document.body.removeAttribute("data-theme");
    document.getElementById("theme-preview").removeAttribute("data-theme");
    enableTransitions();
    storage.delete("theme");
});

export function disableTransitions() {
    document.body.classList.remove("enable-transitions");
}

export function enableTransitions() {
    document.body.offsetHeight;
    document.body.classList.add("enable-transitions");
}