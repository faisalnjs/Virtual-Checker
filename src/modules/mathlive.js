import "/node_modules/mathlive/dist/mathlive-fonts.css";
import "/node_modules/mathlive/dist/sounds/plonk.wav";
import { MathfieldElement, convertLatexToAsciiMath } from "mathlive";

import * as ui from "/src/modules/ui.js";

MathfieldElement.soundsDirectory = null;

const keyboard = document.createElement("div");
keyboard.style.margin = "0.5rem -1rem -1rem -1rem";
document.body.append(keyboard);
window.mathVirtualKeyboard.container = keyboard;

window.mathVirtualKeyboard.addEventListener("geometrychange", () => {
    const height = window.mathVirtualKeyboard.boundingRect.height;
    if (height == 0) {
        ui.animate(keyboard, null, {
            height: 0,
        }, 100);
    } else {
        ui.animate(keyboard, {
            height: 0,
        }, {
            height: height + "px",
        }, 250);
    }
});

const mf = document.getElementById("math-input");

mf.addEventListener("input", e => {
    const el = e.target;
    console.log(convertLatexToAsciiMath(el.value));
});

ui.addTooltip(document.getElementById("answer-mode-selector"), "BETA: Features may not work as expected");