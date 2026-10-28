import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import "./festive.css";
import snowflake from "./snowflake.png";

try {
  setInterval(() => {
    if (document.body.getAttribute("data-theme") !== "festive") return;
    const width = [18, 22, 26][Math.floor(Math.random() * 3)];
    const snowflakeImage = document.createElement("img");
    const duration = 10000 * (window.innerHeight / 1000);
    snowflakeImage.className = "snowflake";
    snowflakeImage.src = snowflake;
    snowflakeImage.style.width = `${width}px`;
    snowflakeImage.style.left = `${Math.random() * (window.innerWidth - width)}px`;
    document.body.append(snowflakeImage);
    snowflakeImage.animate([
      { transform: "translateY(0) rotate(0deg)" },
      { transform: `translateY(${window.innerHeight + 30}px) rotate(360deg)` },
    ], { duration, easing: "linear" });
    setTimeout(() => snowflakeImage.remove(), duration);
  }, 700);
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ festive.js: ${error.message}`);
  } else {
    ui.reportBugModal(null, String(error.stack));
  }
  throw error;
};
