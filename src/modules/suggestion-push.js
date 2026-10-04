import * as auth from "./auth.js";
import storage from "./storage.js";

let registeredAccount = '';
let pending = null;
const account = () => JSON.stringify([storage.get('code'), storage.get('password')]);

export function pushSupported() {
  return window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function syncSuggestionPush(enable = false) {
  if (!pushSupported()) return false;
  if (!enable && localStorage.getItem('suggestion-notifications-disabled') === 'true') return false;
  if (!storage.get('code') || !storage.get('password')) return false;
  const current = account();
  if (!enable && (registeredAccount === current) && (Notification.permission === 'granted')) return true;
  if (pending) {
    await pending;
    return syncSuggestionPush(enable);
  }
  if (enable && Notification.permission !== 'granted') {
    if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications were not enabled. Check browser permissions.');
  }
  if (Notification.permission !== 'granted') return false;
  pending = (async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) {
      if (enable) throw new Error('The service worker is still starting. Try again in a moment.');
      return false;
    }
    let subscription = await registration.pushManager.getSubscription();
    const optedIn = localStorage.getItem('suggestion-push-enabled') === 'true';
    if (!subscription && !enable && !optedIn) return false;
    const config = await auth.suggestionRequest('/suggestions/push/config');
    if (!config.publicKey) {
      if (enable) throw new Error('Push notifications have not been configured on the server.');
      return false;
    }
    const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    if (subscription) {
      const previous = new Uint8Array(subscription.options.applicationServerKey || []);
      if ((previous.length !== key.length) || previous.some((value, index) => value !== key[index])) {
        await subscription.unsubscribe();
        subscription = null;
        if (!enable && !optedIn) return false;
      }
    }
    if (account() !== current) return false;
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    if (account() !== current) { await subscription.unsubscribe(); return false; }
    await auth.suggestionRequest('/suggestions/push/subscribe', { subscription: subscription.toJSON() });
    if (account() !== current) { await subscription.unsubscribe(); return false; }
    localStorage.setItem('suggestion-push-enabled', 'true');
    localStorage.removeItem('suggestion-notifications-disabled');
    registeredAccount = current;
    return true;
  })();
  try { return await pending; } finally { pending = null; }
}

export async function disableSuggestionPush() {
  registeredAccount = '';
  localStorage.removeItem('suggestion-push-enabled');
  localStorage.setItem('suggestion-notifications-disabled', 'true');
  if (pending) await pending.catch(() => {});
  registeredAccount = '';
  localStorage.removeItem('suggestion-push-enabled');
  localStorage.setItem('suggestion-notifications-disabled', 'true');
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  if (storage.get('code') && storage.get('password')) await auth.suggestionRequest('/suggestions/push/unsubscribe', { endpoint: subscription.endpoint });
}
