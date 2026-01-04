import "./ui.css";
import storage from "./storage.js";
import * as themes from "../themes/themes.js"
import * as auth from "./auth.js"
import Element from "./element.js";

export function alert(title, text, callback, blur) {
  return modal({
    title,
    body: new Element("p", text).element.outerHTML,
    buttons: [
      {
        text: "Close",
        close: true,
        onclick: callback,
      },
    ],
    blur,
  });
}

export function prompt(title, text, buttons, blur) {
  return modal({
    title,
    body: new Element("p", text).element.outerHTML,
    buttons,
    blur,
  });
}

export function modal(options) {
  const dialog = document.createElement("dialog");

  if (options.required) dialog.setAttribute('closedby', 'none');

  if (options.title) {
    const title = document.createElement("h2");
    title.innerText = options.title;
    dialog.append(title);
  }

  if (options.body) {
    dialog.innerHTML += options.body;
  }

  if (options.input) {
    if (options.input.label) {
      const label = document.createElement("label");
      label.innerHTML = options.input.label;
      dialog.appendChild(label);
    }
    const input = document.createElement((options.input.type === "select") ? "select" : ((options.input.type === "textarea") ? "textarea" : "input"));
    if (options.input.type !== "select") input.type = options.input.type || "text";
    if ((options.input.type === "select") && options.input.multiple) input.multiple = options.input.multiple;
    if ((options.input.type === "select") && options.input.options) {
      options.input.options.forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        if (option.selected) optionElement.selected = true;
        input.appendChild(optionElement);
      });
    }
    if (options.input.type === "textarea") input.rows = options.input.rows || 3;
    input.placeholder = options.input.placeholder || "";
    if (options.input.defaultValue) input.value = options.input.defaultValue || "";
    if (options.input.disabled) input.disabled = true;
    input.className = `dialog-input${options.input.selectAll ? " selectAll" : ""}`;
    input.min = options.input.min || "";
    input.max = options.input.max || "";
    if (options.input.required) input.required = options.input.required;
    if (options.input.innerHTML) input.innerHTML = options.input.innerHTML;
    dialog.appendChild(input);
  }

  if (options.inputs) {
    options.inputs.forEach(input => {
      if (input.label) {
        const label = document.createElement("label");
        label.innerHTML = input.label;
        dialog.appendChild(label);
      }
      const inputElement = document.createElement((input.type === "select") ? "select" : ((input.type === "textarea") ? "textarea" : "input"));
      if (input.type === "input") inputElement.type = input.type || "text";
      if ((input.type === "select") && input.multiple) inputElement.multiple = input.multiple;
      if ((input.type === "select") && input.options) {
        input.options.forEach(option => {
          const optionElement = document.createElement("option");
          optionElement.value = option.value;
          optionElement.textContent = option.text;
          if (option.selected) optionElement.selected = true;
          inputElement.appendChild(optionElement);
        });
      }
      if (input.type === "textarea") inputElement.rows = input.rows || 3;
      inputElement.placeholder = input.placeholder || "";
      if (input.defaultValue) inputElement.value = input.defaultValue || "";
      if (input.disabled) inputElement.disabled = true;
      inputElement.className = `dialog-input${input.selectAll ? " selectAll" : ""}`;
      inputElement.min = input.min || "";
      inputElement.max = input.max || "";
      if (input.required) inputElement.required = input.required;
      if (input.innerHTML) inputElement.innerHTML = input.innerHTML;
      dialog.appendChild(inputElement);
    });
  }

  document.body.append(dialog);

  if (options.input?.selectAll || options.inputs?.find(input => input.selectAll)) dialog.querySelector(".dialog-input.selectAll")?.select();

  if (options.buttonGroups && options.buttonGroups.length > 0) {
    options.buttonGroups.forEach(buttonGroup => {
      var buttonGroupsContainerElement = document.createElement("div");
      if (buttonGroup.label) {
        var buttonGroupLabelElement = document.createElement("label");
        if (buttonGroup.icon) buttonGroup.label = `<i class="bi ${buttonGroup.icon}"></i> ${buttonGroup.label}`;
        buttonGroupLabelElement.innerHTML = buttonGroup.label;
        dialog.appendChild(buttonGroupLabelElement);
      }
      var buttonGroupContainerElement = document.createElement("div");
      buttonGroupContainerElement.className = "button-grid";
      buttonGroup.buttons.forEach(button => {
        var btnElement = new Element("button", `${button.icon ? `<i class="bi ${button.icon}"></i> ` : ''}${button.text}`, {
          click: () => {
            if (button.onclick) {
              var hasEmptyRequiredInput = false;
              dialog.querySelectorAll(".dialog-input").forEach(dialogInput => {
                if (dialogInput.required && !dialogInput.value) {
                  dialogInput.classList.add("attention");
                  if (!hasEmptyRequiredInput) dialogInput.focus();
                  hasEmptyRequiredInput = true;
                } else {
                  dialogInput.classList.remove("attention");
                }
              });
              if (hasEmptyRequiredInput) return;
              const inputValue = (dialog.querySelectorAll(".dialog-input").length > 1) ? [...dialog.querySelectorAll(".dialog-input")].map(dialogInput => {
                return dialogInput.multiple ? [...dialogInput.selectedOptions].map(e => Number(e.value)) : dialogInput.value;
              }) : (dialog.querySelector(".dialog-input") ? dialog.querySelector(".dialog-input").value : null);
              button.onclick(inputValue);
            }
            if (button.close) {
              closeModal();
            }
          },
        }, button.class).element;
        btnElement.style.width = "-webkit-fill-available";
        buttonGroupContainerElement.appendChild(btnElement);
      });
      buttonGroupsContainerElement.appendChild(buttonGroupContainerElement);
      dialog.appendChild(buttonGroupsContainerElement);
    });
  }

  if (options.buttons && options.buttons.length > 0) {
    var buttonsContainerElement = document.createElement("div");
    buttonsContainerElement.className = "button-grid";
    options.buttons.forEach(button => {
      var btnElement = new Element("button", `${button.icon ? `<i class="bi ${button.icon}"></i> ` : ''}${button.text}`, {
        click: () => {
          if (button.onclick) {
            var hasEmptyRequiredInput = false;
            dialog.querySelectorAll(".dialog-input").forEach(dialogInput => {
              if (dialogInput.required && !dialogInput.value) {
                dialogInput.classList.add("attention");
                if (!hasEmptyRequiredInput) dialogInput.focus();
                hasEmptyRequiredInput = true;
              } else {
                dialogInput.classList.remove("attention");
              }
            });
            if (hasEmptyRequiredInput) return;
            const inputValue = (dialog.querySelectorAll(".dialog-input").length > 1) ? [...dialog.querySelectorAll(".dialog-input")].map(dialogInput => {
              return dialogInput.multiple ? [...dialogInput.selectedOptions].map(e => Number(e.value)) : dialogInput.value;
            }) : (dialog.querySelector(".dialog-input") ? dialog.querySelector(".dialog-input").value : null);
            button.onclick(inputValue);
          }
          if (button.close) {
            closeModal();
          }
        },
      }, button.class).element;
      btnElement.style.width = "-webkit-fill-available";
      buttonsContainerElement.appendChild(btnElement);
    });
    dialog.appendChild(buttonsContainerElement);
  }

  animate(
    dialog,
    {
      scale: "0.9",
      opacity: "0",
    },
    {
      scale: "1",
      opacity: "1",
    },
    250,
  );

  dialog.showModal();

  dialog.addEventListener("close", () => {
    animate(
      dialog,
      {
        scale: "1",
        opacity: "1",
      },
      {
        scale: "0.9",
        opacity: "0",
      },
      250,
    );
    setTimeout(() => {
      dialog.remove();
    }, 250);
  });

  if (!options.required) {
    document.addEventListener("pointerdown", (e) => {
      if (!dialog.contains(e.target)) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    });
  }

  function closeModal() {
    animate(
      dialog,
      {
        scale: "1",
        opacity: "1",
      },
      {
        scale: "0.9",
        opacity: "0",
      },
      250,
    );
    setTimeout(() => {
      dialog.close();
    }, 250);
  }

  return dialog;
}

