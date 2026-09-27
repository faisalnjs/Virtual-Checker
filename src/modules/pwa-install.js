const { alert } = await import("./ui.js");

const appDisplayModes = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"].map((mode) => window.matchMedia(`(display-mode: ${mode})`));
const isAppWindow = () => (navigator.standalone === true) || appDisplayModes.some((mode) => mode.matches);
const button = document.querySelector("[data-install-pwa]");
let installPrompt = null;
let installedThisSession = false;

window.addEventListener("beforeinstallprompt", (event) => {
  button?.removeAttribute('hidden');
  event.preventDefault();
  installPrompt = event;
  installedThisSession = false;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installedThisSession = true;
});

button?.addEventListener("click", async () => {
  if (isAppWindow()) return;
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  button.disabled = true;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch (error) {
    console.error("PWA installation prompt failed", error);
    const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || ((navigator.platform === "MacIntel") && (navigator.maxTouchPoints > 1));
    if (installedThisSession && !appleMobile) button?.setAttribute('hidden', 'true');
    if (appleMobile) alert("Install App", "To install, open this page in Safari, tap Share, then Add to Home Screen. If already installed, open the app from your home screen.");
  } finally {
    button.disabled = false;
  }
});
