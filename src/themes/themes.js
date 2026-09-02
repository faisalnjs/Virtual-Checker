/* eslint-disable no-inner-declarations */
import "./themes.css";
import themes from "./themes.json";

import "./butterfly/butterfly.js";
import "./festive/festive.js";

import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as auth from "/src/modules/auth.js";
import Element from "/src/modules/element.js";
import { syncPwaTheme } from "/src/modules/service-worker.js";

import lipsky from "./lipsky/lipsky.webp";

let selectedTheme = "";
const defaultTheme = {
  "color-scheme": "light",
  "text-color": "#2c2c2c",
  "background-color": "#fafafa",
  "surface-color": "#e7e7e7",
  "accent-color": "#424242",
  "accent-text-color": "#ffffff",
  "error-color": "#fa8796",
};
Object.freeze(defaultTheme);

const customTheme = Object.assign({}, storage.get("custom-theme") || defaultTheme);

const colorizeTrigger = document.querySelector('[data-modal-view="colorize"]');
const colorizeRange = document.getElementById('colorize');

export function resetTheme() {
  disableTransitions();
  document.body.removeAttribute("data-theme");
  removeCustomTheme();
  document.getElementById("theme-preview")?.removeAttribute("data-theme");
  enableTransitions();
  storage.set("theme", "default");
  storage.delete("custom-theme");
  syncPwaTheme().catch(() => null);
}

export function disableTransitions() {
  document.body.classList.remove("enable-transitions");
}

export function enableTransitions() {
  document.body.offsetHeight;
  document.body.classList.add("enable-transitions");
}

export async function syncTheme() {
  const value = storage.get("theme");
  disableTransitions();
  if (value === "custom") {
    applyCustomTheme();
    selectedTheme = "";
  } else {
    document.body.setAttribute("data-theme", value);
    removeCustomTheme();
    enableTransitions();
    // Update developer theme input
    if (document.getElementById("theme-debug")) document.getElementById("theme-debug").value = value;
  }
  await syncPwaTheme().catch(() => null);
}

function copyThemeCSS() {
  const properties = Object.entries(customTheme)
    .filter(([key]) => key?.trim())
    .map(([key, value]) => {
      const prefix = key == "color-scheme" ? "" : "--";
      return `${prefix}${key}: ${value};`;
    });
  const css = `[data-theme="custom"] {\n  ${properties.join("\n  ")}\n}`;
  navigator.clipboard.writeText(css);
}

function validateThemeCode() {
  const code = document.getElementById("theme-code")?.value;
  const theme = decodeThemeCode(code);
  storage.get("developer") && console.log(theme);
  updateThemeCode();
  if (theme) {
    Object.assign(customTheme, theme);
    updateEditorFields();
    updateEditorPreview();
  }
}

function updateEditorFields() {
  Object.entries(customTheme).forEach(([key, value]) => {
    const event = new Event("update");
    const input = document.querySelector(`#theme-editor [name="${key}"]`);
    if (input) {
      input.value = value;
      input.dispatchEvent(event);
    }
  });
}

function updateEditorPreview(theme = customTheme) {
  const preview = document.getElementById("editor-preview");
  if (!preview) return;
  Object.entries(theme).forEach(([key, value]) => {
    const prefix = key == "color-scheme" ? "" : "--";
    preview?.style.setProperty(prefix + key, value);
  });
}

function applyCustomTheme() {
  if (!storage.get("custom-theme")) return;
  Object.entries(storage.get("custom-theme")).forEach(([key, value]) => {
    const prefix = key == "color-scheme" ? "" : "--";
    document.body.style.setProperty(prefix + key, value);
  });
  document.getElementById("theme-preview")?.removeAttribute("data-theme");
}

function removeCustomTheme() {
  if (!storage.get("custom-theme")) return;
  Object.keys(storage.get("custom-theme")).forEach((key) => {
    const prefix = key == "color-scheme" ? "" : "--";
    document.body.style.removeProperty(prefix + key);
  });
}

function updateThemeCode() {
  if (document.getElementById("theme-code")) document.getElementById("theme-code").value = encodeThemeCode(customTheme);
}

function sortKeys(obj) {
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {});
}

function encodeThemeCode(theme) {
  return "VC" + btoa(Object.values(sortKeys(theme)).join(","));
}

function decodeThemeCode(code) {
  try {
    const keys = Object.keys(defaultTheme);
    const values = atob(code.substring(2)).split(",");
    if (values.length < keys.length) {
      throw new Error();
    }
    return Object.fromEntries(keys.sort().map((key, i) => [key, values[i]]));
  } catch (e) {
    return false;
  }
}

