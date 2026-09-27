const DEFAULT_THEME_COLOR = "#fafafa";
const NOTIFICATION_COUNT_KEY = "vc-notification-unread-count";

export function registerServiceWorker(version) {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  const register = () => {
    navigator.serviceWorker.register(`/service-worker.js?v=${encodeURIComponent(version)}${import.meta.env.DEV ? "&dev=1" : ""}`, { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed", error);
    });
    syncPwaTheme().catch((error) => {
      console.error("PWA theme sync failed", error);
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

export async function syncPwaTheme() {
  if (typeof document === "undefined") return;

  const backgroundColor = getThemeBackgroundColor();
  setThemeColorMeta(backgroundColor);
}

export async function notifyUnreadNotifications(previousCount, currentCount) {
  const oldCount = Number.isFinite(previousCount) ? previousCount : Number(localStorage.getItem(NOTIFICATION_COUNT_KEY) || 0);
  const nextCount = Number.isFinite(currentCount) ? currentCount : 0;

  localStorage.setItem(NOTIFICATION_COUNT_KEY, String(nextCount));

  if (nextCount <= oldCount || nextCount <= 0 || !("Notification" in window)) return;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return;

  await registration.showNotification("Virtual Checker", {
    body: `You have ${nextCount} unread notification${nextCount === 1 ? "" : "s"}.`,
    icon: "/banner-meta.png",
    badge: "/favicon.ico",
    tag: "virtual-checker-unread",
    renotify: true,
    data: {
      url: "/",
    },
  });
}

function getThemeBackgroundColor() {
  if (typeof window === "undefined") return DEFAULT_THEME_COLOR;
  const bodyStyles = window.getComputedStyle(document.body);
  const rootStyles = window.getComputedStyle(document.documentElement);
  const color = bodyStyles.getPropertyValue("--background-color") || rootStyles.getPropertyValue("--background-color");
  return (color || DEFAULT_THEME_COLOR).trim() || DEFAULT_THEME_COLOR;
}

function setThemeColorMeta(color) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready
    .then((registration) => registration)
    .catch(async () => navigator.serviceWorker.getRegistration());
}