const appDisplayModes = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"]
  .map((mode) => window.matchMedia(`(display-mode: ${mode})`));
const isAppWindow = () => navigator.standalone === true || appDisplayModes.some((mode) => mode.matches);
const button = document.querySelector("[data-install-pwa]");
let installPrompt = null;
let installedThisSession = false;

function updateDisplayMode() {
  const runningAsApp = isAppWindow();
  window.isPWA = runningAsApp;
  if (button) button.hidden = runningAsApp;
}

updateDisplayMode();
appDisplayModes.forEach((mode) => mode.addEventListener("change", updateDisplayMode));
window.addEventListener("pageshow", updateDisplayMode);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installedThisSession = false;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installedThisSession = true;
  updateDisplayMode();
});

async function showInstructions() {
  const { alert } = await import("./ui.js");
  const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instructions = installedThisSession
    ? "The app is installed. Open it from your home screen, app launcher, or your browser's Open in app option."
    : appleMobile
      ? "To install, open this page in Safari, tap Share, then Add to Home Screen. If already installed, open the app from your home screen."
      : "Use your browser's address bar or menu to Install app or Add to Home Screen. If already installed, choose Open in app or open it from your device's app launcher. If these options are missing, try a browser that supports app installation.";
  alert("Install App", instructions);
}

button?.addEventListener("click", async () => {
  if (isAppWindow()) return;
  if (!installPrompt) {
    await showInstructions();
    return;
  }

  const prompt = installPrompt;
  installPrompt = null;
  button.disabled = true;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch (error) {
    console.error("PWA installation prompt failed", error);
    await showInstructions();
  } finally {
    button.disabled = false;
    updateDisplayMode();
  }
});