export function renderThemesGrid(originalTheme = null) {
  alert(2)
  const themesGrid = document.querySelector(".welcome-container .themes-grid");
  console.log(themesGrid)
  if (!themesGrid) return;
  themesGrid.innerHTML = "";
  themes.filter(theme => !theme[3]).forEach((theme) => {
    const value = theme[0];
    const name = theme[1] || theme[0];
    const button = document.createElement("button");
    button.textContent = name;
    button.setAttribute("data-theme", value);
    if (value === originalTheme) button.classList.add('selected');
    button.addEventListener("click", () => {
      if (!document.querySelector('.welcome-container') || (document.querySelector('.welcome-container').getAttribute('step') !== '11')) return;
      selectedTheme = value;
      document.querySelector('.welcome-container')?.setAttribute("data-theme", value);
      originalTheme = value;
      storage.set("theme", value);
      syncTheme();
    });
    button.addEventListener("mouseover", () => {
      if (document.querySelector('.welcome-container') && (document.querySelector('.welcome-container').getAttribute('step') === '11')) document.querySelector('.welcome-container').setAttribute("data-theme", value);
    });
    button.addEventListener("mouseout", () => {
      if (document.querySelector('.welcome-container') && (document.querySelector('.welcome-container').getAttribute('step') === '11')) document.querySelector('.welcome-container').setAttribute("data-theme", originalTheme);
    });
    themesGrid.append(button);
  });
}

export function initializeThemeEditor() {
  document.querySelectorAll("#theme-editor :is(input, select):not(#theme-code)").forEach((input) => {
    input.addEventListener("input", () => {
      customTheme[input.name] = input.value;
      updateEditorPreview();
      updateThemeCode();
      updateEditorFields();
    });
  });
}

