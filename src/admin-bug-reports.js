import "./reset.css";
import "./layout.css";
import "./design.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./themes/themes.js";
import * as ui from "./modules/ui.js";
import * as auth from "./modules/auth.js";
import storage from "./modules/storage.js";

const list = document.getElementById('bug-reports-grid');
const status = document.getElementById('bug-reports-status');
const refresh = document.querySelector('[data-refresh-bug-reports]');
const seatFilter = document.getElementById('bug-reports-seat');
const platformFilter = document.getElementById('bug-reports-platform');
const responseFilter = document.getElementById('bug-reports-response');
const drafts = new Map();
let reports = [];

function reportCard(record) {
  const card = document.createElement('article');
  card.className = 'enhanced-card';
  const heading = document.createElement('h3');
  heading.innerHTML = `${record.platform}<br>Seat ${record.seatCode}`;
  const timestamp = document.createElement('small');
  const date = new Date(record.timestamp);
  timestamp.textContent = Number.isNaN(date.getTime()) ? record.timestamp : date.toLocaleString();
  const thread = document.createElement('section');
  thread.className = 'suggestion-response';
  for (const message of record.messages || []) {
    const entry = document.createElement('div');
    entry.className = `suggestion-message ${message.author}`;
    const author = document.createElement('strong');
    author.textContent = message.author === 'admin' ? 'Admin' : `Seat ${record.seatCode}`;
    const body = document.createElement('p');
    body.className = 'suggestion-text';
    body.textContent = message.message;
    entry.append(author, body);
    if (message.author === 'admin') {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => {
        const input = document.createElement('textarea');
        input.maxLength = 10000;
        input.value = message.message;
        const save = document.createElement('button');
        save.type = 'button';
        save.textContent = 'Save';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        const controls = document.createElement('div');
        controls.className = 'button-grid';
        controls.append(save, cancel);
        body.replaceWith(input);
        edit.replaceWith(controls);
        cancel.addEventListener('click', render);
        save.addEventListener('click', async () => {
          const reply = input.value.trim();
          if (!reply || save.disabled) return;
          save.disabled = true;
          input.disabled = true;
          try {
            const result = await auth.suggestionRequest(`/admin/bug_reports/${record.id}/messages/${message.id}`, { message: reply, previousMessage: message.message }, true);
            reports = reports.map(item => item.id === record.id ? result.report : item);
            render();
            ui.toast(`Reply updated for seat ${record.seatCode}.`, 3000, 'success', 'bi bi-check-circle-fill');
          } catch (error) {
            input.disabled = false;
            save.disabled = false;
            ui.toast(error.message, 5000, 'error', 'bi bi-exclamation-triangle-fill');
          }
        });
      });
      entry.append(edit);
    }
    thread.append(entry);
  }
  card.append(heading, timestamp, thread);
  return card;
}

function render() {
  list.replaceChildren();
  const filtered = reports.filter(report => String(report.seatCode).includes(seatFilter.value.trim()) && (!platformFilter.value || report.platform === platformFilter.value) && (!responseFilter.value || ((responseFilter.value === 'answered') ? report.messages?.some(message => message.author === 'admin') : !report.messages?.some(message => message.author === 'admin'))));
  document.getElementById('bug-reports-count').textContent = `${filtered.length} bug report${filtered.length === 1 ? '' : 's'}`;
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No bug reports match these filters.';
    list.append(empty);
  }
  for (const report of filtered) {
    const card = reportCard(report);
    const form = document.createElement('form');
    const label = document.createElement('label');
    label.htmlFor = `bug-reply-${report.id}`;
    label.textContent = 'Reply';
    const input = document.createElement('textarea');
    input.id = label.htmlFor;
    input.required = true;
    input.maxLength = 10000;
    input.value = drafts.get(report.id)?.value ?? '';
    input.placeholder = 'Enter your reply here...';
    const send = document.createElement('button');
    send.type = 'submit';
    send.textContent = 'Send reply';
    const message = document.createElement('p');
    message.className = 'suggestion-save-status';
    message.setAttribute('role', 'status');
    input.addEventListener('input', () => drafts.set(report.id, { value: input.value }));
    form.append(label, input, send, message);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const reply = input.value.trim();
      if (!reply || send.disabled) return;
      send.disabled = true;
      input.disabled = true;
      message.textContent = 'Sending...';
      try {
        const result = await auth.suggestionRequest(`/admin/bug_reports/${report.id}/messages`, { message: reply }, true);
        reports = reports.map(item => item.id === report.id ? result.report : item);
        drafts.delete(report.id);
        render();
        ui.toast(`Reply sent to seat ${report.seatCode}.`, 3000, 'success', 'bi bi-check-circle-fill');
      } catch (error) {
        message.textContent = error.message;
      } finally {
        send.disabled = false;
        input.disabled = false;
      }
    });
    card.append(form);
    list.append(card);
  }
}

async function load() {
  if (!storage.get('usr') || !storage.get('pwd')) {
    auth.admin(load);
    return;
  }
  refresh.disabled = true;
  status.textContent = 'Loading bug reports...';
  try {
    const result = await auth.suggestionRequest('/admin/bug_reports', {}, true);
    reports = result.reports;
    status.textContent = '';
    render();
  } catch (error) {
    status.textContent = error.message;
    if (error.status === 403) auth.admin(load);
  } finally {
    refresh.disabled = false;
    ui.stopLoader();
  }
}

refresh.addEventListener('click', () => {
  if (drafts.size && !window.confirm('Discard unsaved replies and refresh bug reports?')) return;
  drafts.clear();
  load();
});
seatFilter.addEventListener('input', () => {
  seatFilter.value = seatFilter.value.replace(/[^0-9]/g, '').slice(0, 3);
  render();
});
for (const input of [platformFilter, responseFilter]) input.addEventListener('input', render);
window.addEventListener('beforeunload', event => {
  if (!drafts.size) return;
  event.preventDefault();
  event.returnValue = '';
});
load();
