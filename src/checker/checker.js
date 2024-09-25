import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";

import { autocomplete } from "/src/symbols/symbols.js";
import { unixToTimeString } from "/src/modules/time.js";
import { getPeriod } from "/src/periods/periods";
import { getCourse } from "/src/periods/classes";
import { convertLatexToAsciiMath, convertLatexToMarkup, renderMathInElement } from "mathlive";
``;

const domain = (window.location.hostname.search('check') != -1) ? 'http://api.check.vssfalcons.com' : 'http://localhost:5000';
const segments = document.getElementById("segment-input");
const segmentInput = document.getElementById("segment-input");
const questions = document.getElementById("question-input");
const questionInput = document.getElementById("question-input");
const answerInput = document.getElementById("answer-input");
const mf = document.getElementById("math-input");
const setInput = document.getElementById("set-input");
var setInputs = document.querySelectorAll("[data-set-input]");

let currentAnswerMode;
let multipleChoice = null;

let historyIndex = 0;

// Initialization
{
  // Get URL parameters
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  // Test for valid seat code
  const regex = /^[1-9][1-6][1-5]$/;
  if (regex.test(code)) {
    // Update seat code
    storage.set("code", code);
    updateCode();
  }
  // Show seat code modal if no saved code exists
  if (storage.get("code")) {
    updateCode();
  } else {
    ui.view("settings/code");
  }
  // Show clear data fix guide
  // if (storage.get("created")) {
  //   document.querySelector(`[data-modal-view="clear-data-fix"]`).remove();
  // } else {
  //   storage.set("created", Date.now());
  // }
  // Focus segment input
  segmentInput.focus();
  // Set default answer mode
  answerMode("input");
  // Populate seat code finder grid
  for (let col = 1; col <= 5; col++) {
    for (let row = 6; row > 0; row--) {
      const period = document.getElementById("period-input").value;
      const code = period + row.toString() + col.toString();
      const button = new ui.Element("button", "", {
        click: () => {
          document.getElementById("code-input").value = code;
          ui.view("settings/code");
        },
      }).element;
      document.getElementById("seat-grid").append(button);
      ui.addTooltip(button, code);
    }
  }
  // Update history feed
  updateHistory();
  // Focus answer input
  document.getElementById("answer-suggestion").addEventListener("click", () => answerInput.focus());
}

// Submit click
document.getElementById("submit-button").addEventListener("click", () => {
  const mode = ui.getButtonSelectValue(document.getElementById("answer-mode-selector"));
  const segment = segmentInput.value?.trim();
  const question = questionInput.value?.trim();
  const answer =
    multipleChoice ||
    (() => {
      if (mode === "input") {
        return answerInput.value?.trim();
      } else if (mode === "math") {
        return convertLatexToAsciiMath(mf.value);
      } else if (mode === "set") {
        var values = [];
        var setInputs = document.querySelectorAll('[data-set-input]');
        setInputs.forEach(a => {
          if ((a.value.length > 0) && (a.value != ' ')) values.push(a.value)
        });
        return JSON.stringify(values);
      }
    })();
  if (storage.get("code")) {
    if (segment && question && answer) {
      // Check if code matches current period
      const matchesCurrentPeriod =
        parseInt(storage.get("code").slice(0, 1)) === getPeriod() + 1 || true;
      if (!matchesCurrentPeriod) {
        ui.prompt("Are you sure you want to submit?", "Your seat code isn't for this period!", [
          {
            text: "Cancel",
            close: true,
          },
          {
            text: "Submit Anyways",
            close: true,
            onclick: submit,
          },
        ]);
      } else {
        submit();
      }
    }
    if (!answer) {
      if (mode === "input") {
        answerInput.classList.add("attention");
        answerInput.focus();
      } else if (mode === "math") {
        mf.classList.add("attention");
        mf.focus();
      } else if (mode === "set") {
        setInput.classList.add("attention");
        setInput.focus();
      }
    }
    if (!question) {
      questionInput.classList.add("attention");
      questionInput.focus();
    }
    if (!segment) {
      segmentInput.classList.add("attention");
      segmentInput.focus();
    }
  } else {
    ui.view("settings/code");
  }
  function submit() {
    submitClick(storage.get("code"), segment, question, answer);
    if (mode === "math" && !multipleChoice) {
      storeClick(storage.get("code"), segment, question, mf.value, "latex");
    } else if (mode === "set" && !multipleChoice) {
      storeClick(storage.get("code"), segment, question, answer, "array");
    } else {
      storeClick(storage.get("code"), segment, question, answer, "text");
    }
    resetInputs();
    // Show submit confirmation
    ui.modeless(`<i class="bi bi-check-lg"></i>`, "Submitted!");
  }
});