export async function renderStore() {
  const store = document.querySelector(`[data-modal-page="store"]`);
  if (!store) return;
  store.innerHTML = "";
  await storage.idbReady;
  var initialTheme = storage.get("theme") || "default";
  var checks = (await storage.idbGet("cache"))?.checksCount || 0;
  document.getElementById("controls-container")?.setAttribute('checks', checks);
  var ownedThemes = (await storage.idbGet("cache"))?.ownedThemes || [];
  if (document.body.getAttribute('data-theme') && !ownedThemes.includes(document.body.getAttribute('data-theme')) && themes.find(theme => theme[0] === document.body.getAttribute('data-theme'))?.[3]) {
    resetTheme();
    ui.toast("Applied theme is not owned.", 2000, "error", "bi bi-exclamation-triangle-fill");
    await auth.syncPush("theme")
      .catch(error => {
        if (storage.get("developer")) {
          alert(`Error @ themes.js: ${error.message}`);
        } else {
          ui.reportBugModal(null, String(error.stack));
        }
      });
    renderStore();
    return;
  }
  var featuredTheme = themes.filter(t => t[3] && (t[0] !== document.body.getAttribute('data-theme')))[Math.floor(Math.random() * themes.filter(t => t[3] && (t[0] !== document.body.getAttribute('data-theme'))).length)];
  const checksText = document.createElement("p");
  checksText.classList = 'checks-text';
  checksText.innerHTML = `<i class="bi bi-check2-circle"></i> You've got ${checks} Check${checks == 1 ? '' : 's'} available to spend!`;
  store.appendChild(checksText);
  if (featuredTheme) {
    const promo = document.createElement("div");
    promo.classList = 'promo';
    promo.setAttribute('data-theme', featuredTheme[0] || '');
    const promoInner = document.createElement("div");
    promoInner.classList = 'promo-inner';
    promoInner.innerHTML = `<i class="bi bi-${featuredTheme[2] || 'backpack'}"></i>${featuredTheme[1] || featuredTheme[0]}<i class="bi bi-${featuredTheme[2] || 'backpack'}"></i>`;
    promo.appendChild(promoInner);
    const promoButton = document.createElement("button");
    promoButton.textContent = ownedThemes.includes(featuredTheme[0]) ? "Owned" : "Preview Theme";
    promoButton.addEventListener("mouseover", () => {
      initialTheme = document.body.getAttribute('data-theme') || '';
      document.body.setAttribute('data-theme', featuredTheme[0] || '');
      if (ownedThemes.includes(featuredTheme[0]) || !featuredTheme[3]) {
        promoButton.textContent = "Apply Theme";
      } else if (featuredTheme[4] && featuredTheme[4].length && !featuredTheme[4].some(t => ownedThemes.includes(t))) {
        promoButton.textContent = "Locked";
      } else if (checks >= featuredTheme[3]) {
        promoButton.textContent = `Purchase for ${featuredTheme[3]} Check${featuredTheme[3] == 1 ? '' : 's'}`;
      } else {
        promoButton.textContent = "Insufficient Checks";
      }
    });
    promoButton.addEventListener("mouseout", () => {
      document.body.setAttribute('data-theme', initialTheme);
      promoButton.textContent = ownedThemes.includes(featuredTheme[0]) ? "Owned" : "Preview Theme";
    });
    promoButton.addEventListener("click", async () => {
      if (ownedThemes.includes(featuredTheme[0]) || !featuredTheme[3]) {
        initialTheme = featuredTheme[0];
        storage.set("theme", featuredTheme[0]);
        document.body.setAttribute('data-theme', featuredTheme[0]);
        Array.from(store.querySelectorAll('.theme-item.selected')).forEach(el => el.classList.remove('selected'));
        Array.from(store.querySelectorAll(`.theme-item[data-theme="${featuredTheme[0]}"]`)).forEach(el => el.classList.add('selected'));
        Array.from(store.querySelectorAll('.theme-item button')).forEach(btn => {
          btn.textContent = btn.parentElement.classList.contains('selected') ? "Applied" : (ownedThemes.includes(btn.parentElement.getAttribute('data-theme')) ? "Owned" : "Preview");
        });
        await auth.syncPush("theme")
          .catch(error => {
            if (storage.get("developer")) {
              alert(`Error @ themes.js: ${error.message}`);
            } else {
              ui.reportBugModal(null, String(error.stack));
            }
          });
        ui.toast(`Applied ${featuredTheme[1] || featuredTheme[0]} theme.`, 2000, "success", "bi bi-check2-circle");
      } else {
        if (featuredTheme[4] && featuredTheme[4].length && !featuredTheme[4].some(t => ownedThemes.includes(t))) {
          ui.toast(`Cannot purchase ${featuredTheme[1] || featuredTheme[0]} theme. Missing required themes: ${featuredTheme[4].map(t => themes.find(th => th[0] == t)[1] || t).join(', ')}.`, 4000, "error", "bi bi-exclamation-triangle-fill");
          return;
        }
        if (checks >= featuredTheme[3]) {
          ui.modal({
            title: `Purchase ${featuredTheme[1] || featuredTheme[0]} Theme`,
            body: `<p>Are you sure you want to purchase the ${featuredTheme[1] || featuredTheme[0]} theme for ${featuredTheme[3]} Check${featuredTheme[3] == 1 ? '' : 's'}? You have ${checks} Check${checks == 1 ? '' : 's'} and will have ${checks - featuredTheme[3]} Check${(checks - featuredTheme[3]) == 1 ? '' : 's'} remaining.</p>`,
            buttons: [
              {
                text: 'Cancel',
                icon: 'bi-x-lg',
                class: 'cancel-button',
                onclick: () => {
                  ui.view("store");
                },
                close: true,
              },
              {
                text: 'Purchase',
                icon: 'bi-bag-check-fill',
                class: 'submit-button',
                onclick: async () => {
                  await auth.buyTheme(featuredTheme[0], featuredTheme[3])
                    .catch(error => {
                      if (storage.get("developer")) {
                        alert(`Error @ themes.js: ${error.message}`);
                      } else {
                        ui.reportBugModal(null, String(error.stack));
                      }
                    });
                  ownedThemes.push(featuredTheme[0]);
                  const cache = await storage.idbGet("cache") || {};
                  cache.ownedThemes = ownedThemes;
                  cache.checksCount = (cache.checksCount || 0) - featuredTheme[3];
                  await storage.idbSet("cache", cache);
                  Array.from(store.querySelectorAll('.theme-item.selected')).forEach(el => el.classList.remove('selected'));
                  Array.from(store.querySelectorAll(`.theme-item[data-theme="${featuredTheme[0]}"]`)).forEach(el => el.classList.add('selected'));
                  Array.from(store.querySelectorAll('.theme-item button')).forEach(btn => {
                    btn.textContent = btn.parentElement.classList.contains('selected') ? "Applied" : (ownedThemes.includes(btn.parentElement.getAttribute('data-theme')) ? "Owned" : "Preview");
                  });
                  checksText.innerHTML = `<i class="bi bi-check2-circle"></i> You've got ${cache.checksCount} Check${(cache.checksCount == 1) ? '' : 's'} available to spend!`;
                  document.getElementById("controls-container")?.setAttribute('checks', cache.checksCount);
                  storage.set("theme", featuredTheme[0]);
                  document.body.setAttribute('data-theme', featuredTheme[0]);
                  await auth.syncPush("theme")
                    .catch(error => {
                      if (storage.get("developer")) {
                        alert(`Error @ themes.js: ${error.message}`);
                      } else {
                        ui.reportBugModal(null, String(error.stack));
                      }
                    });
                  ui.toast(`Purchased and applied ${featuredTheme[1] || featuredTheme[0]} theme.`, 2000, "success", "bi bi-bag-check-fill");
                },
                close: true,
              },
            ],
          });
        } else {
          ui.toast(`Insufficient Checks to purchase ${featuredTheme[1] || featuredTheme[0]} theme.`, 2000, "error", "bi bi-exclamation-triangle-fill");
        }
      }
    });
    promo.appendChild(promoButton);
    store.appendChild(promo);
  }
  const freeThemesGrid = document.createElement("div");
  freeThemesGrid.classList = 'themes-grid';
  const premiumThemesGrid = document.createElement("div");
  premiumThemesGrid.classList = 'themes-grid';
  const animatedThemesGrid = document.createElement("div");
  animatedThemesGrid.classList = 'themes-grid';
  themes.forEach(theme => {
    const value = theme[0];
    const name = theme[1] || theme[0];
    const themeItem = document.createElement("div");
    themeItem.classList = 'theme-item';
    themeItem.setAttribute("data-theme", value);
    if (theme[3]) {
      themeItem.setAttribute('tooltip', `${checks}/${theme[3]} Check${theme[3] == 1 ? '' : 's'}${theme[4].filter(t => !ownedThemes.includes(t[0])) && theme[4].filter(t => !ownedThemes.includes(t[0])).length ? `. You need: ${theme[4].filter(t => !ownedThemes.includes(t[0])).map(t => themes.find(th => th[0] == t)[1] || t).join(', ')}` : ''}`);
      if (theme[7]) {
        themeItem.setAttribute('style', `background: url('/store/thumb/${theme[0]}.png') center / 100px repeat !important;`);
      } else {
        themeItem.setAttribute('style', `background: url('/store/thumb/${theme[0]}.png') center / cover no-repeat !important;`);
      }
    }
    themeItem.innerHTML = `${theme[2] ? `<i class="bi bi-${theme[2]}"></i>` : ''}${theme[5] ? `<i class="bi bi-badge-hd-fill hd"></i>` : ''}${theme[6] ? `<i class="bi bi-stars animated"></i>` : ''}${theme[7] ? `<i class="bi bi-border pattern"></i>` : ''}${theme[8] ? `<i class="bi bi-palette2 colorized"></i>` : ''}<h5>${name}</h5><p>${theme[3] ? `${theme[3]} Check${theme[3] == 1 ? '' : 's'}` : 'Free'}</p>${theme[4] && theme[4].length ? `<small>Requires: ${theme[4].map(t => themes.find(th => th[0] == t)[1] || t).join(', ')}</small>` : ''}`;
    if (value === initialTheme) themeItem.classList.add('selected');
    const themeButton = document.createElement("button");
    themeButton.textContent = (value === initialTheme) ? "Applied" : (ownedThemes.includes(theme[0]) ? "Owned" : "Preview");
    themeButton.addEventListener("mouseover", () => {
      initialTheme = document.body.getAttribute('data-theme') || '';
      document.body.setAttribute('data-theme', theme[0] || '');
      if (themeItem.classList.contains('selected')) {
        themeButton.textContent = "Applied";
      } else if (ownedThemes.includes(theme[0]) || !theme[3]) {
        themeButton.textContent = "Apply Now";
      } else if (theme[4] && theme[4].length && !theme[4].some(t => ownedThemes.includes(t))) {
        themeButton.textContent = "Locked";
      } else if (checks >= theme[3]) {
        themeButton.textContent = `Purchase for ${theme[3]} Check${theme[3] == 1 ? '' : 's'}`;
      } else {
        themeButton.textContent = "Insufficient Checks";
      }
    });
    themeButton.addEventListener("mouseout", () => {
      document.body.setAttribute('data-theme', initialTheme);
      themeButton.textContent = themeItem.classList.contains('selected') ? "Applied" : (ownedThemes.includes(theme[0]) ? "Owned" : "Preview");
    });
    themeButton.addEventListener("click", async () => {
      if (themeItem.classList.contains('selected')) return;
      if (ownedThemes.includes(theme[0]) || !theme[3]) {
        initialTheme = theme[0];
        storage.set("theme", theme[0]);
        document.body.setAttribute('data-theme', theme[0]);
        Array.from(store.querySelectorAll('.theme-item.selected')).forEach(el => el.classList.remove('selected'));
        themeItem.classList.add('selected');
        Array.from(store.querySelectorAll('.theme-item button')).forEach(btn => {
          btn.textContent = btn.parentElement.classList.contains('selected') ? "Applied" : (ownedThemes.includes(btn.parentElement.getAttribute('data-theme')) ? "Owned" : "Preview");
        });
        await auth.syncPush("theme")
          .catch(error => {
            if (storage.get("developer")) {
              alert(`Error @ themes.js: ${error.message}`);
            } else {
              ui.reportBugModal(null, String(error.stack));
            }
          });
        ui.toast(`Applied ${name} theme.`, 2000, "success", "bi bi-check2-circle");
      } else {
        if (theme[4] && theme[4].length && !theme[4].some(t => ownedThemes.includes(t))) {
          ui.toast(`Cannot purchase ${name} theme. Missing required themes: ${theme[4].map(t => themes.find(th => th[0] == t)[1] || t).join(', ')}.`, 4000, "error", "bi bi-exclamation-triangle-fill");
          return;
        }
        if (checks >= theme[3]) {
          ui.modal({
            title: `Purchase ${name} Theme`,
            body: `<p>Are you sure you want to purchase the ${name} theme for ${theme[3]} Check${theme[3] == 1 ? '' : 's'}? You have ${checks} Check${checks == 1 ? '' : 's'} and will have ${checks - theme[3]} Check${(checks - theme[3]) == 1 ? '' : 's'} remaining.</p>`,
            buttons: [
              {
                text: 'Cancel',
                icon: 'bi-x-lg',
                class: 'cancel-button',
                onclick: () => {
                  ui.view("store");
                },
                close: true,
              },
              {
                text: 'Purchase',
                icon: 'bi-bag-check-fill',
                class: 'submit-button',
                onclick: async () => {
                  await auth.buyTheme(theme[0], theme[3])
                    .catch(error => {
                      if (storage.get("developer")) {
                        alert(`Error @ themes.js: ${error.message}`);
                      } else {
                        ui.reportBugModal(null, String(error.stack));
                      }
                    });
                  ownedThemes.push(theme[0]);
                  const cache = await storage.idbGet("cache") || {};
                  cache.ownedThemes = ownedThemes;
                  cache.checksCount = (cache.checksCount || 0) - theme[3];
                  await storage.idbSet("cache", cache);
                  Array.from(store.querySelectorAll('.theme-item.selected')).forEach(el => el.classList.remove('selected'));
                  themeItem.classList.add('selected');
                  Array.from(store.querySelectorAll('.theme-item button')).forEach(btn => {
                    btn.textContent = btn.parentElement.classList.contains('selected') ? "Applied" : (ownedThemes.includes(btn.parentElement.getAttribute('data-theme')) ? "Owned" : "Preview");
                  });
                  checksText.innerHTML = `<i class="bi bi-check2-circle"></i> You've got ${cache.checksCount} Check${(cache.checksCount == 1) ? '' : 's'} available to spend!`;
                  storage.set("theme", theme[0]);
                  document.body.setAttribute('data-theme', theme[0]);
                  await auth.syncPush("theme")
                    .catch(error => {
                      if (storage.get("developer")) {
                        alert(`Error @ themes.js: ${error.message}`);
                      } else {
                        ui.reportBugModal(null, String(error.stack));
                      }
                    });
                  ui.toast(`Purchased and applied ${name} theme.`, 2000, "success", "bi bi-bag-check-fill");
                },
                close: true,
              },
            ],
          });
        } else {
          ui.toast(`Insufficient Checks to purchase ${name} theme.`, 2000, "error", "bi bi-exclamation-triangle-fill");
        }
      }
    });
    themeItem.appendChild(themeButton);
    if (theme[6]) {
      animatedThemesGrid.append(themeItem);
    } else if (theme[3]) {
      premiumThemesGrid.append(themeItem);
    } else {
      freeThemesGrid.append(themeItem);
    }
  });
  const freeThemesGridText = document.createElement("b");
  freeThemesGridText.innerText = 'Free Themes';
  store.appendChild(freeThemesGridText);
  const freeThemesGridSuggestTheme = document.createElement("div");
  freeThemesGridSuggestTheme.classList = 'theme-item suggest-theme';
  freeThemesGridSuggestTheme.innerHTML = `<i class="bi bi-plus-lg"></i>`;
  freeThemesGridSuggestTheme.onclick = ui.suggestionsModal;
  freeThemesGrid.appendChild(freeThemesGridSuggestTheme);
  store.appendChild(freeThemesGrid);
  const premiumThemesGridText = document.createElement("b");
  premiumThemesGridText.innerText = 'Premium Themes';
  store.appendChild(premiumThemesGridText);
  const premiumThemesGridSuggestTheme = document.createElement("div");
  premiumThemesGridSuggestTheme.classList = 'theme-item suggest-theme';
  premiumThemesGridSuggestTheme.innerHTML = `<i class="bi bi-plus-lg"></i>`;
  premiumThemesGridSuggestTheme.onclick = ui.suggestionsModal;
  premiumThemesGrid.appendChild(premiumThemesGridSuggestTheme);
  store.appendChild(premiumThemesGrid);
  const animatedThemesGridText = document.createElement("b");
  animatedThemesGridText.innerText = 'Animated Themes';
  store.appendChild(animatedThemesGridText);
  const animatedThemesGridSuggestTheme = document.createElement("div");
  animatedThemesGridSuggestTheme.classList = 'theme-item suggest-theme';
  animatedThemesGridSuggestTheme.innerHTML = `<i class="bi bi-plus-lg"></i>`;
  animatedThemesGridSuggestTheme.onclick = ui.suggestionsModal;
  animatedThemesGrid.appendChild(animatedThemesGridSuggestTheme);
  store.appendChild(animatedThemesGrid);
  const costInfo = document.createElement("ul");
  costInfo.classList = 'cost-info';
  costInfo.innerHTML = `<i class="bi bi-info-circle"></i> Information<li>Checks can be obtained by responding to a question correctly, at any time.</li><li>Checks conversion rate is 1 Check to 1 correct answer.</li><li>Checks may only be obtained on the Virtual Checker platform.</li><li>If your response is marked correct late, you will get your Checks at that time.</li><li>If your response is falsely marked as correct and later marked incorrect, your Checks balance will be deducted from.</li><li>The minimum Checks balance is 0.</li><li>Themes marked as "Free" can be applied without spending any Checks.</li><li>Premium and animated themes require you to spend your available Checks to unlock and use them.</li><li>Themes that have requirements need you to own the specified themes before you can purchase them.</li><li>HD and animated themes may require more resources to run smoothly, and cost more Checks.</li><li>All theme images are licensed Free To Use.</li><li>The cost for themes are based on average student correct answer data.</li><li>Purchased themes are saved to your seat code and are available on multiple devices.</li>`;
  store.appendChild(costInfo);
  const refundButton = document.createElement('button');
  refundButton.innerText = 'Theme Refunds';
  store.appendChild(refundButton);
  refundButton.addEventListener('click', async () => {
    ui.view();
    ui.modal({
      title: 'Theme Refunds',
      body: `<p>Theme refunds are available for 50% Checks back.</p>`,
      input: {
        label: 'Owned Themes',
        type: 'select',
        options: ((await storage.idbGet("cache"))?.ownedThemes || []).map(ownedTheme => {
          let theme = themes.find(t => t[0] === ownedTheme);
          return {
            value: theme[0],
            text: `${theme[1]} - ${theme[3] / 2} Checks back`,
          };
        }),
        multiple: true,
      },
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: (inputValues) => {
            if (!inputValues || !inputValues.length) {
              ui.toast("No themes selected for refund.", 2000, "error", "bi bi-exclamation-triangle-fill");
              return;
            }
            ui.modal({
              title: 'Confirm Refund',
              body: `<p>Are you sure you want to refund the selected theme(s) for 50% Checks back? This action cannot be undone.</p>`,
              buttons: [
                {
                  text: 'Cancel',
                  class: 'cancel-button',
                  close: true,
                },
                {
                  text: 'Confirm',
                  class: 'submit-button',
                  onclick: async () => {
                    await auth.refundThemes(inputValues)
                      .catch(error => {
                        if (storage.get("developer")) {
                          alert(`Error @ themes.js: ${error.message}`);
                        } else {
                          ui.reportBugModal(null, String(error.stack));
                        }
                      });
                    const cache = await storage.idbGet("cache") || {};
                    inputValues.forEach(ownedTheme => {
                      let theme = themes.find(t => t[0] === ownedTheme);
                      cache.ownedThemes = cache.ownedThemes.filter(t => t !== ownedTheme);
                      cache.checksCount = (cache.checksCount || 0) + (theme[3] / 2);
                    });
                    await storage.idbSet("cache", cache);
                    ui.toast(`Refunded ${inputValues.length} theme${(inputValues.length === 1) ? '' : 's'}.`, 2000, "success", "bi bi-check2-circle");
                    renderStore()
                      .catch(error => {
                        if (storage.get("developer")) {
                          alert(`Error @ themes.js: ${error.message}`);
                        } else {
                          ui.reportBugModal(null, String(error.stack));
                        }
                      });
                  },
                  close: true,
                },
              ],
            });
          },
          close: true,
        },
      ],
    })
  });
}

