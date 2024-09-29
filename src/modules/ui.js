import "./ui.css";

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
  // Create dialog element
  const dialog = document.createElement("dialog");
  dialog.innerHTML = options.body;
  // Append dialog element to DOM
  document.body.append(dialog);
  // Show modal
  show(dialog, options.title, null, options.buttons, options.blur);
  // Remove dialog element on close
  dialog.addEventListener("close", () => {
    dialog.remove();
  });
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

export function view(path) {
  if (!path) {
    const event = new Event("triggerclose");
    document.querySelector("dialog[open]").dispatchEvent(event);
    return;
  }
  const pages = path.split("/");
  const target = document.querySelector(`[data-modal-page="${pages[pages.length - 1]}"]`);
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
  const buttons = (title === 'API Offline') ? [] : [
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
  const event = new Event("view");
  target.dispatchEvent(event);
}

export function modeless(icon, message) {
  document.querySelector("div.modeless")?.remove();
  const element = document.createElement("div");
  const keyframes = [{ opacity: 0 }, { opacity: 1 }];
  element.className = "modeless";
  element.append(new Element("h2", icon).element, new Element("p", message).element);
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
  }, 2400);
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

export class Element {
  constructor(tag, text, events, className, attributes) {
    this.tag = tag;
    this.text = text;
    this.events = events;
    this.className = className;
    this.attributes = attributes;
  }

  get element() {
    const element = document.createElement(this.tag);
    element.innerHTML = this.text;
    this.className && (element.className = this.className);
    this.events &&
      Object.keys(this.events).forEach((type) => {
        const listener = this.events[type];
        element.addEventListener(type, listener);
      });
    this.attributes &&
      Object.keys(this.attributes).forEach((attribute) => {
        const value = this.attributes[attribute];
        element.setAttribute(attribute, value);
      });
    return element;
  }
}

// Click outside modal
(() => {
  document.addEventListener("pointerdown", (e) => {
    const dialog = document.querySelector("dialog[open]");
    if ((dialog?.querySelector('h2').innerText != 'API Offline') && dialog?.hasAttribute("data-open") && !dialog?.contains(e.target)) {
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
