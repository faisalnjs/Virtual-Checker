import * as ui from "./ui.js";
import * as auth from "./auth.js";
import storage from "./storage.js";

const accountKey = 'virtual-authenticated-accounts';
let dialog = null;
let busy = false;
let linked = [];
const identity = () => JSON.stringify([storage.get('code'), storage.get('password')]);

function accounts() {
  try {
    const value = JSON.parse(localStorage.getItem(accountKey) || '[]');
    return Array.isArray(value) ? value.filter(item => /^[1-9][0-6][0-5]$/.test(item.seatCode) && (typeof item.password === 'string')) : [];
  } catch {
    return [];
  }
}

function remember(info, password) {
  const saved = accounts().filter(item => item.seatCode !== info.seatCode);
  saved.push({ seatCode: info.seatCode, courses: info.courses, password: String(password) });
  localStorage.setItem(accountKey, JSON.stringify(saved));
}

export function forgetSwitcherAccounts() {
  localStorage.removeItem(accountKey);
}

function signInAgain() {
  dialog?.close();
  storage.delete('password');
  ui.view('settings/code', true);
}

async function switchAccount(seatCode, password) {
  const original = identity();
  const result = await auth.authenticateAccountSwitch(seatCode, password);
  if (identity() !== original) throw new Error('The active account changed. Open Seat Code Switcher again.');
  if (ui.unsavedChanges && !window.confirm('Switch accounts and discard your unsaved work?')) return;
  remember(result.current, storage.get('password'));
  remember(result.account, password);
  await storage.idbReady;
  await storage.idbDelete('cache');
  await storage.idbDelete('adminCache');
  storage.delete('cache');
  if (identity() !== original) throw new Error('The active account changed. Open Seat Code Switcher again.');
  window.__drawInstance?.destroy?.();
  const next = { code: result.account.seatCode, password: String(password) };
  if (storage.get('developer')) next.developer = true;
  localStorage.setItem(storage.id, JSON.stringify(next));
  storage.syncWithCookie();
  ui.setUnsavedChanges?.(false);
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('code', result.account.seatCode);
  window.location.replace(url.href);
}

function addAccount(seat = '', message = '') {
  dialog?.close();
  const form = ui.modal({
    title: seat ? 'Authenticate Account' : 'Add Seat Code',
    body: '<p>Linked seat codes and purchased themes are shared across Virtual Checker and Virtual Clicker.</p><p class="account-switch-status" role="status"></p>',
    inputs: [
      { type: 'text', label: 'Seat code', defaultValue: seat },
      { type: 'password', label: 'Password' },
    ],
    buttons: [
      { text: 'Back', close: false, onclick: () => { if (!busy) { form.close(); openAccountSwitcher(); } } },
      {
        text: 'Add and switch', class: 'account-switch-submit', close: false, onclick: async () => {
          if (busy) return;
          const [code, password] = form.querySelectorAll('.dialog-input');
          if (!/^[1-9][0-6][0-5]$/.test(code.value) || !password.value) {
            status.textContent = 'Enter a valid three-digit seat code and password.';
            return;
          }
          busy = true;
          submit.disabled = true;
          status.textContent = 'Authenticating...';
          try {
            await switchAccount(code.value, password.value);
            status.textContent = '';
          } catch (error) {
            status.textContent = error.message;
            if (error.account === 'current') {
              form.close();
              signInAgain();
            }
          } finally {
            busy = false;
            submit.disabled = false;
          }
        }
      },
    ],
  });
  const status = form.querySelector('.account-switch-status');
  const submit = form.querySelector('.account-switch-submit');
  const code = form.querySelector('.dialog-input');
  code.inputMode = 'numeric';
  code.maxLength = 3;
  code.autocomplete = 'username';
  form.querySelector('input[type="password"]').autocomplete = 'current-password';
  code.addEventListener('input', () => { code.value = code.value.replace(/[^0-9]/g, '').slice(0, 3); });
  status.textContent = message;
}

