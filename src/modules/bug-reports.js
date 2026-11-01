import * as ui from "./ui.js";
import * as auth from "./auth.js";
import storage from "./storage.js";
import { notifyBugReportReplies } from "./service-worker.js";

let dialog = null;
let account = "";
let reports = [];
let pending = null;
let pendingAccount = "";
let initialized = false;
const memoryState = new Map();
const identity = () => JSON.stringify([storage.get("code"), storage.get("password")]);
const version = report => JSON.stringify((report.messages || []).filter(message => message.author === 'admin').map(message => [message.id, message.timestamp]));

function readState(seat) {
  try {
    const state = JSON.parse(localStorage.getItem(`bug-report-replies:${seat}`));
    return (state && (typeof state === 'object') && !Array.isArray(state)) ? state : (memoryState.get(seat) || {});
  } catch {
    return memoryState.get(seat) || {};
  }
}

function writeState(seat, state) {
  memoryState.set(seat, state);
  try { localStorage.setItem(`bug-report-replies:${seat}`, JSON.stringify(state)); } catch { }
}

function updateBadge(count) {
  document.querySelectorAll('[data-my-bug-reports]').forEach(button => {
    button.classList.toggle('unread', Boolean(count));
    button.setAttribute('aria-label', count ? `My Bug Reports, ${count} unread replies` : 'My Bug Reports');
    button.setAttribute('tooltip', count ? `My Bug Reports (${count} unread)` : 'My Bug Reports');
  });
}

function reportCard(report) {
  const card = document.createElement('article');
  card.className = 'enhanced-card';
  const heading = document.createElement('h3');
  heading.textContent = report.platform;
  const timestamp = document.createElement('small');
  const date = new Date(report.timestamp);
  timestamp.textContent = Number.isNaN(date.getTime()) ? report.timestamp : date.toLocaleString();
  const thread = document.createElement('section');
  thread.className = 'suggestion-response';
  for (const message of report.messages || []) {
    const entry = document.createElement('div');
    entry.className = `suggestion-message ${message.author}`;
    const author = document.createElement('strong');
    author.textContent = message.author === 'admin' ? 'Admin' : 'You';
    const body = document.createElement('p');
    body.className = 'suggestion-text';
    body.textContent = message.message;
    entry.append(author, body);
    thread.append(entry);
  }
  const form = document.createElement('form');
  const input = document.createElement('textarea');
  input.required = true;
  input.maxLength = 10000;
  input.placeholder = 'Reply...';
  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = 'Reply';
  const status = document.createElement('p');
  status.className = 'suggestion-save-status';
  status.setAttribute('role', 'status');
  form.append(input, send, status);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || send.disabled) return;
    send.disabled = true;
    input.disabled = true;
    status.textContent = 'Sending...';
    try {
      const result = await auth.suggestionRequest(`/bug_reports/${report.id}/messages`, { message });
      reports = reports.map(item => item.id === report.id ? result.report : item);
      renderHistory();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      send.disabled = false;
      input.disabled = false;
    }
  });
  thread.append(form);
  card.append(heading, timestamp, thread);
  return card;
}

function renderHistory() {
  if (!dialog?.open) return;
  const list = dialog.querySelector('.col');
  const scroll = list.scrollTop;
  list.replaceChildren();
  if (!reports.length) {
    const empty = document.createElement('p');
    empty.textContent = 'You have not submitted any bug reports yet.';
    list.append(empty);
  } else reports.forEach(report => list.append(reportCard(report)));
  list.scrollTop = scroll;
}

async function refresh() {
  const current = identity();
  if (account !== current) {
    account = current;
    reports = [];
    updateBadge(0);
    if (dialog?.open) dialog.querySelector('.col').replaceChildren();
  }
  if (!storage.get('code') || !storage.get('password')) {
    if (dialog?.open) dialog.querySelector('.bug-reports-status').textContent = 'Sign in with your seat code and password to view bug reports.';
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
      const result = await auth.suggestionRequest('/bug_reports/list');
      if (identity() !== current) return;
      reports = result.reports;
      if (dialog?.open) {
        dialog.querySelector('.bug-reports-status').textContent = '';
        renderHistory();
      }
      const state = readState(seat);
      const visible = dialog?.open && !document.hidden;
      const unread = reports.filter(report => JSON.parse(version(report)).length && (state[report.id]?.seen !== version(report)));
      if (visible) {
        for (const report of reports) if (JSON.parse(version(report)).length) state[report.id] = { seen: version(report), notified: version(report) };
        writeState(seat, state);
        updateBadge(0);
      } else {
        updateBadge(unread.length);
        const unnotified = unread.filter(report => state[report.id]?.notified !== version(report));
        if (unnotified.length && await notifyBugReportReplies(unnotified.length, seat).catch(() => false)) {
          for (const report of unnotified) state[report.id] = { ...state[report.id], notified: version(report) };
          writeState(seat, state);
        }
      }
    } catch (error) {
      if ((identity() === current) && dialog?.open) dialog.querySelector('.bug-reports-status').textContent = error.message || 'Could not load bug reports. Try Refresh.';
    } finally { pending = null; }
  })();
  return pending;
}

export function openBugReports() {
  if (dialog?.open) {
    refresh();
    return;
  }
  ui.view();
  dialog = ui.modal({
    title: 'My Bug Reports',
    body: '<p class="bug-reports-status" role="status">Loading bug reports...</p><div class="col"></div>',
    buttons: [
      { text: 'Report Bug', onclick: () => { dialog.close(); ui.reportBugModal(); } },
      { text: 'Refresh', onclick: refresh },
    ],
  });
  dialog.classList.add('suggestions-dialog');
  refresh();
}

export function initializeBugReports() {
  if (initialized) return;
  initialized = true;
  document.querySelectorAll('[data-my-bug-reports]').forEach(button => button.addEventListener('click', openBugReports));
  window.addEventListener('bug-reports-updated', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('storage', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('hashchange', () => { if (location.hash === '#bug-reports') openBugReports(); });
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'open-bug-reports') openBugReports();
    if (event.data?.type === 'bug-reports-updated') refresh();
  });
  setInterval(refresh, 30000);
  if (location.hash === '#bug-reports') openBugReports();
  else refresh();
}
