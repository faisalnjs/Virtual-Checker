import { syncSuggestionPush, initializeNotificationPermission, addNotificationControl } from "./suggestion-push.js";
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
  } catch {
    return memoryState.get(seat) || {};
  }
}
function writeState(seat, state) {
  memoryState.set(seat, state);
  try { localStorage.setItem(`suggestion-replies:${seat}`, JSON.stringify(state)); } catch { /* Private browsing. */ }
}
function updateBadge(count) {
  document.querySelectorAll('[data-my-suggestions]').forEach(button => {
    if (count) {
      button.classList.add('unread');
    } else {
      button.classList.remove('unread');
    }
    button.setAttribute('aria-label', count ? `My Suggestions, ${count} unread replies` : 'My Suggestions');
    button.setAttribute('tooltip', count ? `My Suggestions (${count} unread)` : 'My Suggestions');
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
    if (dialog?.open) dialog.querySelector('.col').replaceChildren();
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
  const notifications = addNotificationControl(dialog);
  if (notifications) dialog.querySelector('.suggestions-status').after(notifications);
  refresh();
}

export function initializeSuggestions() {
  if (initialized) return;
  initialized = true;
  initializeNotificationPermission();
  const history = document.querySelector('[data-modal-page="history"]');
  const notifications = addNotificationControl(history);
  if (notifications) {
    const menu = history.querySelector('[data-modal-menu]');
    if (menu) menu.after(notifications);
    else history.prepend(notifications);
  }
  document.querySelectorAll('[data-my-suggestions]').forEach(button => button.addEventListener('click', openSuggestions));
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
}
