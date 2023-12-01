import "./festive.css";

import snowflake from "./snowflake.png";

import { disableTransitions, enableTransitions } from "/src/themes/themes.js";
import storage from "/src/modules/storage.js";

document.getElementById("festive-theme").addEventListener("click", () => {
    disableTransitions();
    document.body.setAttribute("data-theme", "festive-2023");
    enableTransitions();
    storage.set("theme", "festive-2023");
    createSnowflakes();
});

function createSnowflakes() {
    for (let i = 0; i < 50; i++) {
        const element = document.createElement("img");
        element.src = snowflake;
        element.classList.add("snowflake");

        const width = [30, 40, 50][Math.floor(Math.random() * 3)];
        element.style.width = width + "px";

        const bodyWidth = document.body.offsetWidth;
        const position = Math.random() * (bodyWidth * 0.9 - width) + (bodyWidth * 0.05);
        element.style.left = position + "px";

        const delay = Math.floor(Math.random() * 20) * 100;

        setTimeout(() => {
            document.body.append(element);

            const rotation = [0, 30, 60][Math.floor(Math.random() * 3)];
            const keyframes = [
                {
                    opacity: 1,
                    transform: `translate(0, 0) rotateY(${rotation}deg) rotateZ(0)`,
                },
                {
                    opacity: 0,
                    transform: `translate(0, 80vh) rotateY(${rotation}deg) rotateZ(360deg)`,
                },
            ];

            const duration = 2000;
            element.animate(keyframes, {
                duration: duration,
                fill: "forwards",
            });
            setTimeout(() => {
                element.remove();
            }, duration);
        }, delay);
    }
}