export function show(dialog, title, buttons, actions, blur, effects = true) {
  // Create modal menu bar
  const menu =
    dialog.querySelector("[data-modal-menu]") ||
    (() => {
      const div = document.createElement("div");
      div.setAttribute("data-modal-menu", "");
      // Create title element
      const titleEl = new Element("h2", title, null, null, {
        "data-modal-title": true,
      }).element;
      div.append(titleEl);
      // Add menu bar to dialog
      dialog.prepend(div);
      return div;
    })();

  // Update title
  menu.querySelector("[data-modal-title]").textContent = title;

  // Remove existing buttons
  menu.querySelector("[data-modal-buttons]")?.remove();
  // Create modal buttons
  if (buttons?.length > 0) {
    const container = document.createElement("div");
    container.setAttribute("data-modal-buttons", "");
    menu.append(container);
    // Populate buttons
    buttons.forEach((button) => {
      container.append(
        new Element(
          "button",
          button.text,
          {
            click: () => {
              button.close && close();
              button.onclick && button.onclick();
            },
          },
          button.class,
        ).element,
      );
    });
  }

  // Remove existing actions
  menu.querySelector("[data-modal-actions]")?.remove();
  // Create modal buttons
  if (actions?.length > 0) {
    const container = document.createElement("div");
    container.setAttribute("data-modal-actions", "");
    dialog.append(container);
    // Populate buttons
    actions.forEach((button) => {
      container.append(
        new Element(
          "button",
          button.text,
          {
            click: () => {
              button.close && close();
              button.onclick && button.onclick();
            },
          },
          button.class,
        ).element,
      );
    });
  }

  dialog.showModal();

  effects &&
    animate(
      dialog,
      {
        scale: "0.9",
        opacity: "0",
      },
      {
        scale: "1",
        opacity: "1",
      },
      250,
    );
  if (effects) {
    setTimeout(() => {
      dialog.setAttribute("data-open", "");
    }, 250);
  } else {
    dialog.setAttribute("data-open", "");
  }

  dialog.querySelector('input')?.select();

  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });

  dialog.addEventListener("triggerclose", close, { once: true });

  function close() {
    dialog.removeAttribute("data-open");
    if (effects) {
      animate(
        dialog,
        undefined,
        {
          scale: "0.9",
          opacity: "0",
        },
        250,
      );
      setTimeout(() => {
        dialog.close();
      }, 250);
    } else {
      dialog.close();
    }
  }

  blur && menu.querySelectorAll("[data-modal-buttons]>button").forEach((button) => button.blur());
}