// Remove attention ring when user types in either input
segmentInput.addEventListener("input", (e) => {
  e.target.classList.remove("attention");
});
questionInput.addEventListener("input", (e) => {
  e.target.classList.remove("attention");
});
answerInput.addEventListener("input", (e) => {
  e.target.classList.remove("attention");
});
mf.addEventListener("input", (e) => {
  e.target.classList.remove("attention");
});

// Prevent MathLive default behavior
mf.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key == "Enter") {
    e.preventDefault();
  }
});

// Reset inputs to default state
function resetInputs() {
  const mode = ui.getButtonSelectValue(document.getElementById("answer-mode-selector"));
  // Reset answer inputs
  questionInput.value = "";
  answerInput.value = "";
  mf.value = "";
  // Switch input mode (exit multiple choice)
  answerMode(mode);
  multipleChoice = null;
  autocomplete.update();
  // Focus input element
  questionInput.focus();
}

// Check answer
function submitClick(code, segment, question, answer) {
  fetch(domain + '/check_answer', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "response": answer,
      "segment": segment,
      "question_id": question,
      "seat": code
    })
  });
}

// Limit seat code input to integers
document.getElementById("code-input").addEventListener("input", (e) => {
  e.target.value = parseInt(e.target.value) || "";
});

// Save seat code on enter
document.getElementById("code-input").addEventListener("keydown", (e) => {
  if (e.key == "Enter") {
    e.preventDefault();
    saveCode();
  }
});

// Save seat code button
document.getElementById("save-code-button").addEventListener("click", saveCode);

// Save seat code
function saveCode() {
  const input = document.getElementById("code-input").value;
  // Tests for valid seat code
  const regex = /^[1-9][1-6][1-5]$/;
  if (regex.test(input)) {
    storage.set("code", input);
    updateCode();
    // Close all modals
    ui.view("");
    // Update URL parameters with seat code
    const params = new URLSearchParams(window.location.search);
    params.set("code", input);
    history.replaceState({}, "", "?" + params.toString());
  } else {
    ui.alert("Error", "Seat code isn't possible");
  }
}

var questionsArray = [];
var segmentsArray = [];

// Update elements with new seat code
async function updateCode() {
  if (storage.get("code")) {
    document.getElementById("code-input").value = storage.get("code");
    document.querySelectorAll("span.code").forEach((element) => {
      element.innerHTML = storage.get("code");
    });
    document.title = `Virtual Checker (${storage.get("code")})`;
    document.getElementById("course-input").value = getCourse(storage.get("code")) || "Unknown Course";
    // Load segments
    await fetch(domain + '/segments?course=' + storage.get("code").slice(0, 1), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    })
      .then(a => a.json())
      .then(a => {
        segments.innerHTML = '';
        segmentsArray = a;
        a.forEach(segment => {
          var s = document.createElement('option');
          s.value = segment.number;
          s.innerHTML = segment.name;
          segments.append(s);
          segments.addEventListener("change", () => {
            var s2 = segmentsArray.find(s2 => s2.number == segments.value);
            questions.innerHTML = '';
            JSON.parse(s2.question_ids).forEach(question => {
              var q = document.createElement('option');
              q.value = question.id;
              q.innerHTML = question.name;
              questions.append(q);
            });
          });
        });
        var s2 = segmentsArray.find(s2 => s2.number == segments.value);
        questions.innerHTML = '';
        JSON.parse(s2.question_ids).forEach(question => {
          var q = document.createElement('option');
          q.value = question.id;
          q.innerHTML = question.name;
          questions.append(q);
        });
        fetch(domain + '/questions', {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          }
        })
          .then(a => a.json())
          .then(a => {
            questionsArray = a;
        });
      });
  }
}

// Show multiple choice card
document.querySelectorAll("[data-multiple-choice]").forEach((button) => {
  const descriptions = {
    "a": ["Agree", "True", "Yes"],
    "b": ["Disagree", "False", "No"],
    "c": ["Both", "Always"],
    "d": ["Neither", "Never"],
    "e": ["Sometimes", "Cannot be determined"],
  };
  button.addEventListener("click", (e) => {
    const choice = e.target.getAttribute("data-multiple-choice");
    // Set content of multiple choice card
    const content = document.querySelector(`[data-answer-mode="choice"]>div`);
    content.innerHTML = `<p><b>Choice ${choice.toUpperCase()}</b></p>
<p>Equivalent to submitting</p>
<p>${descriptions[choice].join(", ")}</p>`;
    // Show multiple choice card
    answerMode("choice");
    multipleChoice = `CHOICE ${choice.toUpperCase()}`;
  });
});

