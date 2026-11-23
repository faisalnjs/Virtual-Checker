import Pet, { Biscuit, Whiskers, renderIcon } from "@markwylde/pet";
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as auth from "/src/modules/auth.js";

const pets = [
  { id: "biscuit", name: "Biscuit", character: Biscuit, cost: 100 },
  { id: "whiskers", name: "Whiskers", character: Whiskers, cost: 100 },
];

let activePet;
let idleTimer;
let busyTimer;
let initialized = false;
let size = 0.5;

function ownedPets(cache) {
  return Array.isArray(cache?.ownedPets) ? cache.ownedPets : [];
}

function selectedPet() {
  return pets.find(pet => pet.id === storage.get("pet"));
}

function play(name, loop = false) {
  activePet?.play(name, { loop }).catch(() => null);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (activePet?.animation === "idle3") play("idle1", true);
  idleTimer = setTimeout(() => play("idle3", true), 120000);
}

export async function syncPet() {
  await storage.idbReady;
  if (!storage.get("enablePets")) {
    activePet?.destroy();
    activePet = undefined;
    return;
  }
  const selected = selectedPet();
  const cache = await storage.idbGet("cache");
  if (!selected || !ownedPets(cache).includes(selected.id)) {
    activePet?.destroy();
    activePet = undefined;
    return;
  }
  if (activePet?.character === selected.character) return;
  activePet?.destroy();
  const logoRect = document.querySelector('.virtual-checker-logo').getBoundingClientRect();
  activePet = Pet({
    character: selected.character,
    size,
    dock: () => document.querySelector("[data-pet-store]"),
    persist: `virtual-pet-${selected.id}`,
    hidden: true,
    position: { x: logoRect.x - (((180 * size) - logoRect.width) / 2), y: logoRect.y - ((180 * size) - logoRect.height) },
  });
  activePet.on('move', ({ position }) => {
    const header = document.querySelector('.header');
    const logo = document.querySelector('.virtual-checker-logo');
    const headerRect = header.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    if ((position.x < headerRect.right) && ((position.x + (180 * size)) > headerRect.left) && (position.y < headerRect.bottom) && ((position.y + (180 * size)) > headerRect.top)) activePet.moveTo({
      x: logoRect.x - (((180 * size) - logoRect.width) / 2),
      y: logoRect.y - ((180 * size) - logoRect.height)
    });
  });
  activePet.on('dragstart', () => {
    document.querySelector('.virtual-checker-logo').classList.add('pet-dragging');
  });
  activePet.on('dragend', () => {
    document.querySelector('.virtual-checker-logo').classList.remove('pet-dragging');
  });
  play("idle1", true);
  resetIdleTimer();
}

export function playMood(mood) {
  if (!activePet) return;
  clearTimeout(busyTimer);
  activePet.play(mood).then(finished => {
    if (finished) play("idle1", true);
  }).catch(() => null);
  resetIdleTimer();
}

export async function renderStore() {
  const store = document.getElementById("pet-store");
  if (!store) return;
  await storage.idbReady;
  const cache = (await storage.idbGet("cache")) || {};
  let checks = cache.checksCount || 0;
  let owned = ownedPets(cache);
  store.replaceChildren();
  const checksText = document.createElement("p");
  checksText.className = "checks-text";
  checksText.innerHTML = `<i class="bi bi-check2-circle"></i> You've got ${checks} Check${checks === 1 ? "" : "s"} available to spend!`;
  store.append(checksText);
  const enablePetsCheckboxGroup = document.createElement("label");
  enablePetsCheckboxGroup.className = "checkboxGroup";
  enablePetsCheckboxGroup.innerHTML = `<input type="checkbox" id="enable-pets-checkbox" hidden ${storage.get("enablePets") ?? true ? "checked" : ""}><div class="checkbox"></div> Enable Pets`;
  const enablePetsCheckboxInput = enablePetsCheckboxGroup.querySelector("input");
  enablePetsCheckboxInput.addEventListener("change", async () => {
    storage.set("enablePets", enablePetsCheckboxInput.checked);
    await auth.syncPush("enablePets");
    if (!enablePetsCheckboxInput.checked) {
      await activePet?.hide();
      activePet?.destroy();
      activePet = undefined;
    } else {
      await syncPet();
    }
  });
  store.append(enablePetsCheckboxGroup);
  const grid = document.createElement("div");
  grid.className = "pets-grid";
  for (const pet of pets) {
    const item = document.createElement("div");
    item.className = "pet-item";
    item.innerHTML = `${renderIcon(pet.character, { title: pet.name })}<h5>${pet.name}</h5><p>${pet.cost} Checks</p>`;
    const button = document.createElement("button");
    const refresh = () => {
      button.textContent = (storage.get("pet") === pet.id) ? "Active" : (owned.includes(pet.id) ? "Use Pet" : `Purchase for ${pet.cost} Checks`);
    };
    button.addEventListener("click", async () => {
      if (owned.includes(pet.id)) {
        storage.set("pet", pet.id);
        await auth.syncPush("pet");
        await syncPet();
        renderStore();
        return;
      }
      if (checks < pet.cost) {
        ui.toast(`Insufficient Checks to purchase ${pet.name}.`, 2000, "error", "bi bi-exclamation-triangle-fill");
        return;
      }
      ui.modal({
        title: `Purchase ${pet.name}`,
        body: `<p>Purchase ${pet.name} for ${pet.cost} Checks? You will have ${checks - pet.cost} Check${(checks - pet.cost) === 1 ? "" : "s"} remaining.</p>`,
        buttons: [
          {
            text: "Cancel",
            icon: "bi-x-lg",
            class: "cancel-button",
            close: true
          },
          {
            text: "Purchase",
            icon: "bi-bag-check-fill",
            class: "submit-button",
            close: true,
            onclick: async () => {
              const result = await auth.buyPet(pet.id, pet.cost);
              if (!result) return;
              cache.ownedPets = result.ownedPets;
              cache.checksCount = result.checksCount;
              await storage.idbSet("cache", cache);
              document.querySelector(".controls-container, #controls-container")?.setAttribute("checks", cache.checksCount);
              owned = cache.ownedPets;
              checks = cache.checksCount;
              storage.set("pet", pet.id);
              await auth.syncPush("pet");
              await syncPet();
              ui.toast(`${pet.name} is now your pet.`, 2000, "success", "bi bi-bag-check-fill");
              renderStore();
            },
          },
        ],
      });
    });
    refresh();
    item.append(button);
    grid.append(item);
  }
  store.append(grid);
}

export function initializePets() {
  if (initialized) return;
  initialized = true;
  document.querySelector("[data-pet-store]")?.addEventListener("click", async () => {
    await renderStore();
    ui.view("pets");
  });
  document.addEventListener("mousemove", resetIdleTimer, { passive: true });
  document.addEventListener("input", event => {
    if (!event.target.matches("input, textarea, math-field, [contenteditable=true]")) return;
    clearTimeout(busyTimer);
    play(`busy${Math.floor(Math.random() * 3) + 1}`, true);
    busyTimer = setTimeout(() => {
      play("idle1", true);
      resetIdleTimer();
    }, 800);
  });
  window.addEventListener("virtual-bulk-load", syncPet);
  syncPet();
}