export function view(path = "") {
  if (!path) {
    const event = new Event("triggerclose");
    document.querySelector("dialog[open]")?.dispatchEvent(event);
    return;
  }
  const pages = path.split("/");
  const target = document.querySelector(`[data-modal-page="${pages[pages.length - 1]}"]`);
  if (!target) return;
  const title = target.getAttribute("data-page-title") || path;
  for (let i = 0; i < pages.length; i++) {
    const query = pages
      .slice(0, i + 1)
      .map((item) => `[data-modal-page="${item}"]`)
      .join(">");
    document
      .querySelectorAll(
        `${query}>:not([data-modal-menu], [data-modal-title], [data-modal-buttons], .tooltip)`,
      )
      .forEach((element) => {
        const page = element.getAttribute("data-modal-page");
        if (page == pages[i + 1]) {
          element.style.removeProperty("display");
        } else {
          element.style.display = "none";
        }
      });
  }
  const previous = pages.slice(0, pages.length - 1).join("/");
  const buttons = ((path === 'api-fail') || (path === 'no-course') || (path === 'maintenance-mode')) ? [] : [
    {
      text: `<i class="bi bi-x-lg"></i>`,
      class: "icon",
      close: true,
    },
  ];
  if (previous) {
    buttons.unshift({
      text: `<i class="bi bi-chevron-left"></i>`,
      class: "icon",
      close: false,
      onclick: () => {
        const dialog = document.querySelector(`[data-modal-page="${pages[0]}"]`);
        dialog.removeAttribute("data-open");
        view(previous);
      },
    });
  }
  show(document.querySelector(`[data-modal-page="${pages[0]}"]`), title, buttons);
  if ((path === 'api-fail') || (path === 'no-course') || (path === 'maintenance-mode')) startLoader();
  const event = new Event("view");
  target.dispatchEvent(event);
}

export function modeless(icon, message, description = null) {
  document.querySelector("div.modeless")?.remove();
  const element = document.createElement("div");
  const keyframes = [{ opacity: 0 }, { opacity: 1 }];
  element.className = "modeless";
  element.append(new Element("h2", icon).element, new Element("p", message).element);
  if (description) {
    element.append(new Element("p", description).element);
  }
  element.animate(keyframes, {
    duration: 100,
    fill: "forwards",
  });
  setTimeout(() => {
    element.animate(keyframes, {
      duration: 100,
      direction: "reverse",
      fill: "forwards",
    });
    setTimeout(() => {
      element.remove();
    }, 100);
  }, description ? 5000 : 2400);
  document.body.append(element);
}