function renderAccounts() {
  const list = dialog.querySelector('.account-switch-list');
  list.replaceChildren();
  for (const account of linked) {
    const row = document.createElement('div');
    row.className = 'button-grid';
    const current = account.seatCode === String(storage.get('code'));
    const select = document.createElement('button');
    const courses = Array.isArray(account.courses) ? account.courses.filter(name => typeof name === 'string').join(', ') : '';
    select.textContent = `Seat ${account.seatCode}${courses ? ` - ${courses}` : ''}${current ? ' (Current)' : ''}`;
    select.style.width = 'inherit';
    select.style.textAlign = 'left';
    select.disabled = current;
    select.addEventListener('click', async () => {
      if (busy) return;
      const saved = accounts().find(item => item.seatCode === account.seatCode);
      if (!saved) {
        addAccount(account.seatCode);
        return;
      }
      busy = true;
      select.disabled = true;
      const status = dialog.querySelector('.account-switch-status');
      status.textContent = 'Switching accounts...';
      try {
        await switchAccount(account.seatCode, saved.password);
        status.textContent = '';
      } catch (error) {
        status.textContent = error.message;
        if (error.account === 'current') {
          signInAgain();
        } else if (error.account === 'target') {
          addAccount(account.seatCode, error.message);
        }
      } finally {
        busy = false;
        select.disabled = current;
      }
    });
    row.append(select);
    if (!current) {
      const remove = document.createElement('button');
      remove.innerHTML = '<i class="bi bi-x"></i>';
      remove.setAttribute('square', '');
      remove.setAttribute('aria-label', 'Forget');
      remove.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        const status = dialog.querySelector('.account-switch-status');
        try {
          linked = await auth.linkedAccounts(account.seatCode);
          localStorage.setItem(accountKey, JSON.stringify(accounts().filter(item => item.seatCode !== account.seatCode)));
          renderAccounts();
          status.textContent = '';
        } catch (error) {
          status.textContent = error.message;
          if (error.account === 'current') signInAgain();
        } finally {
          busy = false;
        }
      });
      row.append(remove);
    }
    list.append(row);
  }
}

export async function openAccountSwitcher() {
  if (!storage.get('code') || !storage.get('password')) {
    ui.view('settings/code', true);
    return;
  }
  if (dialog?.open || busy) return;
  ui.view();
  dialog = ui.modal({
    title: 'Seat Code Switcher',
    body: '<p>Switch between seat codes.</p><p class="account-switch-status" role="status">Loading seat codes...</p><div class="account-switch-list col"></div>',
    buttons: [{ text: 'Add Seat Code', class: 'account-switch-add', close: false, onclick: () => { if (!busy) addAccount(); } }],
  });
  const opened = dialog;
  const add = dialog.querySelector('.account-switch-add');
  add.disabled = true;
  const original = identity();
  try {
    linked = await auth.linkedAccounts();
    for (const saved of accounts()) {
      if (linked.some(account => account.seatCode === saved.seatCode)) continue;
      if (localStorage.getItem('virtual-accounts-migrated')) break;
      try {
        await auth.authenticateAccountSwitch(saved.seatCode, saved.password);
      } catch (error) {
        if (error.account !== 'target') throw error;
      }
    }
    linked = await auth.linkedAccounts();
    localStorage.setItem('virtual-accounts-migrated', 'true');
    if ((identity() !== original) || (dialog !== opened) || !opened.open) return;
    remember(linked.find(account => account.seatCode === String(storage.get('code'))), storage.get('password'));
    renderAccounts();
    dialog.querySelector('.account-switch-status').textContent = '';
    add.disabled = false;
  } catch (error) {
    if ((identity() !== original) || (dialog !== opened) || !opened.open) return;
    dialog.querySelector('.account-switch-status').textContent = error.message;
    if (error.account === 'current') signInAgain();
  }
}

window.addEventListener('storage', event => {
  if (event.key !== storage.id) return;
  try {
    const before = JSON.parse(event.oldValue || '{}');
    const after = JSON.parse(event.newValue || '{}');
    if (String(before.code || '') !== String(after.code || '')) window.location.reload();
  } catch {
    window.location.reload();
  }
});
