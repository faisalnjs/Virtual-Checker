import "/node_modules/mathlive/dist/mathlive-fonts.css";
import { MathfieldElement } from "mathlive";

import * as ui from "/src/modules/ui.js";

MathfieldElement.soundsDirectory = null;

ui.addTooltip(document.getElementById("answer-mode-selector"), "BETA: Features may not work as expected");