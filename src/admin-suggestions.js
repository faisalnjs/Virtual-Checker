import "./reset.css";
import "./layout.css";
import "./design.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./themes/themes.js";
import * as ui from "./modules/ui.js";
import * as auth from "./modules/auth.js";
import storage from "./modules/storage.js";

const list = document.getElementById('suggestions-grid');
const status = document.getElementById('suggestions-status');
const refresh = document.querySelector('[data-refresh-suggestions]');
const seatFilter = document.getElementById('suggestions-seat');
const platformFilter = document.getElementById('suggestions-platform');
const responseFilter = document.getElementById('suggestions-response');
let suggestions = [];
const drafts = new Map();

function suggestionCard(record) {
  const card = document.createElement("article");
  card.className = "enhanced-card";
  const heading = document.createElement("h3");
  heading.innerHTML = `${record.platform}<br>Seat ${record.seatCode}`;
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
  if (record.response) {
    const reply = document.createElement("section");
    reply.className = "suggestion-response";
    const response = document.createElement("p");
    response.className = "suggestion-text";
    response.textContent = record.response;
    reply.append(response);
    card.append(reply);
  }
  return card;
}

function render() {
  list.replaceChildren();
  const filtered = suggestions.filter(item => String(item.seatCode).includes(seatFilter.value.trim()) && (!platformFilter.value || (item.platform === platformFilter.value)) && (!responseFilter.value || ((responseFilter.value === 'answered') ? Boolean(item.response) : !item.response)));
  document.getElementById('suggestions-count').textContent = `${filtered.length} suggestion${(filtered.length === 1) ? '' : 's'}`;
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No suggestions match these filters.';
    list.append(empty);
  }
  for (const item of filtered) {
    const card = suggestionCard(item);
    const form = document.createElement('form');
    const label = document.createElement('label');
    label.htmlFor = `reply-${item.id}`;
    label.textContent = item.response ? "Response" : "Awaiting a response";
    const input = document.createElement('textarea');
    input.id = label.htmlFor;
    input.required = true;
    input.maxLength = 10000;
    input.value = drafts.get(item.id)?.value ?? item.response ?? '';
    if (!item.response) input.placeholder = 'Enter your response here...';
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Save response';
    const message = document.createElement('p');
    message.className = 'suggestion-save-status';
    message.setAttribute('role', 'status');
    input.addEventListener('input', () => {
      const existing = drafts.get(item.id);
      drafts.set(item.id, {
        value: input.value,
        timestamp: existing?.timestamp ?? item.timestamp,
        previousResponse: existing?.previousResponse ?? item.response ?? ''
      });
    });
    form.append(label, input, save, message);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (save.disabled) return;
      const response = input.value.trim();
      if (!response) {
        message.textContent = 'Enter a response before saving.';
        return;
      }
      const draft = drafts.get(item.id);
      save.disabled = true;
      input.disabled = true;
      message.textContent = 'Saving...';
      try {
        const result = await auth.suggestionRequest(`/admin/suggestions/${item.id}/response`, {
          response,
          timestamp: draft?.timestamp ?? item.timestamp,
          previousResponse: draft?.previousResponse ?? item.response ?? '',
        }, true);
        suggestions = suggestions.map(row => row.id === item.id ? result.suggestion : row);
        drafts.delete(item.id);
        render();
        status.textContent = `Response saved for seat ${item.seatCode}.`;
      } catch (error) {
        message.textContent = error.message;
      } finally {
        save.disabled = false;
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
  status.textContent = 'Loading suggestions...';
  try {
    const result = await auth.suggestionRequest('/admin/suggestions', {}, true);
    suggestions = result.suggestions;
    status.textContent = '';
    render();
  } catch (error) {
    status.textContent = error.message;
    if (error.status === 403) {
      suggestions = [];
      drafts.clear();
      render();
      auth.admin(load);
    }
  } finally {
    refresh.disabled = false;
    ui.stopLoader();
  }
}
refresh.addEventListener('click', () => {
  if (drafts.size && !window.confirm('Discard unsaved replies and refresh suggestions?')) return;
  drafts.clear();
  load();
});
seatFilter.addEventListener('input', () => {
  seatFilter.value = seatFilter.value.replace(/[^0-9]/g, '').slice(0, 3);
  render();
});
for (const input of [platformFilter, responseFilter]) input.addEventListener('input', render);
window.addEventListener('beforeunload', event => {
  if (drafts.size) {
    event.preventDefault();
    event.returnValue = '';
  }
});
load();