// Hide multiple choice card
document.getElementById("remove-choice-button").addEventListener("click", () => {
  answerMode(ui.getButtonSelectValue(document.getElementById("answer-mode-selector")));
  multipleChoice = null;
});

// Set answer mode
function answerMode(mode) {
  const current = document.querySelector(`[data-answer-mode="${currentAnswerMode}"]`);
  const fromHeight = current?.getBoundingClientRect().height;

  if (currentAnswerMode == mode) return;
  document.querySelectorAll("[data-answer-mode]").forEach((item) => {
    if (item.getAttribute("data-answer-mode") == mode) {
      item.style.removeProperty("display");
    } else {
      item.style.display = "none";
    }
  });

  // Animate container
  const container = document.getElementById("answer-container");
  const target = document.querySelector(`[data-answer-mode="${mode}"]`);
  const toHeight = target.getBoundingClientRect().height;
  ui.animate(
    container,
    fromHeight
      ? {
          height: fromHeight + "px",
        }
      : undefined,
    {
      height: toHeight + "px",
    },
    500,
    false,
  );

  currentAnswerMode = mode;
}

// Store click to storage and history
function storeClick(code, question, answer, type) {
  const history = storage.get("history") || [];
  const timestamp = Date.now();
  history.push({
    "code": code,
    "question": question,
    "answer": answer,
    "timestamp": timestamp,
    "type": type || "text",
  });
  storage.set("history", history);
  updateHistory();
}

document.getElementById("history-first").addEventListener("click", () => {
  historyIndex = getHistoryDates().length - 1;
  updateHistory();
});

document.getElementById("history-backward").addEventListener("click", () => {
  historyIndex++;
  updateHistory();
});

document.getElementById("history-forward").addEventListener("click", () => {
  historyIndex--;
  updateHistory();
});

document.getElementById("history-last").addEventListener("click", () => {
  historyIndex = 0;
  updateHistory();
});

// Count number of unique days
function getHistoryDates() {
  const data = (storage.get("history") || []).map((entry) => {
    const day = new Date(entry.timestamp).toISOString().split("T")[0];
    return { ...entry, day: day };
  });
  const unique = data
    .map((entry) => entry.day)
    .filter((value, i, array) => {
      return array.indexOf(value) === i;
    })
    .reverse();
  return unique;
}

// Filter history by date
function filterHistory() {
  const data = (storage.get("history") || []).map((entry) => {
    const day = new Date(entry.timestamp).toISOString().split("T")[0];
    return { ...entry, day: day };
  });
  return data.filter((entry) => entry.day === getHistoryDates()[historyIndex]);
}

// Update history feed
function updateHistory() {
  const history = filterHistory();
  const date =
    history[0] &&
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(history[0]?.day));

  // Update history navigation
  document.getElementById("history-first").disabled = historyIndex === getHistoryDates().length - 1;
  document.getElementById("history-backward").disabled =
    historyIndex === getHistoryDates().length - 1;
  document.getElementById("history-forward").disabled = historyIndex === 0;
  document.getElementById("history-last").disabled = historyIndex === 0;
  document.getElementById("history-date").textContent = date;

  const feed = document.getElementById("history-feed");
  if (history.length != 0) {
    feed.innerHTML = "";
    history.forEach((item) => {
      const button = document.createElement("button");
      const latex = item.type === "latex";
      const array = item.type === "array";
      if (!latex) {
        if (!array) {
          button.innerHTML = `<p><b>${item.question}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n<p>${item.answer}</p>`;
        } else {
          button.innerHTML = `<p><b>${item.question}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n<p>${item.answer.split('[')[1].split(']')[0]}</p>`;
        }
      } else {
        button.innerHTML = `<p><b>${item.question}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n${convertLatexToMarkup(item.answer)}\n<p class="hint">(Equation may not display properly)</p>`;
      }
      feed.prepend(button);
      renderMathInElement(button);
      // Resubmit click
      button.addEventListener("click", () => {
        questionInput.value = item.question;
        ui.view("");
        if (latex) {
          answerMode("math");
          ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "math");
          mf.value = item.answer;
        } else if (array) {
          answerMode("set");
          ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "set");
          var i = 0;
          JSON.parse(item.answer).forEach(a => {
            setInputs[i].value = a;
            i++;
          });
        } else {
          const choice = item.answer.match(/^CHOICE ([A-E])$/);
          if (!choice) {
            answerInput.value = item.answer;
            answerMode("input");
          } else {
            document.querySelector(`[data-multiple-choice="${choice[1].toLowerCase()}"]`).click();
          }
          questionInput.focus();
          autocomplete.update();
        }
      });
    });
  } else {
    feed.innerHTML = "<p>Submitted clicks will show up here!</p>";
  }
}

