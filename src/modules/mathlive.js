import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import "/node_modules/mathlive/dist/mathlive-fonts.css";
import { MathfieldElement } from "mathlive";

try {
  MathfieldElement.soundsDirectory = null;
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ mathlive.js: ${error.message}`);
  } else {
    ui.reportBugModal(null, String(error.stack));
  }
  throw error;
};