export function getCurrentTheme() {
  return {
    textColor: getComputedStyle(document.body).getPropertyValue("--text-color").trim(),
    backgroundColor: getComputedStyle(document.body).getPropertyValue("--background-color").trim(),
    surfaceColor: getComputedStyle(document.body).getPropertyValue("--surface-color").trim(),
    accentColor: getComputedStyle(document.body).getPropertyValue("--accent-color").trim(),
    accentTextColor: getComputedStyle(document.body).getPropertyValue("--accent-text-color").trim(),
    errorColor: getComputedStyle(document.body).getPropertyValue("--error-color").trim(),
  }
}

try {
  themes.forEach((theme) => {
    const value = theme[0];
    const name = theme[1] || theme[0];

    const button = document.createElement("button");
    button.textContent = name;
    button.addEventListener("click", () => {
      selectedTheme = value;
      document.getElementById("theme-preview").setAttribute("data-theme", value);
    });
    document.getElementById("theme-selector")?.append(button);
  });

  if (storage.get("theme") == "custom") {
    // Custom theme
    applyCustomTheme();
    selectedTheme = "";
  } else {
    // Built-in theme
    const theme = storage.get("theme") || "";
    document.body.setAttribute("data-theme", theme);
    document.getElementById("theme-preview")?.setAttribute("data-theme", theme);
    selectedTheme = theme;
    updateAnimatedThemeVideo();
    updateColorizedTheme();
  }
  enableTransitions();

  document.getElementById("theme-apply")?.addEventListener("click", async () => {
    const value = selectedTheme;
    disableTransitions();
    document.body.setAttribute("data-theme", value);
    removeCustomTheme();
    enableTransitions();
    storage.set("theme", value);
    // Update developer theme input
    if (document.getElementById("theme-debug")) document.getElementById("theme-debug").value = value;
    await auth.syncPush("theme")
      .catch(error => {
        if (storage.get("developer")) {
          alert(`Error @ themes.js: ${error.message}`);
        } else {
          ui.reportBugModal(null, String(error.stack));
        }
      });
    await auth.syncPush("custom-theme")
      .catch(error => {
        if (storage.get("developer")) {
          alert(`Error @ themes.js: ${error.message}`);
        } else {
          ui.reportBugModal(null, String(error.stack));
        }
      });
  });

  document.getElementById("theme-reset")?.addEventListener("click", resetTheme);

  // Editor

  updateEditorFields();
  updateEditorPreview();
  updateThemeCode();

  document.getElementById("editor-apply")?.addEventListener("click", async () => {
    storage.set("custom-theme", customTheme);
    storage.set("theme", "custom");
    applyCustomTheme();
    await auth.syncPush("custom-theme")
      .catch(error => {
        if (storage.get("developer")) {
          alert(`Error @ themes.js: ${error.message}`);
        } else {
          ui.reportBugModal(null, String(error.stack));
        }
      });
    await auth.syncPush("theme")
      .catch(error => {
        if (storage.get("developer")) {
          alert(`Error @ themes.js: ${error.message}`);
        } else {
          ui.reportBugModal(null, String(error.stack));
        }
      });
  });

  document.getElementById("editor-reset")?.addEventListener("click", () => {
    Object.assign(customTheme, defaultTheme);
    updateEditorFields();
    updateEditorPreview();
    updateThemeCode();
  });

  document.getElementById("theme-code")?.addEventListener("input", (e) => {
    if (e.target.value?.trim()) {
      const theme = decodeThemeCode(e.target.value);
      theme && updateEditorPreview(theme);
    }
  });

  document.getElementById("theme-code")?.addEventListener("blur", validateThemeCode);
  document.getElementById("theme-code")?.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
      validateThemeCode();
    }
  });

  // Load theme editor
  document.querySelector(`[data-modal-page="editor"]`)?.addEventListener("view", () => {
    Object.assign(customTheme, storage.get("custom-theme") || defaultTheme);
    updateEditorFields();
    updateEditorPreview();
    updateThemeCode();
  });

  if (storage.get("developer")) {
    // Add developer theme input
    document.querySelector(`[data-modal-page="theme"]`)?.append(
      new Element(
        "input",
        null,
        {
          input: (e) => {
            disableTransitions();
            document.getElementById("theme-preview").setAttribute("data-theme", e.target.value);
            document.body.setAttribute("data-theme", e.target.value);
            removeCustomTheme();
            enableTransitions();
            storage.set("theme", e.target.value);
          },
        },
        null,
        {
          id: "theme-debug",
        },
      ).element,
    );
    // Populate field
    if (document.getElementById("theme-debug")) document.getElementById("theme-debug").value = storage.get("theme") || "";
    // Add Copy CSS button
    document.querySelector(`[data-modal-page="editor"]`)?.append(
      new Element("button", "Copy CSS", {
        "click": copyThemeCSS,
      }).element,
    );
  }

  // Seasonal themes

  var seasonalTheme = "";
  var seasonalEmoji = "";
  var seasonalName = "";

  if ((Date.now() < new Date(`${new Date().getFullYear()}-10-31`).getTime()) && (Date.now() > new Date(`${new Date().getFullYear()}-10-23`).getTime())) {
    seasonalName = "Halloween";
    seasonalTheme = "halloween";
    seasonalEmoji = "🎃";
  } else if ((Date.now() < new Date(`${new Date().getFullYear()}-12-25`).getTime()) && (Date.now() > new Date(`${new Date().getFullYear()}-12-01`).getTime())) {
    seasonalName = "Festive";
    seasonalTheme = "festive";
    seasonalEmoji = "🎄";
  }

  if ((seasonalTheme != "") && (seasonalEmoji != "") && (seasonalName != "")) {
    var seasonalThemeButton = document.createElement("button");
    seasonalThemeButton.className = "icon";
    seasonalThemeButton.onclick = function () {
      disableTransitions();
      document.body.setAttribute("data-theme", seasonalTheme);
      enableTransitions();
      storage.set("theme", seasonalTheme);
    };
    seasonalThemeButton.innerHTML = seasonalEmoji;
    seasonalThemeButton.setAttribute("tooltip", `${seasonalName} Theme (Limited Time)`);
    document.getElementById("controls-container")?.appendChild(seasonalThemeButton);
  }

  document.querySelector('[data-modal-view="store"]')?.addEventListener("click", () => {
    ui.view();
  });

  function updateAnimatedThemeVideo() {
    const foundTheme = themes.find(theme => theme[0] === document.body.getAttribute('data-theme'));
    var animatedThemeVideo = document.querySelector('body > video');
    if (foundTheme && foundTheme[6]) {
      if (!animatedThemeVideo) {
        animatedThemeVideo = document.createElement('video');
        animatedThemeVideo.muted = true;
        animatedThemeVideo.autoplay = true;
        animatedThemeVideo.loop = true;
        animatedThemeVideo.disablePictureInPicture = true;
        animatedThemeVideo.controlsList = "nodownload";
        document.body.appendChild(animatedThemeVideo);
      }
      animatedThemeVideo.src = `/store/animated/${foundTheme[0]}.mp4`;
    } else {
      if (animatedThemeVideo) {
        animatedThemeVideo.remove();
        animatedThemeVideo = null;
      }
    }
  }

  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if ((mutation.type === 'attributes') && (mutation.attributeName === 'data-theme')) {
        updateAnimatedThemeVideo();
        updateColorizedTheme();
      }
    }
  });
  observer.observe(document.body, { attributes: true });

  if ((new Date().getMonth() === 9) && (new Date().getDate() === 20)) {
    const lipskys = setInterval(() => {
      const w = [15, 20, 22, 25, 30][Math.floor(Math.random() * 5)];
      const startX = Math.random() * (window.innerWidth - w);
      const duration = 10000 * (window.innerHeight / 1000);

      const fallingLipsky = document.createElement("img");
      fallingLipsky.className = "star";
      fallingLipsky.src = lipsky;
      fallingLipsky.style.width = `${w}px`;
      fallingLipsky.style.position = "fixed";
      fallingLipsky.style.left = `${startX}px`;
      fallingLipsky.style.top = `0px`;
      document.body.append(fallingLipsky);

      fallingLipsky.animate(
        [
          { transform: "translateY(0)" },
          { transform: `translateY(${window.innerHeight + 30}px)` },
        ],
        {
          duration,
          easing: "linear",
        }
      );

      setTimeout(() => fallingLipsky.remove(), duration);

      let mouseX = window.innerWidth / 2;
      let mouseY = window.innerHeight / 2;

      window.addEventListener("pointermove", ev => {
        mouseX = ev.clientX;
        mouseY = ev.clientY;
      });

      const dodgeRadius = 100;
      let currentX = startX;
      const startTime = performance.now();

      function dodgeLoop() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const starY = progress * (window.innerHeight + 30);

        const dx = (currentX + w / 2) - mouseX;
        const dy = starY - mouseY;
        const distance = Math.hypot(dx, dy);

        if (distance < dodgeRadius) {
          const direction = dx >= 0 ? 1 : -1;
          const speed = ((dodgeRadius - distance) / dodgeRadius) * 5;
          currentX = Math.min(
            Math.max(currentX + direction * speed, 0),
            window.innerWidth - w
          );
          fallingLipsky.style.left = `${currentX}px`;
        }

        if (progress < 1) requestAnimationFrame(dodgeLoop);
      }
      requestAnimationFrame(dodgeLoop);
    }, 700);
    const stopLipsky = document.createElement("button");
    stopLipsky.className = "icon";
    stopLipsky.onclick = () => {
      clearInterval(lipskys);
      stopLipsky.remove();
    };
    stopLipsky.innerHTML = '<i class="bi bi-cake2"></i>';
    stopLipsky.setAttribute("tooltip", "Stop Lipskys");
    document.getElementById("controls-container").appendChild(stopLipsky);
  }

  function updateColorizedTheme() {
    const foundTheme = themes.find(theme => theme[0] === document.body.getAttribute('data-theme'));
    if (foundTheme && foundTheme[8]) {
      colorizeTrigger?.removeAttribute('hidden');
      if (storage.get('colorize') !== undefined) {
        setColorize(storage.get('colorize'));
      } else {
        resetColorize();
      }
    } else {
      colorizeTrigger?.setAttribute('hidden', '');
      resetColorize();
    }
  }

  function resetColorize() {
    if (colorizeRange) colorizeRange.value = 0;
    document.body.style.backdropFilter = '';
    document.body.style.setProperty('--text-color', '');
    document.body.style.setProperty('--background-color', '');
    document.body.style.setProperty('--surface-color', '');
    document.body.style.setProperty('--accent-color', '');
    document.body.style.setProperty('--accent-text-color', '');
  }

  function setColorize(deg) {
    if (colorizeRange) colorizeRange.value = deg;
    document.body.style.backdropFilter = `hue-rotate(${deg}deg)`;
    document.body.style.setProperty('--text-color', '');
    document.body.style.setProperty('--background-color', '');
    document.body.style.setProperty('--surface-color', '');
    document.body.style.setProperty('--accent-color', '');
    document.body.style.setProperty('--accent-text-color', '');
    const computedStyle = getComputedStyle(document.body);
    document.body.style.setProperty('--text-color', rotateHue(computedStyle.getPropertyValue("--text-color").trim(), deg));
    document.body.style.setProperty('--background-color', rotateHue(computedStyle.getPropertyValue("--background-color").trim(), deg));
    document.body.style.setProperty('--surface-color', rotateHue(computedStyle.getPropertyValue("--surface-color").trim(), deg));
    document.body.style.setProperty('--accent-color', rotateHue(computedStyle.getPropertyValue("--accent-color").trim(), deg));
    document.body.style.setProperty('--accent-text-color', rotateHue(computedStyle.getPropertyValue("--accent-text-color").trim(), deg));
  }

  function rotateHue(hex, deg) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) throw new Error('Invalid hex color');
    if (hex.length === 4) hex = '#' + [...hex.slice(1)].map(ch => ch + ch).join('');
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;
    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    const delta = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      if (max === rN) {
        h = ((gN - bN) / delta) % 6;
      } else if (max === gN) {
        h = (bN - rN) / delta + 2;
      } else {
        h = (rN - gN) / delta + 4;
      }
      h *= 60;
      if (h < 0) h += 360;
    } else {
      return hex.toLowerCase();
    }
    h = (h + Number(deg)) % 360;
    if (h < 0) h += 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1, g1, b1;
    if (h < 60) {
      [r1, g1, b1] = [c, x, 0];
    } else if (h < 120) {
      [r1, g1, b1] = [x, c, 0];
    } else if (h < 180) {
      [r1, g1, b1] = [0, c, x];
    } else if (h < 240) {
      [r1, g1, b1] = [0, x, c];
    } else if (h < 300) {
      [r1, g1, b1] = [x, 0, c];
    } else {
      [r1, g1, b1] = [c, 0, x];
    }
    const newR = Math.round((r1 + m) * 255);
    const newG = Math.round((g1 + m) * 255);
    const newB = Math.round((b1 + m) * 255);
    const toHex = n => n.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  }

  colorizeRange?.addEventListener('input', (e) => {
    if (!e.target.value) return;
    const deg = parseInt(e.target.value);
    setColorize(deg);
    storage.set('colorize', deg);
  });

  colorizeRange?.addEventListener('change', (e) => {
    if (!e.target.value) return;
    auth.syncPush("colorize")
      .catch(error => {
        if (storage.get("developer")) {
          alert(`Error @ themes.js: ${error.message}`);
        } else {
          ui.reportBugModal(null, String(error.stack));
        }
      });
  });

  document.getElementById("reset-colorize")?.addEventListener("click", () => {
    resetColorize();
    storage.delete('colorize');
    auth.syncPush("colorize")
      .catch(error => {
        if (storage.get("developer")) {
          alert(`Error @ themes.js: ${error.message}`);
        } else {
          ui.reportBugModal(null, String(error.stack));
        }
      });
  });
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ themes.js: ${error.message}`);
  } else {
    ui.reportBugModal(null, String(error.stack));
  }
  throw error;
}