export function addTooltip(element, text) {
  const tooltip = document.createElement("p");
  tooltip.textContent = text;
  tooltip.style.opacity = "0";
  tooltip.style.position = "absolute";
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  tooltip.classList.add("tooltip");

  const parent = element.closest("dialog") || document.body;
  parent.append(tooltip);

  element.addEventListener("pointerenter", () => {
    tooltip.style.left = element.offsetLeft + element.offsetWidth / 2 + "px";
    tooltip.style.top = element.offsetTop + "px";
    animate(
      tooltip,
      {
        translate: "-50% -90%",
        opacity: "0",
      },
      {
        translate: "-50% calc(-100% - 0.5rem)",
        opacity: "1",
      },
      250,
    );
  });

  element.addEventListener("pointerleave", () => {
    animate(
      tooltip,
      undefined,
      {
        translate: "-50% -90%",
        opacity: "0",
      },
      250,
    );
    setTimeout(() => {
      tooltip.style.left = "0px";
      tooltip.style.top = "0px";
    }, 250);
  });
}

// From kennyhui.dev
export function animate(element, from, to, duration, assign = true) {
  const animation = element.animate([from && from, to && to], {
    duration,
    easing: "cubic-bezier(0.65, 0, 0.35, 1)",
    fill: "forwards",
  });
  setTimeout(() => {
    animation.cancel();
    assign && Object.assign(element.style, to);
  }, duration);
}

// Click outside modal
(() => {
  document.addEventListener("pointerdown", (e) => {
    const dialog = document.querySelector("dialog[open]");
    if (dialog && (dialog.getAttribute('data-modal-page') !== 'api-fail') && (dialog.getAttribute('data-modal-page') !== 'maintenance-mode') && dialog.hasAttribute("data-open") && !dialog.contains(e.target)) {
      document.addEventListener(
        "pointerup",
        () => {
          const event = new Event("triggerclose");
          dialog.dispatchEvent(event);
        },
        { once: true },
      );
    }
  });
})();

document.querySelectorAll("[data-modal-view]").forEach((element) => {
  element.addEventListener("click", () => {
    const path = element.getAttribute("data-modal-view");
    view(path);
  });
});

document.querySelectorAll("[data-color-input]").forEach((element) => {
  if (element.querySelector('input')) return;
  const name = element.getAttribute("data-color-input");
  // Create child elements
  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.name = name;
  colorPicker.tabIndex = "-1";
  const colorPreview = document.createElement("div");
  colorPreview.setAttribute("data-color-preview", "");
  colorPreview.tabIndex = "0";
  colorPreview.role = "button";
  const colorCode = document.createElement("input");
  colorCode.type = "text";

  colorPicker.addEventListener("input", update);
  colorCode.addEventListener("blur", validate);
  colorCode.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
      validate();
    }
  });
  colorPreview.addEventListener("click", () => {
    colorPicker.focus();
  });
  colorPreview.addEventListener("keydown", (e) => {
    if (e.key == " " || e.key == "Enter") {
      e.preventDefault();
      colorPicker.focus();
    }
  });
  colorPicker.addEventListener("update", update);

  element.append(colorPicker, colorPreview, colorCode);
  update();

  function validate() {
    const value = colorCode.value;
    const valid = /^#[0-9a-fA-F]{6}$/.test(value);
    if (valid) {
      colorPicker.value = value;
    } else {
      colorCode.value = colorPicker.value;
    }
    update();
  }

  function update() {
    colorCode.value = colorPicker.value;
    colorPreview.style.backgroundColor = colorPicker.value;
  }

  themes.initializeThemeEditor();
});

document.querySelectorAll("[data-button-select]").forEach((element) => {
  element.querySelectorAll("button").forEach((button) => {
    if (!button.hasAttribute("aria-selected")) {
      button.setAttribute("aria-selected", false);
    }
    button.addEventListener("click", () => {
      // Deselect all selected elements
      element.querySelectorAll(`button[aria-selected="true"]`).forEach((el) => {
        el.setAttribute("aria-selected", false);
      });
      // Select target element
      button.setAttribute("aria-selected", true);
      // Dispatch event
      const value = button.getAttribute("data-value");
      const event = new CustomEvent("input", { detail: value });
      element.dispatchEvent(event);
    });
  });
});

