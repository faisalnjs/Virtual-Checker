import * as auth from "./auth.js";
import storage from "./storage.js";

let registeredAccount = '';
let pending = null;
const account = () => JSON.stringify([storage.get('code'), storage.get('password')]);

export function pushSupported() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return window.isSecureContext && ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window) && (!ios || standalone);
}

export async function syncSuggestionPush(enable = false) {
  if (!pushSupported()) return false;
  if (!enable && localStorage.getItem('suggestion-notifications-disabled') === 'true') return false;
  if (!storage.get('code') || !storage.get('password')) return false;
  if (enable) localStorage.removeItem('suggestion-notifications-disabled');
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
    const optedIn = localStorage.getItem('suggestion-notifications-disabled') !== 'true';
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
    await auth.suggestionRequest('/suggestions/push/subscribe', { subscription: subscription.toJSON(), topics: ['suggestions', 'feedback', 'segment_due'] });
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

export function initializeNotificationPermission() {
  return pushSupported();
}

export function addNotificationControl(container) {
  if (!container || !pushSupported()) return null;
  const existing = container.querySelector('[data-notification-control]');
  if (existing) return existing;
  const control = document.createElement('div');
  control.setAttribute('data-notification-control', '');
  const label = document.createElement('label');
  label.className = 'checkboxGroup suggestion-notifications';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.disabled = true;
  const indicator = document.createElement('span');
  indicator.className = 'checkbox';
  indicator.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = 'Enable notifications';
  const status = document.createElement('p');
  status.className = 'suggestions-status';
  status.setAttribute('role', 'status');
  label.append(checkbox, indicator, text);
  control.append(label, status);
  container.append(control);

  async function updateNotificationCheckbox() {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      const optedIn = localStorage.getItem('suggestion-notifications-disabled') !== 'true';
      checkbox.checked = optedIn && Boolean(subscription);
      if (optedIn && Notification.permission === 'default') status.textContent = 'Tap to allow notifications.';
      if (optedIn && (Notification.permission === 'granted') && !subscription) status.textContent = 'Tap to connect this device.';
    } catch (error) {
      checkbox.checked = localStorage.getItem('suggestion-notifications-disabled') !== 'true';
      status.textContent = error.message;
    } finally {
      checkbox.disabled = false;
      if (Notification.permission === 'denied') status.textContent = 'Notifications blocked in browser settings.';
    }
  }

  control.addEventListener('notification-permission-updated', () => {
    status.textContent = '';
    updateNotificationCheckbox();
  });
  checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;
    status.textContent = '';
    try {
      if (checkbox.checked) {
        if (!await syncSuggestionPush(true)) throw new Error('Sign in to enable reply notifications.');
      } else {
        await disableSuggestionPush();
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      await updateNotificationCheckbox();
      document.querySelectorAll('[data-notification-control]').forEach(other => {
        if (other !== control) other.dispatchEvent(new Event('notification-permission-updated'));
      });
    }
  });
  updateNotificationCheckbox();
  container.addEventListener('view', () => {
    status.textContent = '';
    updateNotificationCheckbox();
  });
  return control;
}
