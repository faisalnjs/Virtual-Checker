import { pushSupported, syncSuggestionPush, disableSuggestionPush } from "./suggestion-push.js";
import * as ui from "./ui.js";
import * as auth from "./auth.js";
import storage from "./storage.js";
import { notifySuggestionResponses } from "./service-worker.js";

export function suggestionCard(record) {
  const card = document.createElement("article");
  card.className = "enhanced-card";
  const heading = document.createElement("h3");
  heading.textContent = record.platform;
  const timestamp = document.createElement("small");
  const date = new Date(record.timestamp);
  timestamp.textContent = Number.isNaN(date.getTime()) ? record.timestamp : date.toLocaleString();
  const text = document.createElement("p");
  text.className = "suggestion-text";
  text.textContent = record.suggestion;
  card.append(heading, timestamp, text);
  if (record.contactInformation) {
    const contact = document.createElement("p");
    contact.className = "suggestion-text";
    contact.textContent = `Contact: ${record.contactInformation}`;
    card.append(contact);
  }
  const reply = document.createElement("section");
  reply.className = "suggestion-response";
  const label = document.createElement("strong");
  label.textContent = record.response ? "Response" : "Awaiting a response";
  reply.append(label);
  if (record.response) {
    const response = document.createElement("p");
    response.className = "suggestion-text";
    response.textContent = record.response;
    reply.append(response);
  }
  card.append(reply);
  return card;
}

let dialog = null;
let account = "";
let rows = [];
let pending = null;
let pendingAccount = "";
let initialized = false;
const memoryState = new Map();
const identity = () => JSON.stringify([storage.get("code"), storage.get("password")]);
const version = row => JSON.stringify([row.timestamp, row.response]);

function readState(seat) {
  try {
    const state = JSON.parse(localStorage.getItem(`suggestion-replies:${seat}`));
    return (state && (typeof state === 'object') && !Array.isArray(state)) ? state : (memoryState.get(seat) || {});
  }
  catch { return memoryState.get(seat) || {}; }
}
function writeState(seat, state) {
  memoryState.set(seat, state);
  try { localStorage.setItem(`suggestion-replies:${seat}`, JSON.stringify(state)); } catch { /* Private browsing. */ }
}
function updateBadge(count) {
  document.querySelectorAll('[data-my-suggestions]').forEach(button => {
    let badge = button.querySelector('.suggestion-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'suggestion-count';
      button.append(badge);
    }
    badge.textContent = count ? String(count) : '';
    badge.hidden = !count;
    button.setAttribute('aria-label', count ? `My Suggestions, ${count} unread replies` : 'My Suggestions');
  });
}
function renderHistory() {
  if (!dialog?.open) return;
  const list = dialog.querySelector('.col');
  const scroll = list.scrollTop;
  list.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = 'You have not submitted any suggestions yet.';
    list.append(empty);
  } else rows.forEach(row => list.append(suggestionCard(row)));
  list.scrollTop = scroll;
}
async function refresh() {
  const current = identity();
  if (account !== current) {
    account = current;
    rows = [];
    updateBadge(0);
    if (dialog?.open) dialog.querySelector('.enhanced-grid').replaceChildren();
  }
  if (!storage.get('code') || !storage.get('password')) {
    if (dialog?.open) dialog.querySelector('.suggestions-status').textContent = 'Sign in with your seat code and password to view suggestions.';
    return;
  }
  if (pending) {
    if (pendingAccount === current) return pending;
    await pending;
    return refresh();
  }
  pendingAccount = current;
  const seat = String(storage.get('code'));
  pending = (async () => {
    try {
      const result = await auth.suggestionRequest('/suggestions/list');
      if (identity() !== current) return;
      rows = result.suggestions;
      if (dialog?.open) {
        dialog.querySelector('.suggestions-status').textContent = '';
        renderHistory();
      }
      const state = readState(seat);
      const visible = dialog?.open && !document.hidden;
      const unread = rows.filter(row => row.response && (state[row.id]?.seen !== version(row)));
      if (visible) {
        for (const row of rows) if (row.response) state[row.id] = { seen: version(row), notified: version(row) };
        writeState(seat, state);
        updateBadge(0);
      } else {
        updateBadge(unread.length);
        const unnotified = unread.filter(row => state[row.id]?.notified !== version(row));
        if (unnotified.length && await notifySuggestionResponses(unnotified.length, seat).catch(() => false)) {
          for (const row of unnotified) state[row.id] = { ...state[row.id], notified: version(row) };
          writeState(seat, state);
        }
      }
    } catch (error) {
      if ((identity() === current) && dialog?.open) dialog.querySelector('.suggestions-status').textContent = error.message || 'Could not load suggestions. Try Refresh.';
    } finally { pending = null; }
  })();
  return pending;
}

export function openSuggestions() {
  if (dialog?.open) {
    refresh();
    return;
  }
  ui.view();
  dialog = ui.modal({
    title: 'My Suggestions',
    body: '<p class="suggestions-status" role="status">Loading suggestions...</p><div class="col"></div>',
    buttons: [
      { text: 'Make Suggestion', onclick: () => { dialog.close(); ui.suggestionsModal(); } },
      { text: 'Refresh', onclick: refresh },
    ],
  });
  dialog.classList.add('suggestions-dialog');
  if (pushSupported()) {
    const label = document.createElement('label');
    label.className = 'checkboxGroup suggestion-notifications';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.disabled = true;
    const indicator = document.createElement('span');
    indicator.className = 'checkbox';
    indicator.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = 'Enable reply notifications';
    const status = document.createElement('p');
    status.className = 'suggestions-status';
    status.setAttribute('role', 'status');
    label.append(checkbox, indicator, text);
    dialog.querySelector('.suggestions-status').after(label, status);

    async function updateNotificationCheckbox() {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        checkbox.checked = (Notification.permission === 'granted') && Boolean(subscription) && (localStorage.getItem('suggestion-push-enabled') === 'true') && (localStorage.getItem('suggestion-notifications-disabled') !== 'true');
      } catch (error) {
        checkbox.checked = false;
        status.textContent = error.message;
      } finally {
        checkbox.disabled = Notification.permission === 'denied';
        if (checkbox.disabled) status.textContent = 'Notifications blocked in browser settings.';
      }
    }

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
      }
    });
    updateNotificationCheckbox();
  }
  refresh();
}

export function initializeSuggestions() {
  if (initialized) return;
  initialized = true;
  document.querySelectorAll('[data-my-suggestions]').forEach(button => button.addEventListener('click', openSuggestions));
  const syncPush = () => { syncSuggestionPush().catch(() => { }); };
  syncPush();
  setInterval(syncPush, 30000);
  window.addEventListener('focus', syncPush);
  window.addEventListener('storage', syncPush);
  window.addEventListener('suggestions-updated', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('storage', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('hashchange', () => { if (location.hash === '#suggestions') openSuggestions(); });
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'open-suggestions') openSuggestions();
    if (event.data?.type === 'suggestions-updated') refresh();
  });
  setInterval(refresh, 30000);
  if (location.hash === '#suggestions') openSuggestions();
  else refresh();
}