export function getButtonSelectValue(element) {
  if (element.hasAttribute("data-button-select")) {
    return element.querySelector(`button[aria-selected="true"]`).getAttribute("data-value");
  }
}

export function setButtonSelectValue(element, value) {
  if (element.hasAttribute("data-button-select")) {
    // Deselect all selected elements
    element.querySelectorAll(`button[aria-selected="true"]`).forEach((el) => {
      el.setAttribute("aria-selected", false);
    });
    // Select target element
    element.querySelector(`button[data-value="${value}"]`).setAttribute("aria-selected", true);
  }
}

export function toast(message, duration = 3000, type = "info", icon = null) {
  const toastContainer = document.querySelector(".toast-container") || createToastContainer();
  const toastElement = new Element("div", message, null, `toast ${type}`).element;
  if (icon) {
    const iconElement = document.createElement("i");
    iconElement.className = icon;
    toastElement.prepend(iconElement);
  }
  const progressBar = document.createElement("div");
  progressBar.className = "toast-progress-bar";
  toastElement.appendChild(progressBar);
  toastContainer.appendChild(toastElement);
  animate(toastElement, { transform: "translateX(100%)", opacity: "0" }, { transform: "translateX(0)", opacity: "1" }, 250);
  progressBar.style.transition = `width ${duration}ms linear`;
  setTimeout(() => {
    progressBar.style.width = "100%";
  }, 10);
  setTimeout(() => {
    animate(toastElement, { transform: "translateX(0)", opacity: "1" }, { transform: "translateX(100%)", opacity: "0" }, 250);
    setTimeout(() => {
      toastElement.remove();
    }, 250);
  }, duration);
  function createToastContainer() {
    const container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
  }
}

export function clearToasts() {
  const toastContainer = document.querySelector(".toast-container");
  if (toastContainer) toastContainer.innerHTML = "";
}

export function startLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.classList.add("active");
}

export function stopLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.classList.remove("active");
}

export var unsavedChanges = false;

export function reloadUnsavedInputs() {
  document.querySelectorAll('textarea').forEach(input => input.addEventListener('input', () => {
    unsavedChanges = true;
  }, { capture: true }));
  document.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
    unsavedChanges = true;
  }, { capture: true }));
  document.querySelectorAll('select').forEach(input => input.addEventListener('change', () => {
    unsavedChanges = true;
  }, { capture: true }));
}

export function setUnsavedChanges(value) {
  unsavedChanges = value;
}