// Reset modals
const resets = {
  "history": () => {
    ui.prompt("Clear history?", "This action cannot be reversed!", [
      {
        text: "Cancel",
        close: true,
      },
      {
        text: "Clear",
        close: true,
        onclick: () => {
          storage.delete("history");
          window.location.reload();
        },
      },
    ]);
  },
  "all": () => {
    ui.prompt("Reset all settings?", "This action cannot be reversed!", [
      {
        text: "Cancel",
        close: true,
      },
      {
        text: "Reset",
        close: true,
        onclick: () => {
          storage.obliterate();
          window.location.reload();
        },
      },
    ]);
  },
};

// Show reset modal
document.querySelectorAll("[data-reset]").forEach((button) => {
  button.addEventListener("click", (e) => {
    resets[e.target.getAttribute("data-reset")]();
  });
});

// Disable developer mode button
if (storage.get("developer")) {
  document.querySelector(`[data-modal-page="reset"]`).append(
    new ui.Element("button", "Disable Developer Mode", {
      "click": () => {
        storage.delete("developer");
      },
    }).element,
  );
}

const answerLabel = document.querySelector(`label[for="answer-input"]`);

// Select answer mode
document.getElementById("answer-mode-selector").addEventListener("input", (e) => {
  const mode = e.detail;
  answerMode(mode);
  if (mode === "input") {
    answerLabel.setAttribute("for", "answer-input");
  } else if (mode === "math") {
    answerLabel.setAttribute("for", "math-input");
  } else if (mode === "set") {
    answerLabel.setAttribute("for", "set-input");
  }
});

var setInputs = document.querySelectorAll('[data-set-input]');

// Add set input
document.querySelector("[data-add-set-input]").addEventListener("click", () => {
  setInputs = document.querySelectorAll('[data-set-input]');
  let highestDataElement = null;
  setInputs.forEach(element => {
    if (highestDataElement === null || parseInt(element.getAttribute('data-set-input'), 10) > parseInt(highestDataElement.getAttribute('data-set-input'), 10)) highestDataElement = element;
  });
  if (highestDataElement !== null) {
    var newSetInput = document.createElement('div');
    newSetInput.id = 'question-container';
    var newSetInputInput = document.createElement('input');
    newSetInputInput.setAttribute('type', 'text');
    newSetInputInput.setAttribute('autocomplete', 'off');
    newSetInputInput.setAttribute('data-set-input', Number(highestDataElement.getAttribute('data-set-input')) + 1);
    newSetInput.appendChild(newSetInputInput);
    const buttonGrid = document.querySelector('[data-answer-mode="set"] .button-grid');
    const insertBeforePosition = buttonGrid.children.length - 2;
    if (insertBeforePosition > 0) {
      buttonGrid.insertBefore(newSetInput, buttonGrid.children[insertBeforePosition]);
    } else {
      buttonGrid.appendChild(newSetInput);
    }
    document.querySelector('[data-answer-mode="set"] .button-grid').style.flexWrap = (setInputs.length > 2) ? 'wrap' : 'nowrap';
    newSetInputInput.focus();
  }
});

// Remove set input
document.querySelector("[data-remove-set-input]").addEventListener("click", () => {
  setInputs = document.querySelectorAll('[data-set-input]');
  if (setInputs.length > 1) {
    let highestDataElement = null;
    setInputs.forEach(element => {
      if (highestDataElement === null || parseInt(element.getAttribute('data-set-input'), 10) > parseInt(highestDataElement.getAttribute('data-set-input'), 10)) highestDataElement = element;
    });
    if (highestDataElement !== null) highestDataElement.parentElement.remove();
  }
  document.querySelector('[data-answer-mode="set"] .button-grid').style.flexWrap = (setInputs.length < 5) ? 'nowrap' : 'wrap';
});
