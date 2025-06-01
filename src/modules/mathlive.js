import "/node_modules/mathlive/dist/mathlive-fonts.css";
import { MathfieldElement } from "mathlive";

try {
    MathfieldElement.soundsDirectory = null;
} catch (error) {
    if (storage.get("developer")) {
      alert(`Error @ mathlive.js: ${error.message}`);
    };
    throw error;
};