export function expandMatrix(matrixString) {
  const dialog = document.createElement("dialog");

  const title = document.createElement("h2");
  title.innerText = "Matrix";
  dialog.append(title);

  var matrix = JSON.parse(matrixString);

  var constructedMatrix = document.createElement("div");
  constructedMatrix.className = "matrix";

  var highestComputedCellHeight = 0;
  var longestComputedCellWidth = 0;

  matrix.forEach(row => {
    var rowElement = document.createElement("div");
    rowElement.className = "matrix-row";
    row.forEach(cell => {
      var cellElement = document.createElement("span");
      cellElement.className = "matrix-cell";
      cellElement.textContent = cell;
      rowElement.appendChild(cellElement);
    });
    constructedMatrix.appendChild(rowElement);
  });

  dialog.appendChild(constructedMatrix);

  document.body.append(dialog);

  requestAnimationFrame(() => {
    constructedMatrix.querySelectorAll(".matrix-cell").forEach(cell => {
      const cellHeight = cell.offsetHeight;
      const cellWidth = cell.offsetWidth;
      if (cellHeight > highestComputedCellHeight) highestComputedCellHeight = cellHeight;
      if (cellWidth > longestComputedCellWidth) longestComputedCellWidth = cellWidth;
    });

    constructedMatrix.style.setProperty("--matrix-cell-height", `${highestComputedCellHeight}px`);
    constructedMatrix.style.setProperty("--matrix-cell-width", `${longestComputedCellWidth}px`);
  });

  animate(
    dialog,
    {
      scale: "0.9",
      opacity: "0",
    },
    {
      scale: "1",
      opacity: "1",
    },
    250,
  );

  dialog.showModal();

  dialog.addEventListener("close", () => {
    animate(
      dialog,
      {
        scale: "1",
        opacity: "1",
      },
      {
        scale: "0.9",
        opacity: "0",
      },
      250,
    );
    setTimeout(() => {
      dialog.remove();
    }, 250);
  });

  document.addEventListener("pointerdown", (e) => {
    if (!dialog.contains(e.target)) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  function closeModal() {
    animate(
      dialog,
      {
        scale: "1",
        opacity: "1",
      },
      {
        scale: "0.9",
        opacity: "0",
      },
      250,
    );
    setTimeout(() => {
      dialog.close();
    }, 250);
  }

  return dialog;
}

export var defaultCourse = null;

export function setDefaultCourse(value) {
  defaultCourse = value;
}

var welcomeTimeouts = [];
var welcomeContainer = null;
var originalTheme = storage.get("theme");

document.querySelectorAll('[data-welcome]').forEach(a => a.addEventListener('click', launchWelcome));

export async function launchWelcome(returnFunction = null) {
  view();
  if (welcomeContainer) welcomeContainer.remove();
  if (welcomeTimeouts.length) clearWelcomeTimeouts();
  welcomeContainer = document.createElement('div');
  welcomeContainer.classList = 'welcome-container';
  welcomeContainer.setAttribute('data-theme', 'stealth');
  welcomeContainer.innerHTML = `
    <div class="center" step="1">
      <h4>Welcome to</h4>
      <h1>Virtual Checker</h1>
      <button data-skip>Skip Intro</button>
    </div>
    <div step="2">
      <h4>Log in</h4>
      <img src="../intro-step-2.gif" />
    </div>
    <div step="3">
      <h4>Select segment and question</h4>
      <img src="../intro-step-3.gif" />
    </div>
    <div step="4">
      <h4>Switch your answer mode</h4>
      <img src="../intro-step-4.gif" />
    </div>
    <div step="5">
      <h4>Flag your response for review</h4>
      <img src="../intro-step-5.gif" />
    </div>
    <div step="6">
      <h4>See past attempts</h4>
      <img src="../intro-step-6.png" />
    </div>
    <div step="7">
      <h4>Submit before the due date</h4>
      <img src="../intro-step-7.png" />
    </div>
    <div step="8">
      <h4>Complete segments</h4>
      <img src="../intro-step-8.png" />
    </div>
    <div step="9">
      <h4>Achieve mastery</h4>
      <img src="../intro-step-9.png" />
    </div>
    <div class="center" step="10">
      <h4>Choose a layout</h4>
      <div class="layout-chooser">
        <div id="theme-preview">
          <div class="column">
            <h2 class="text-placeholder">000</h2>
            <p class="text-placeholder">Question</p>
            <div class="control-placeholder"></div>
            <div class="control-placeholder"></div>
          </div>
          <div class="column">
            <p class="text-placeholder">Answer</p>
            <div class="control-placeholder"></div>
            <div class="control-placeholder pill"></div>
          </div>
        </div>
        <div id="theme-preview" class="horizontal">
          <div class="column">
            <h2 class="text-placeholder">000</h2>
            <p class="text-placeholder">Question</p>
            <div class="control-placeholder"></div>
            <div class="control-placeholder"></div>
          </div>
          <div class="column">
            <p class="text-placeholder">Answer</p>
            <div class="control-placeholder"></div>
            <div class="control-placeholder pill"></div>
          </div>
        </div>
      </div>
      <button data-next>Next</button>
    </div>
    <div class="center" step="11">
      <h4>Choose a theme</h4>
      <div id="theme-preview">
        <h2 class="text-placeholder">000</h2>
        <p class="text-placeholder">Question</p>
        <div class="control-placeholder"></div>
        <div class="control-placeholder"></div>
        <p class="text-placeholder">Answer</p>
        <div class="control-placeholder"></div>
        <div class="control-placeholder pill"></div>
      </div>
      <div class="themes-grid"></div>
      <button data-finish>Finish & Save</button>
    </div>
    <button data-skip>Skip Intro</button>
    <p>Use arrow keys (<, >) to manually navigate</p>
  `;
  document.body.appendChild(welcomeContainer);
  welcomeContainer.querySelectorAll('[data-skip]').forEach(a => a.addEventListener('click', () => {
    removeWelcome();
    if (returnFunction) returnFunction();
  }));
  welcomeContainer.querySelectorAll('[data-next]').forEach(a => a.addEventListener('click', () => {
    toWelcomeSlide(Number(welcomeContainer.getAttribute('step')) + 1);
  }));
  welcomeContainer.querySelector('[data-finish]').addEventListener('click', async () => {
    await auth.syncPush("theme");
    unsavedChanges = false;
    removeWelcome();
    if (returnFunction) returnFunction();
  });
  welcomeContainer.querySelectorAll('#theme-preview').forEach(a => a.addEventListener('click', () => {
    setLayout(a.classList.toString().replaceAll('selected', '').trim());
    welcomeContainer.querySelectorAll('#theme-preview').forEach(b => b.classList.remove('selected'));
    a.classList.add('selected');
  }));
  originalTheme = storage.get("theme");
  welcomeTimeouts[0] = setTimeout(() => {
    welcomeContainer.classList.add('active');
    welcomeTimeouts[1] = setTimeout(() => {
      toWelcomeSlide(1);
      welcomeTimeouts[2] = setTimeout(() => {
        toWelcomeSlide(2);
        welcomeTimeouts[3] = setTimeout(() => {
          toWelcomeSlide(3);
          welcomeTimeouts[4] = setTimeout(() => {
            toWelcomeSlide(4);
            welcomeTimeouts[5] = setTimeout(() => {
              toWelcomeSlide(5);
              welcomeTimeouts[6] = setTimeout(() => {
                toWelcomeSlide(6);
                welcomeTimeouts[7] = setTimeout(() => {
                  toWelcomeSlide(7);
                  welcomeTimeouts[8] = setTimeout(() => {
                    toWelcomeSlide(8);
                    welcomeTimeouts[9] = setTimeout(() => {
                      toWelcomeSlide(9);
                      welcomeTimeouts[10] = setTimeout(() => {
                        toWelcomeSlide(10);
                      }, 3000);
                    }, 3000);
                  }, 3000);
                }, 3000);
              }, 16000);
            }, 8000);
          }, 7000);
        }, 16000);
      }, 3000);
    }, 500);
  }, 500);
}

export function clearWelcomeTimeouts() {
  welcomeTimeouts.forEach(timeout => clearTimeout(timeout));
  welcomeTimeouts = [];
}

export function toWelcomeSlide(n) {
  if (!welcomeContainer) return;
  const step = welcomeContainer.querySelector(`[step="${n}"]`);
  if (!step) return;
  welcomeContainer.setAttribute('step', n);
  var maxN = welcomeContainer.querySelectorAll('[step]').length;
  switch (n) {
    case maxN - 1:
      [...welcomeContainer.querySelectorAll('#theme-preview')].find(a => document.getElementById('checker')?.classList.toString() ? a.classList.contains(document.getElementById('checker')?.classList.toString()) : true)?.classList.add('selected');
      break;
    case maxN:
      themes.renderThemesGrid(originalTheme || "stealth");
      if (originalTheme) welcomeContainer.setAttribute('data-theme', originalTheme);
      break;
  }
  if (n !== maxN) welcomeContainer.setAttribute('data-theme', 'stealth');
  if (step.querySelector('img')) step.querySelector('img').src = step.querySelector('img').src;
}

export function removeWelcome() {
  welcomeContainer.removeAttribute('step');
  setTimeout(() => {
    welcomeContainer.classList.remove('active');
    clearWelcomeTimeouts();
    stopLoader();
    setTimeout(() => {
      welcomeContainer.remove();
      welcomeContainer = null;
    }, 1000);
  }, 500);
}

function setLayout(layout) {
  const checker = document.getElementById('checker');
  if (!checker) return;
  checker.classList = layout;
  storage.set('layout', layout);
  auth.syncPush('layout');
}

var notifications = [];

export function getNotifications() {
  return notifications;
}

export async function setNotifications(array) {
  notifications = array;
  if (notifications.length > 0) {
    document.querySelector('[data-modal-view="history"]')?.classList.add('unread');
    document.querySelector('[data-modal-view="history"]')?.setAttribute('tooltip', `History (${notifications.length} unread)`);
  } else {
    document.querySelector('[data-modal-view="history"]')?.classList.remove('unread');
    document.querySelector('[data-modal-view="history"]')?.setAttribute('tooltip', 'History');
  }
}

document.querySelectorAll('[data-report-bug]').forEach(a => a.addEventListener('click', reportBugModal));

export function reportBugModal(event = null, report = null) {
  if (report) toast('A bug was detected, please report it.', 10000, 'error', 'bi bi-bug-fill');
  view();
  modal({
    title: 'Report Bug',
    body: '<p>Report a bug with the Virtual Checker or internal APIs.</p>',
    inputs: [
      {
        type: 'select',
        label: 'Issue with',
        options: [
          { value: 'Virtual Checker', text: 'Virtual Checker' },
          { value: 'Homework Checker (API)', text: 'API' },
        ],
        required: true,
        disabled: report,
      },
      {
        type: 'textarea',
        label: 'Description',
        placeholder: 'Describe the issue you encountered...',
        required: true,
        selectAll: !report,
        disabled: report,
        defaultValue: report || '',
      }
    ],
    buttons: [
      {
        text: 'Cancel',
        icon: 'bi-x-lg',
        class: 'cancel-button',
        close: true,
      },
      {
        text: 'Submit',
        icon: 'bi-bug-fill',
        class: 'submit-button',
        onclick: (inputValues) => {
          try {
            const fields = {
              "entry.470737118": storage.get("code"),
              "entry.888169052": inputValues[0],
              "entry.689497704": `${report ? '000' : storage.get("code")}:${inputValues[1]}`,
            };
            const params = new URLSearchParams(fields).toString();
            const url = "https://docsd.google.com/forms/d/e/1FAIpQLSdOO9-Y7IG-djY1MVFpr1qR5-vXw6asU--e61w9atFaRVOpNw/formResponse?";
            const bugReport = fetch(url + params, {
              method: "POST",
              mode: "no-cors",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            });
            if (bugReport.ok) {
              toast('Bug report submitted successfully. Thank you!', 5000, 'success', 'bi bi-check-circle-fill');
            } else {
              toast('Failed to submit bug report. Please try again later.', 5000, 'error', 'bi bi-x-circle-fill');
            }
          } catch (e) {
            toast('Failed to submit bug report. Please try again later.', 5000, 'error', 'bi bi-x-circle-fill');
          }
        },
        close: true,
      },
    ],
  });
}

document.querySelectorAll('[data-suggestions]').forEach(a => a.addEventListener('click', suggestionsModal));

export function suggestionsModal() {
  view();
  modal({
    title: 'Make Suggestion',
    body: '<p>Make a suggestion for the Virtual Checker or internal APIs.</p>',
    inputs: [
      {
        type: 'select',
        label: 'Suggestion for',
        options: [
          { value: 'Virtual Checker', text: 'Virtual Checker' },
          { value: 'Homework Checker (API)', text: 'API' },
        ],
        required: true,
      },
      {
        type: 'textarea',
        label: 'Suggestion',
        placeholder: 'What feature would you like to see added or improved?',
        required: true,
        selectAll: true,
      }
    ],
    buttons: [
      {
        text: 'Cancel',
        icon: 'bi-x-lg',
        class: 'cancel-button',
        close: true,
      },
      {
        text: 'Submit',
        icon: 'bi-chat-left-quote-fill',
        class: 'submit-button',
        onclick: (inputValues) => {
          try {
            const fields = {
              "entry.470737118": storage.get("code"),
              "entry.888169052": inputValues[0],
              "entry.689497704": `${storage.get("code")}:${inputValues[1]}`,
            };
            const params = new URLSearchParams(fields).toString();
            const url = "https://docs.google.com/forms/d/e/1FAIpQLSf5hoON2TQWxpzb1wMjW4EY2BbDtM-KLe-B7kUJj4FM6aExDw/formResponse?";
            const suggestion = fetch(url + params, {
              method: "POST",
              mode: "no-cors",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            });
            if (suggestion.ok) {
              toast('Suggestion submitted successfully!', 5000, 'success', 'bi bi-check-circle-fill');
            } else {
              toast('Failed to submit suggestion. Please try again later.', 5000, 'error', 'bi bi-x-circle-fill');
            }
          } catch (e) {
            toast('Failed to submit suggestion. Please try again later.', 5000, 'error', 'bi bi-x-circle-fill');
          }
        },
        close: true,
      },
    ],
  });
}
