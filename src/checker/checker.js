/* eslint-disable no-extra-semi */
/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as auth from "/src/modules/auth.js";
import Element from "/src/modules/element.js";
import extendedSchedule from "/src/periods/extendedSchedule.json";

import { autocomplete, uniqueSymbols } from "/src/symbols/symbols.js";
import { unixToString, unixToTimeString } from "/src/modules/time.js";
import { getExtendedPeriodRange } from "/src/periods/periods";
import { convertLatexToAsciiMath, convertLatexToMarkup, renderMathInElement } from "mathlive";
import mediumZoom from "medium-zoom";
import confetti from "canvas-confetti";
import Quill from "quill";
import "faz-quill-emoji/autoregister";
``;

try {
  const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;
  const segments = document.getElementById("segment-input");
  const segmentInput = document.getElementById("segment-input");
  const questions = document.getElementById("question-input");
  const questionInput = document.getElementById("question-input");
  const answerInput = document.getElementById("answer-input");
  const mf = document.getElementById("math-input");
  const setInput = document.getElementById("set-input");
  var setInputs = document.querySelectorAll("[data-set-input]");
  const questionImages = document.querySelector('.images');
  const nextQuestionButtons = document.querySelectorAll('[data-next-question]');
  const prevQuestionButtons = document.querySelectorAll('[data-prev-question]');
  var period = document.getElementById("period-input")?.value;

  var courses = [];
  var segmentsArray = [];
  var questionsArray = [];
  let currentAnswerMode;
  let currentSetType = "brackets";
  let multipleChoice = null;
  let highestDataElement = null;
  let restoredSetType = "";
  var history = [];

  let historyIndex = 0;

  // Initialization
  async function init() {
    ui.startLoader();
    if (!document.getElementById("course-input")) {
      ui.stopLoader();
      return;
    }
    // Populate seat code finder grid
    document.getElementById("seat-grid").innerHTML = "";
    for (let col = 1; col <= 5; col++) {
      for (let row = 6; row > 0; row--) {
        period = document.getElementById("period-input").value;
        const code = period + row.toString() + col.toString();
        const button = new Element("button", "", {
          click: () => {
            document.getElementById("code-input").value = code;
            ui.view("settings/code");
          },
        }).element;
        document.getElementById("seat-grid").append(button);
        ui.addTooltip(button, code);
      }
    }
    document.getElementById("period-input").addEventListener("change", () => {
      document.getElementById("seat-grid").innerHTML = "";
      for (let col = 1; col <= 5; col++) {
        for (let row = 6; row > 0; row--) {
          period = document.getElementById("period-input").value;
          const code = period + row.toString() + col.toString();
          const button = new Element("button", "", {
            click: () => {
              document.getElementById("code-input").value = code;
              ui.view("settings/code");
            },
          }).element;
          document.getElementById("seat-grid").append(button);
          ui.addTooltip(button, code);
        }
      }
    });
    if (document.querySelector('[data-logout]')) document.querySelector('[data-logout]').addEventListener('click', () => auth.logout(init));
    if (document.querySelector('[data-toggle-layout]')) document.querySelector('[data-toggle-layout]').addEventListener('click', toggleLayout);
    document.getElementById("code-input").value = '';
    document.querySelectorAll("span.code").forEach((element) => {
      element.innerHTML = '';
    });
    document.title = 'Virtual Checker';
    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    // Test for valid seat code
    const regex = /^[1-9][0-6][0-5]$/;
    if (regex.test(code)) {
      // Update seat code
      storage.set("code", code);
    }
    // Show seat code modal if no saved code exists
    if (!storage.get("code")) {
      ui.view("settings/code");
      return;
    }
    await auth.sync(false, updateCode);
  };

  init();

  window.addEventListener('beforeunload', function (event) {
    if (!ui.unsavedChanges) return;
    const confirmationMessage = 'You have unsaved changes. Do you really want to leave?';
    event.returnValue = confirmationMessage;
    return confirmationMessage;
  });

  function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // Process check
  function processCheck() {
    if (!storage.get("password")) {
      auth.sync(false);
      return;
    }
    document.getElementById("submit-button").disabled = true;
    const mode = ui.getButtonSelectValue(document.getElementById("answer-mode-selector"));
    const segment = segmentInput.value?.trim();
    const question = questionInput.value?.trim();
    const answer =
      multipleChoice ||
      (() => {
        if (mode === "input") {
          return answerInput.value?.trim();
        } else if (mode === "math") {
          return convertLatexToAsciiMath(mf.value?.trim());
        } else if (mode === "set") {
          var values = "";
          var setInputs = document.querySelectorAll('[data-set-input]');
          setInputs.forEach(a => {
            if ((a.value.length > 0) && (a.value != ' ')) values += `"${a.value.replaceAll(',', '').trim()}", `;
          });
          values = values.slice(0, -2);
          switch (currentSetType) {
            case "brackets":
              values = `{${values}}`;
              break;
            case "vector":
              values = `<${values}>`;
              break;
            case "array":
              values = `[${values}]`;
              break;
            case "coordinate":
              values = `(${values})`;
              break;
            case "product":
              values = `⟨${values}⟩`;
              break;
            default:
              break;
          };
          return values;
        } else if (mode === "matrix") {
          var matrix = [];
          var matrixRows = document.querySelectorAll('#matrix [data-matrix-row]');
          matrixRows.forEach(row => {
            var matrixRow = [];
            row.querySelectorAll('[data-matrix-column]').forEach(input => {
              var value = input.value?.trim();
              if (value.length > 0) {
                matrixRow.push(value);
              } else {
                matrixRow.push("");
              }
            });
            matrix.push(matrixRow);
          });
          var matrixString = JSON.stringify(matrix);
          return matrixString;
        }
      })();
    if (storage.get("code")) {
      if (segment && question && answer) {
        submit();
      }
      if (!answer) {
        if (mode === "input") {
          answerInput.classList.add("attention");
          answerInput.focus();
          setTimeout(() => {
            document.getElementById("submit-button").disabled = false;
          }, 3000);
        } else if (mode === "math") {
          mf.classList.add("attention");
          mf.focus();
          setTimeout(() => {
            document.getElementById("submit-button").disabled = false;
          }, 3000);
        } else if (mode === "set") {
          setInput.classList.add("attention");
          setInput.focus();
          setTimeout(() => {
            document.getElementById("submit-button").disabled = false;
          }, 3000);
        } else if (mode === "matrix") {
          document.querySelector('#matrix [data-matrix-row]:first-child [data-matrix-column]').classList.add("attention");
          document.querySelector('#matrix [data-matrix-row]:first-child [data-matrix-column]').focus();
          setTimeout(() => {
            document.getElementById("submit-button").disabled = false;
          }, 3000);
        }
      }
      if (!question) {
        questionInput.classList.add("attention");
        questionInput.focus();
        setTimeout(() => {
          document.getElementById("submit-button").disabled = false;
        }, 3000);
      }
    } else {
      ui.view("settings/code");
      setTimeout(() => {
        document.getElementById("submit-button").disabled = false;
      }, 3000);
    }
    function submit() {
      submitClick(storage.get("code"), segment, question, answer, mode);
    };
  };

  // Submit check
  document.getElementById("submit-button")?.addEventListener("click", () => processCheck());

  // Remove attention ring when user types in either input
  segmentInput?.addEventListener("input", (e) => {
    e.target.classList.remove("attention");
  });
  questionInput?.addEventListener("input", (e) => {
    e.target.classList.remove("attention");
  });
  answerInput?.addEventListener("input", (e) => {
    e.target.classList.remove("attention");
  });
  mf?.addEventListener("input", (e) => {
    e.target.classList.remove("attention");
  });

  // Prevent MathLive default behavior
  mf?.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key == "Enter") {
      e.preventDefault();
    }
  });

  // Reset inputs to default state
  function resetInputs() {
    const mode = ui.getButtonSelectValue(document.getElementById("answer-mode-selector"));
    // Reset answer inputs
    answerInput.value = "";
    mf.value = "";
    setInputs = document.querySelectorAll('[data-set-input]');
    if (setInputs.length > 1) {
      var a = 0;
      setInputs.forEach(s => {
        if (a > 0) {
          s.remove();
        } else {
          s.value = '';
        }
        a++;
      });
    }
    document.querySelectorAll('[data-answer-mode="set"] .button-grid')[1].style.flexWrap = 'nowrap';
    resetMatrix();
    // Switch input mode (exit multiple choice)
    answerMode(mode);
    multipleChoice = null;
    autocomplete.update();
    // Focus input element
    answerInput.focus();
  }

  // Check answer
  async function submitClick(code, segment, question, answer, mode) {
    if (history.find(r => (String(r.segment) === String(segment)) && (String(r.question_id) === String(question)) && (r.status === 'Correct'))) {
      window.scroll(0, 0);
      ui.setUnsavedChanges(false);
      setTimeout(() => {
        document.getElementById("submit-button").disabled = false;
      }, 3000);
      return ui.modeless(`<i class="bi bi-exclamation-lg"></i>`, 'Already Correct');
    }
    ui.setUnsavedChanges(true);
    ui.toast("Submitting check...", 10000, "info", "bi bi-hourglass-split");
    var storageClickMode = "text";
    if (mode === "math" && !multipleChoice) {
      storageClickMode = "latex";
    } else if (mode === "set" && !multipleChoice) {
      storageClickMode = "array";
    } else if (mode === "matrix" && !multipleChoice) {
      storageClickMode = "matrix";
    }
    await fetch(domain + '/check_answer', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "response": answer,
        "segment": segment,
        "question_id": question,
        "seat": code,
        "mode": storageClickMode
      })
    })
      .then(r => r.json())
      .then(async r => {
        ui.setUnsavedChanges(false);
        window.scroll(0, 0);
        ui.clearToasts();
        if (typeof r.correct != 'undefined') {
          ui.modeless(`<i class="bi bi-${(r.correct) ? 'check' : 'x'}-lg"></i>`, (r.correct) ? 'Correct' : 'Try Again', r.reason || null);
        } else if (typeof r.error != 'undefined') {
          ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, 'Error');
        } else {
          ui.modeless(`<i class="bi bi-hourglass"></i>`, "Submitted, Awaiting Scoring");
        }
        resetInputs();
        await fetchHistory();
        await updateHistory();
        await updateSegment(null, true);
        if ((typeof r.correct === 'undefined') || r.correct || (typeof r.error !== 'undefined')) {
          nextQuestion(null, true);
        } else {
          updateQuestion();
        }
        setTimeout(() => {
          document.getElementById("submit-button").disabled = false;
        }, 3000);
      })
      .catch(() => {
        setTimeout(() => {
          document.getElementById("submit-button").disabled = false;
        }, 3000);
        ui.view("api-fail");
      })
    ui.reloadUnsavedInputs();
  }

  // Limit seat code input to integers
  document.getElementById("code-input")?.addEventListener("input", (e) => {
    e.target.value = parseInt(e.target.value) || "";
  });

  // Save seat code on enter
  document.getElementById("code-input")?.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
      e.preventDefault();
      saveCode();
    }
  });

  // Save seat code button
  document.getElementById("save-code-button")?.addEventListener("click", saveCode);

  // Save seat code
  function saveCode() {
    const input = document.getElementById("code-input").value;
    // Tests for valid seat code
    const regex = /^[1-9][0-6][0-5]$/;
    if (regex.test(input)) {
      if (input.includes('0')) {
        ui.view("");
        ui.modal({
          title: 'Reserved Seat Code',
          body: '<p>An invalid seat code was entered. Are you sure you want to use this code?</p>',
          buttons: [
            {
              text: 'Back',
              class: 'cancel-button',
              onclick: () => {
                ui.view("");
                document.getElementById("code-input").focus();
                ui.setUnsavedChanges(true);
                ui.view("settings/code");
              }
            },
            {
              text: `Use ${input}`,
              class: 'submit-button',
              onclick: () => {
                storage.set("code", input);
                init();
                // Close all modals
                ui.view("");
                // Update URL parameters with seat code
                const params = new URLSearchParams(window.location.search);
                params.set("code", input);
                ui.setUnsavedChanges(false);
              },
              close: true,
            },
          ],
        });
      } else {
        // Close all modals
        ui.view("");
        storage.set("code", input);
        init();
        // Update URL parameters with seat code
        const params = new URLSearchParams(window.location.search);
        params.set("code", input);
        ui.setUnsavedChanges(false);
      };
    } else {
      ui.alert("Error", "Seat code isn't possible");
    }
  }

  // Update elements with new seat code
  async function updateCode() {
    const code = storage.get("code");
    document.getElementById("code-input").value = storage.get("code");
    document.querySelectorAll("span.code").forEach((element) => {
      element.innerHTML = storage.get("code");
    });
    document.title = `Virtual Checker (${storage.get("code")})`;
    const periodRange = getExtendedPeriodRange(null, Number(code.slice(0, 1)));
    try {
      const bulkLoadResponse = await fetch(`${domain}/bulk_load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const bulkLoad = await bulkLoadResponse.json();
      courses = bulkLoad.courses;
      segmentsArray = bulkLoad.segments;
      questionsArray = bulkLoad.questions;
      const course = courses.find(c => JSON.parse(c.periods).includes(Number(code.slice(0, 1))));
      if (course) {
        ui.view();
      } else {
        ui.startLoader();
        return ui.view("no-course");
      }
      if (document.getElementById("course-input")) document.getElementById("course-input").value = course.name || "Unknown Course";
      if (document.querySelector('[data-syllabus-download]')) {
        if (course.syllabus) {
          document.querySelector('[data-syllabus-download]').removeAttribute('hidden');
          document.querySelector('[data-syllabus-download]').addEventListener('click', () => {
            window.open(course.syllabus, '_blank');
          });
        } else {
          document.querySelector('[data-syllabus-download]').setAttribute('hidden', '');
        }
      }
      if (document.querySelector('.alert')) {
        var checker_announcement = JSON.parse(course.checker_announcement || '{}');
        if ((checker_announcement.image || checker_announcement.title || checker_announcement.content || checker_announcement.link) && (checker_announcement.expires ? new Date(`${checker_announcement.expires}T${extendedSchedule[Number(code.slice(0, 1))][1]}:00`) > new Date() : true)) {
          document.querySelector('.alert').removeAttribute('hidden');
          document.querySelector('.alert').classList = `alert ${checker_announcement.layout || ''}`;
          if (checker_announcement.image) {
            document.querySelector('.alert img').removeAttribute('hidden');
            document.querySelector('.alert img').src = checker_announcement.image;
            mediumZoom(document.querySelector('.alert img'), {
              background: "transparent"
            });
          } else {
            document.querySelector('.alert img').setAttribute('hidden', '');
          }
          document.querySelector('.alert h3').innerText = checker_announcement.title || 'Announcement';
          if (checker_announcement.content) {
            document.querySelector('.alert p').removeAttribute('hidden');
            document.querySelector('.alert p').innerText = checker_announcement.content;
          } else {
            document.querySelector('.alert p').setAttribute('hidden', '');
          }
          if (checker_announcement.link) {
            document.querySelector('.alert button').removeAttribute('hidden');
            document.querySelector('.alert button').innerHTML = `${checker_announcement.linkTitle || 'Go'} <i class="bi bi-arrow-right-short"></i>`;
            document.querySelector('.alert button').addEventListener('click', () => {
              window.open(checker_announcement.link, '_blank');
            });
          } else {
            document.querySelector('.alert button').setAttribute('hidden', '');
            document.querySelector('.alert button').removeEventListener('click', () => { });
          }
        } else {
          document.querySelector('.alert').setAttribute('hidden', '');
        }
      }
      segmentsArray = segmentsArray.filter(s => String(s.course) === String(course.id));
      segments.innerHTML = '';
      segmentsArray.sort((a, b) => a.order - b.order).forEach(segment => {
        const option = document.createElement('option');
        option.value = segment.id;
        var questionStatuses = [];
        JSON.parse(segment.question_ids).forEach(questionId => {
          if (questionsArray.find(q => String(q.id) === String(questionId.id))) {
            var highestStatus = "";
            var questionResponses = history.filter(r => String(r.question_id) === String(questionId.id));
            if (questionResponses.find(r => r.status === 'Correct')) {
              highestStatus = 'Correct';
            } else if (questionResponses.find(r => r.status.includes('Unknown'))) {
              highestStatus = 'Awaiting Scoring';
            } else if (questionResponses.find(r => r.status === 'Incorrect')) {
              highestStatus = 'In Progress';
            }
            questionStatuses.push({ "segment": segment.id, "question": questionId.id, "status": highestStatus });
          }
        });
        const allQuestionsCorrect = (JSON.parse(segment.question_ids).length > 0) && questionStatuses.every(question => question.status === 'Correct');
        option.innerHTML = `${segment.number} - ${segment.name}${segment.due ? ` (Due ${new Date(`${segment.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })})` : ''}${allQuestionsCorrect ? ' [MASTERY]' : ''}`;
        option.setAttribute('due', segment.due || '');
        segments.append(option);
      });
      segments.value = segmentsArray.find(s => {
        if (!s.due) return false;
        return (new Date(`${s.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) === new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', }) && new Date().getTime() <= periodRange[1]);
      })?.id || segmentsArray.find(s => {
        if (!s.due) return false;
        return (new Date(`${s.due}T00:00:00`).getTime() > periodRange[1] && new Date(`${s.due}T00:00:00`).getTime() <= periodRange[0] + 86400000);
      })?.id || segmentsArray.find(s => !s.due)?.id || segmentsArray[0]?.id;
      segments.removeEventListener("change", updateSegment);
      segments.addEventListener("change", updateSegment);
      // Update history feed
      await fetchHistory();
      await updateHistory();
      await updateSegment();
      // Show clear data fix guide
      // if (storage.get("created")) {
      //   document.querySelector(`[data-modal-view="clear-data-fix"]`).remove();
      // } else {
      //   storage.set("created", Date.now());
      // }
      // Focus segment input
      if (segmentInput) segmentInput.focus();
      // Set default answer mode
      answerMode("input");
      // Focus answer input
      document.getElementById("answer-suggestion").addEventListener("click", () => answerInput.focus());
      document.querySelector("[data-sync]").addEventListener("click", () => auth.syncManual());
      ui.reloadUnsavedInputs();
    } catch (error) {
      ui.view("api-fail");
    }
    ui.reloadUnsavedInputs();
  }

  async function fetchHistory() {
    history = await fetch(domain + '/responses', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("password"),
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          try {
            var re = await r.json();
            if (re.error || re.message) {
              ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
              throw new Error(re.error || re.message);
            } else {
              throw new Error("API error");
            }
          } catch (e) {
            throw new Error(e.message || "API error");
          }
        }
        return await r.json();
      });
  }

  async function updateSegment(event, sameSegment = false) {
    const selectedSegment = segmentsArray.find(s => String(s.id) === String(segments.value));
    const selectedQuestionOption = questions.querySelector('option:checked');
    questions.innerHTML = '';
    if (!selectedSegment) return updateQuestion();
    var questionStatuses = [];
    JSON.parse(selectedSegment.question_ids).forEach(questionId => {
      if (questionsArray.find(q => String(q.id) === String(questionId.id))) {
        const questionOption = document.createElement('option');
        questionOption.value = questionId.id;
        questionOption.innerHTML = questionId.name;
        var highestStatus = "";
        var questionResponses = history.filter(r => String(r.question_id) === String(questionId.id));
        if (questionResponses.find(r => r.status === 'Correct')) {
          highestStatus = 'Correct';
        } else if (questionResponses.find(r => r.status.includes('Unknown'))) {
          highestStatus = 'Awaiting Scoring';
        } else if (questionResponses.find(r => r.status === 'Incorrect')) {
          highestStatus = 'In Progress';
        }
        if (highestStatus !== "") questionOption.innerHTML += ` - ${ui.getNotifications().includes(Number(questionId.id)) ? '* ' : ''}${highestStatus}`;
        questionStatuses.push({ "segment": selectedSegment.id, "question": questionId.id, "status": highestStatus });
        questions.append(questionOption);
      }
    });
    if (sameSegment && selectedQuestionOption) questions.value = selectedQuestionOption.value;
    document.querySelector('[data-segment-due]').setAttribute('hidden', '');
    if (selectedSegment.due) {
      document.querySelector('[data-segment-due]').innerHTML = `<i class="bi bi-calendar3"></i> Due ${new Date(`${selectedSegment.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
      document.querySelector('[data-segment-due]').removeAttribute('hidden');
    };
    questions.removeEventListener("change", updateQuestion);
    questions.addEventListener("change", updateQuestion);
    await updateQuestion();
    document.getElementById("segment-completed").setAttribute('hidden', '');
    document.getElementById("segment-completed").querySelector('ul').innerHTML = '';
    document.getElementById("segment-completed").classList.remove('mastery');
    if ((questions.querySelectorAll('option').length > 0) && questionStatuses.every(question => question.status)) {
      document.getElementById("segment-completed").removeAttribute('hidden');
      questionStatuses.forEach(question => {
        const questionId = questionsArray.find(q => String(q.id) === String(question.question));
        const questionText = `${questionId.number} - ${question.status}`;
        const li = document.createElement('li');
        if (question.status === 'Correct') {
          li.innerHTML = `<i class="bi bi-check-lg"></i> ${questionText}`;
        } else if (question.status === 'Incorrect') {
          li.innerHTML = `<i class="bi bi-hourglass-split"></i> ${questionText}`;
        } else {
          li.innerHTML = `<i class="bi bi-hourglass"></i> ${questionText}`;
        }
        document.getElementById("segment-completed").querySelector('ul').append(li);
      });
    }
    if ((questions.querySelectorAll('option').length > 0) && questionStatuses.every(question => question.status === 'Correct')) {
      document.getElementById("segment-completed").classList.add('mastery');
      const count = 200;
      const textColor = getComputedStyle(document.body).getPropertyValue('--text-color').trim();
      var defaults = {
        origin: {
          y: 1
        },
        shapes: [
          confetti.shapeFromText({ text: '➕' }),
          confetti.shapeFromText({ text: '➖' }),
          confetti.shapeFromText({ text: '✖️' }),
          confetti.shapeFromText({ text: '➗' }),
          confetti.shapeFromText({ text: '0️⃣' }),
          confetti.shapeFromText({ text: '1️⃣' }),
          confetti.shapeFromText({ text: '2️⃣' }),
          confetti.shapeFromText({ text: '3️⃣' }),
          confetti.shapeFromText({ text: '4️⃣' }),
          confetti.shapeFromText({ text: '5️⃣' }),
          confetti.shapeFromText({ text: '6️⃣' }),
          confetti.shapeFromText({ text: '7️⃣' }),
          confetti.shapeFromText({ text: '8️⃣' }),
          confetti.shapeFromText({ text: '9️⃣' }),
          confetti.shapeFromText({ text: '🔢' }),
          confetti.shapeFromText({ text: '📐' }),
          confetti.shapeFromText({ text: '📏' }),
          confetti.shapeFromText({ text: '📊' }),
          confetti.shapeFromText({ text: '📈' }),
          confetti.shapeFromText({ text: '📉' }),
          confetti.shapeFromText({ text: '🔣' }),
          confetti.shapeFromText({ text: '✅' }),
          confetti.shapeFromText({ text: '☑️' }),
          confetti.shapeFromText({ text: '✔️' }),
        ],
      };
      uniqueSymbols.forEach(symbol => {
        defaults.shapes.push(confetti.shapeFromText({ text: symbol, color: textColor }));
      });
      function fire(particleRatio, opts) {
        confetti(
          Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio),
          })
        );
      };
      setTimeout(() => {
        fire(0.25, {
          spread: 26,
          startVelocity: 55,
          scalar: 0.5,
        });
        fire(0.2, {
          spread: 60,
          scalar: 0.5,
        });
        fire(0.35, {
          spread: 100,
          decay: 0.91,
          scalar: 1.3,
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.7,
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 45,
          scalar: 1.5,
        });
      }, 100);
    }
    ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  async function updateQuestion() {
    var question = questionsArray.find(q => String(q.id) === String(questions.value));
    questionImages.innerHTML = '';
    questionImages.classList.remove('gallery');
    nextQuestionButtons.forEach(btn => btn.disabled = true);
    prevQuestionButtons.forEach(btn => btn.disabled = true);
    document.getElementById("submit-button").disabled = true;
    document.querySelector('.hiddenOnLoad:has(#answer-container)').classList.remove('show');
    document.querySelector('[data-question-title]').setAttribute('hidden', '');
    document.querySelector('[data-question-description]').setAttribute('hidden', '');
    document.querySelector('[data-question-description]').innerHTML = '';
    const feedContainer = document.querySelector('.input-group:has(> #question-history-feed)');
    feedContainer.classList.remove('show');
    feedContainer.setAttribute('hidden', '');
    document.getElementById('answer-mode-selector').removeAttribute('hidden');
    document.getElementById('attachments-view-mode').removeAttribute('hidden');
    if (!question) {
      questionImages.innerHTML = '<p style="margin-bottom: -12px;">There are no questions in this segment.</p>';
      document.getElementById('answer-mode-selector').setAttribute('hidden', '');
      document.getElementById('attachments-view-mode').setAttribute('hidden', '');
      return;
    }
    document.title = `Virtual Checker (${storage.get("code")}) - #${JSON.parse(segmentsArray.find(s => String(s.id) === segmentInput.value)?.question_ids || [])?.find(q => String(q.id) === String(question.id))?.number || question.number || question.id} in Segment ${segmentsArray.find(s => String(s.id) === segmentInput.value).number}: ${segmentsArray.find(s => String(s.id) === segmentInput.value).name}`;
    if ((question.question.length > 0) && (question.question != ' ')) {
      if (question.latex) {
        document.querySelector('[data-question-title]').innerHTML = convertLatexToMarkup(question.question);
        renderMathInElement(document.querySelector('[data-question-title]'));
      } else {
        document.querySelector('[data-question-title]').innerText = question.question;
      };
      document.querySelector('[data-question-title]').removeAttribute('hidden');
    }
    if (question.description && question.description.includes('ops') && (question.description != '{"ops":[{"insert":"\\n"}]}') && JSON.parse(question.description)) {
      var textarea = document.createElement('div');
      document.querySelector('[data-question-description]').appendChild(textarea);
      var quill = new Quill(textarea, {
        readOnly: true,
        modules: {
          syntax: true,
          toolbar: false,
          fazEmoji: {
            collection: 'fluent-emoji',
          },
        },
        theme: 'snow'
      });
      quill.setContents(JSON.parse(question.description));
      document.querySelector('[data-question-description]').removeAttribute('hidden');
    }
    JSON.parse(question.images).forEach(image => {
      var i = document.createElement('img');
      i.src = image;
      questionImages.append(i);
      mediumZoom(i, {
        background: "transparent"
      });
    });
    ui.setButtonSelectValue(document.getElementById("attachments-view-mode"), (JSON.parse(question.images).length > 5) ? "gallery" : "default");
    if (JSON.parse(question.images).length > 5) questionImages.classList.add('gallery');

    const questionOptions = questions.querySelectorAll('option');
    const selectedQuestionOption = questions.querySelector('option:checked');

    if (questionOptions.length > 0) {
      const selectedQuestionOptionIndex = Array.from(questionOptions).indexOf(selectedQuestionOption);
      nextQuestionButtons.forEach(btn => btn.disabled = selectedQuestionOptionIndex === questionOptions.length - 1);
      prevQuestionButtons.forEach(btn => btn.disabled = selectedQuestionOptionIndex === 0);
      document.querySelector('.hiddenOnLoad:has(#answer-container)').classList.add('show');
      document.getElementById("submit-button").disabled = false;
    }

    resetInputs();

    const feed = document.getElementById('question-history-feed');
    var latestResponses = history.filter(r => (String(r.segment) === String(segments.value)) && (String(r.question_id) === String(question.id))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    feed.innerHTML = "";
    if (latestResponses.length > 0) {
      latestResponses.forEach(r => {
        if (r.error) {
          console.log(r.error);
          return;
        }
        const button = document.createElement("button");
        button.id = r.id;
        button.classList = (r.status === "Incorrect") ? 'incorrect' : (r.status === "Correct") ? 'correct' : '';
        if (r.flagged) button.classList.add('flagged');
        var response = `<b>Status:</b> ${r.status.includes('Unknown') ? r.status.split('Unknown, ')[1] : r.status} at ${unixToString(r.timestamp)}${(r.reason) ? `</p>\n<p><b>Response:</b> ${r.reason}<br>` : ''}</p><button data-flag-response><i class="bi bi-flag-fill"></i> ${r.flagged ? 'Unflag Response' : 'Flag for Review'}</button>`;
        switch (r.mode) {
          case 'latex':
            button.innerHTML = `${convertLatexToMarkup(r.response)}\n<p class="hint">(Equation may not display properly)</p>\n<p>${response}`;
            break;
          case 'array':
            button.innerHTML = `<p>${JSON.parse(`[${r.response.slice(1, -1).split(', ')}]`).join(', ')}</p>\n<p>${response}`;
            break;
          case 'matrix':
            button.innerHTML = `<p>${JSON.stringify(JSON.parse(r.response).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']')}</p>\n<p>${response}`;
            break;
          default:
            button.innerHTML = `<p>${escapeHTML(r.response)}</p>\n<p>${response}`;
            break;
        }
        feed.prepend(button);
        renderMathInElement(button);
        // Resubmit check
        button.addEventListener("click", async (event) => {
          if (event.target.hasAttribute('data-flag-response')) return r.flagged ? unflagResponse(event, true) : flagResponse(event, true);
          await resubmitCheck(r);
          window.scrollTo(0, document.body.scrollHeight);
        });
      });
      feedContainer.removeAttribute('hidden');
      feedContainer.classList.add('show');
      if (latestResponses.length > 2) {
        feed.style.maxHeight = `calc(${Array.from(feed.children).slice(-2).reduce((acc, el) => acc + el.offsetHeight, 0)}px + 0.25rem)`;
        feed.scrollTop = feed.scrollHeight;
      }
    } else {
      feedContainer.classList.remove('show');
    }

    if (ui.getNotifications().includes(question.id)) {
      await clearNotifications([question.id]);
      await ui.setNotifications(ui.getNotifications().filter(notification => notification !== question.id));
      await updateSegment(null, true);
    }

    ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  function prevQuestion() {
    const questionOptions = questions.querySelectorAll('option');
    const selectedQuestionOption = questions.querySelector('option:checked');
    const selectedQuestionOptionIndex = Array.from(questionOptions).indexOf(selectedQuestionOption);
    if (selectedQuestionOptionIndex > 0) {
      questionOptions[selectedQuestionOptionIndex - 1].selected = true;
      updateQuestion();
    }
  }

  function nextQuestion(event, nextBlank = false) {
    const questionOptions = questions.querySelectorAll('option');
    const selectedQuestionOption = questions.querySelector('option:checked');
    const selectedQuestionOptionIndex = Array.from(questionOptions).indexOf(selectedQuestionOption);
    var questionStatuses = [];
    questionOptions.forEach(questionId => {
      var question = questionsArray.find(q => String(q.id) === String(questionId.value));
      if (question) {
        var highestStatus = "";
        var questionResponses = history.filter(r => String(r.question_id) === String(questionId.value));
        if (questionResponses.find(r => r.status === 'Correct')) {
          highestStatus = 'Correct';
        } else if (questionResponses.find(r => r.status.includes('Unknown'))) {
          highestStatus = 'Awaiting Scoring';
        } else if (questionResponses.find(r => r.status === 'Incorrect')) {
          highestStatus = 'In Progress';
        }
        questionStatuses.push({ "question": questionId.value, "status": highestStatus });
      }
    });
    let nextIndex = -1;
    for (var i = selectedQuestionOptionIndex + 1; i < Array.from(questionOptions).length; i++) {
      const qOpt = Array.from(questionOptions)[i];
      const statusObj = questionStatuses.find(q => q.question === qOpt.value);
      if (!statusObj || !statusObj.status) {
        nextIndex = i;
        break;
      }
    }
    if (nextBlank && nextIndex !== -1) {
      Array.from(questionOptions)[nextIndex].selected = true;
      updateQuestion();
    } else if (selectedQuestionOptionIndex < questionOptions.length - 1) {
      questionOptions[selectedQuestionOptionIndex + 1].selected = true;
      updateQuestion();
    } else if ((questionOptions.length > 0) && questionStatuses.every(question => question.status)) {
      updateSegment();
    }
  }

  document.querySelectorAll('[data-prev-question]').forEach(p => p.addEventListener('click', prevQuestion));
  document.querySelectorAll('[data-next-question]').forEach(p => p.addEventListener('click', nextQuestion));

  // Show multiple choice card
  document.querySelectorAll("[data-multiple-choice]").forEach((button) => {
    const descriptions = {
      "a": ["Agree", "True", "Yes"],
      "b": ["Disagree", "False", "No"],
      "c": ["Both", "Always"],
      "d": ["Neither", "Never"],
      "e": ["Sometimes", "Cannot be determined", "Does not exist"],
    };
    button.addEventListener("click", (e) => {
      ui.setUnsavedChanges(true);
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
  if (document.getElementById("remove-choice-button")) {
    document.getElementById("remove-choice-button").addEventListener("click", () => {
      answerMode(ui.getButtonSelectValue(document.getElementById("answer-mode-selector")));
      multipleChoice = null;
    });
  }

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

    target?.querySelector('input, textarea, math-field')?.focus();

    currentAnswerMode = mode;
  }

  document.querySelector('[data-modal-view="history"]')?.addEventListener("click", async () => {
    await updateNotifications(await updateHistory(true));
  });

  document.getElementById("history-first")?.addEventListener("click", async () => {
    historyIndex = getHistoryDates().length - 1;
    await updateNotifications(await updateHistory());
  });

  document.getElementById("history-backward")?.addEventListener("click", async () => {
    historyIndex++;
    await updateNotifications(await updateHistory());
  });

  document.getElementById("history-forward")?.addEventListener("click", async () => {
    historyIndex--;
    await updateNotifications(await updateHistory());
  });

  document.getElementById("history-last")?.addEventListener("click", async () => {
    historyIndex = 0;
    await updateNotifications(await updateHistory());
  });

  // Count number of unique days
  function getHistoryDates() {
    const dates = history.map((entry) => new Date(entry.timestamp).toISOString().split("T")[0]);
    const unique = [...new Set(dates)].reverse();
    return unique;
  }

  // Filter history by date
  function filterHistory(data) {
    data = data.map((entry) => {
      const day = new Date(entry.timestamp);
      const date = day.toISOString().split("T")[0];
      return { ...entry, day: day, date: date };
    });
    return data.filter((entry) => entry.date === getHistoryDates()[historyIndex]);
  }

  // Update history feed
  async function updateHistory(returnOnlyFilteredHistory = false) {
    const filteredHistory = filterHistory(history);
    if (returnOnlyFilteredHistory) return filteredHistory;
    const date =
      filteredHistory[0] &&
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(filteredHistory[0]?.day);

    // Update history navigation
    document.getElementById("history-first").disabled = historyIndex === getHistoryDates().length - 1;
    document.getElementById("history-backward").disabled = historyIndex === getHistoryDates().length - 1;
    document.getElementById("history-forward").disabled = historyIndex === 0;
    document.getElementById("history-last").disabled = historyIndex === 0;
    document.getElementById("history-date").textContent = date;

    const feed = document.getElementById("history-feed");
    if (filteredHistory.length === 0) {
      feed.innerHTML = "<p>Submitted clicks will show up here!</p>";
      ui.reloadUnsavedInputs();
      return filteredHistory;
    }

    var sortedHistory = filteredHistory.sort((a, b) => a.timestamp - b.timestamp);
    feed.innerHTML = "";
    sortedHistory.forEach(r => {
      if (r.error) {
        console.log(r.error);
        return filteredHistory;
      }
      const button = document.createElement("button");
      button.id = r.id;
      button.classList = (r.status === "Incorrect") ? 'incorrect' : (r.status === "Correct") ? 'correct' : '';
      if (r.flagged) button.classList.add('flagged');
      var response = `<b>Status:</b> ${r.status.includes('Unknown') ? r.status.split('Unknown, ')[1] : r.status}${(r.reason) ? `</p>\n<p><b>Response:</b> ${r.reason}<br>` : ''}</p><button data-flag-response><i class="bi bi-flag-fill"></i> ${r.flagged ? 'Unflag Response' : 'Flag for Review'}</button>`;
      var questionNumber = questionsArray.find(question => String(question.id) === String(r.question_id)).number;
      switch (r.mode) {
        case 'latex':
          button.innerHTML = `${(String(r.seatCode) !== String(storage.get("code"))) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(r.seatCode.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${r.segment} Question #${questionNumber}.</b> ${unixToTimeString(r.timestamp)} (${r.seatCode})</p>\n${convertLatexToMarkup(r.response)}\n<p class="hint">(Equation may not display properly)</p>\n<p>${response}`;
          break;
        case 'array':
          button.innerHTML = `${(String(r.seatCode) !== String(storage.get("code"))) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(r.seatCode.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${r.segment} Question #${questionNumber}.</b> ${unixToTimeString(r.timestamp)} (${r.seatCode})</p>\n<p>${JSON.parse(`[${r.response.slice(1, -1).split(', ')}]`).join(', ')}</p>\n<p>${response}`;
          break;
        case 'matrix':
          button.innerHTML = `${(String(r.seatCode) !== String(storage.get("code"))) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(r.seatCode.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${r.segment} Question #${questionNumber}.</b> ${unixToTimeString(r.timestamp)} (${r.seatCode})</p>\n<p>${JSON.stringify(JSON.parse(r.response).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']')}</p>\n<p>${response}`;
          break;
        default:
          button.innerHTML = `${(String(r.seatCode) !== String(storage.get("code"))) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(r.seatCode.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${r.segment} Question #${questionNumber}.</b> ${unixToTimeString(r.timestamp)} (${r.seatCode})</p>\n<p>${escapeHTML(r.response)}</p>\n<p>${response}`;
          break;
      }
      feed.prepend(button);
      renderMathInElement(button);
      // Resubmit check
      button.addEventListener("click", async (event) => {
        if (event.target.hasAttribute('data-flag-response')) return r.flagged ? unflagResponse(event) : flagResponse(event);
        ui.view("");
        await resubmitCheck(r);
      });
    });
    if (sortedHistory.find(r => r.flagged)) {
      var p = document.createElement("p");
      p.classList = "flagged-response-alert";
      p.innerText = "You have flagged responses to review.";
      feed.prepend(p);
    }
    ui.reloadUnsavedInputs();
    return filteredHistory;
  }

  async function resubmitCheck(r) {
    questionInput.value = r.question_id;
    switch (r.mode) {
      case 'latex':
        answerMode("math");
        ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "math");
        mf.value = r.response;
        break;
      case 'array':
        answerMode("set");
        ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "set");
        resetSetInput();
        restoredSetType = "brackets";
        switch (r.response.slice(0, 1)) {
          case "<":
            restoredSetType = "vector";
            break;
          case "[":
            restoredSetType = "array";
            break;
          case "(":
            restoredSetType = "coordinate";
            break;
          case "⟨":
            restoredSetType = "product";
            break;
          default:
            break;
        };
        ui.setButtonSelectValue(document.getElementById("set-type-selector"), restoredSetType);
        var i = 0;
        JSON.parse(`[${r.response.slice(1, -1).split(', ')}]`).forEach(a => {
          setInputs = document.querySelectorAll("[data-set-input]");
          setInputs[i].value = a;
          i++;
          if (i < r.response.slice(1, -1).split(', ').length) addSet();
        });
        break;
      case 'matrix':
        answerMode("matrix");
        ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "matrix");
        resetMatrix();
        var rows = JSON.parse(r.response);
        if (rows.length != 2) {
          if (rows.length === 1) {
            removeRow();
          } else {
            for (let i = 0; i < rows.length - 2; i++) {
              addRow();
            }
          }
        }
        var columns = rows[0].length;
        if (columns != 2) {
          if (columns === 1) {
            removeColumn();
          } else {
            for (let i = 0; i < columns - 2; i++) {
              addColumn();
            }
          }
        }
        var matrixRows = document.querySelectorAll('#matrix [data-matrix-row]');
        for (let i = 0; i < rows.length; i++) {
          for (let j = 0; j < rows[i].length; j++) {
            matrixRows[i].querySelectorAll('[data-matrix-column]')[j].value = rows[i][j];
          }
        }
        matrixRows[matrixRows.length - 1].lastChild.focus();
        break;
      default:
        answerMode("input");
        var choice = escapeHTML(r.response).match(/^CHOICE ([A-E])$/);
        if (!choice) {
          answerInput.value = r.response;
        } else {
          document.querySelector(`[data-multiple-choice="${choice[1].toLowerCase()}"]`).click();
        }
        answerInput.focus();
        autocomplete.update();
        break;
    }
  }

  function flagResponse(event, isInQuestion = false) {
    event.srcElement.disabled = true;
    ui.setUnsavedChanges(true);
    fetch(domain + '/flag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("password"),
        question_id: event.srcElement.parentElement.id,
      }),
    })
      .then(q => q.json())
      .then(() => {
        ui.setUnsavedChanges(false);
        ui.toast("Flagged response for review.", 3000, "success", "bi bi-flag-fill");
        isInQuestion ? updateQuestion() : updateHistory();
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
      });
  }

  function unflagResponse(event, isInQuestion = false) {
    event.srcElement.disabled = true;
    ui.setUnsavedChanges(true);
    fetch(domain + '/unflag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("password"),
        question_id: event.srcElement.parentElement.id,
      }),
    })
      .then(q => q.json())
      .then(() => {
        ui.setUnsavedChanges(false);
        ui.toast("Unflagged response.", 3000, "success", "bi bi-flag-fill");
        isInQuestion ? updateQuestion() : updateHistory();
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
      });
  }

  const answerLabel = document.querySelector(`label[for="answer-input"]`);

  // Select answer mode
  document.getElementById("answer-mode-selector")?.addEventListener("input", (e) => {
    const mode = e.detail;
    answerMode(mode);
    if (mode === "input") {
      answerLabel.setAttribute("for", "answer-input");
    } else if (mode === "math") {
      answerLabel.setAttribute("for", "math-input");
    } else if (mode === "set") {
      answerLabel.setAttribute("for", "set-input");
    } else if (mode === "matrix") {
      answerLabel.setAttribute("for", "matrix");
    }
  });

  // Select attachments view mode
  document.getElementById("attachments-view-mode")?.addEventListener("input", (e) => {
    document.querySelector('.images').classList = `images ${e.detail}`;
  });

  // Select set type
  document.getElementById("set-type-selector")?.addEventListener("input", (e) => {
    const mode = e.detail;
    currentSetType = mode;
  });

  setInputs = document.querySelectorAll('[data-set-input]');

  // Add set input
  if (document.querySelector("[data-add-set-input]")) {
    document.querySelector("[data-add-set-input]").addEventListener("click", addSet);
  }

  function addSet() {
    setInputs = document.querySelectorAll('[data-set-input]');
    highestDataElement = null;
    setInputs.forEach(element => {
      if (highestDataElement === null || parseInt(element.getAttribute('data-set-input'), 10) > parseInt(highestDataElement.getAttribute('data-set-input'), 10)) highestDataElement = element;
    });
    if (highestDataElement !== null) {
      ui.setUnsavedChanges(true);
      var newSetInput = document.createElement('input');
      newSetInput.setAttribute('type', 'text');
      newSetInput.setAttribute('autocomplete', 'off');
      newSetInput.setAttribute('data-set-input', Number(highestDataElement.getAttribute('data-set-input')) + 1);
      const buttonGrid = document.querySelectorAll('[data-answer-mode="set"] .button-grid')[1];
      const insertBeforePosition = buttonGrid.children.length - 2;
      if (insertBeforePosition > 0) {
        buttonGrid.insertBefore(newSetInput, buttonGrid.children[insertBeforePosition]);
      } else {
        buttonGrid.appendChild(newSetInput);
      }
      document.querySelectorAll('[data-answer-mode="set"] .button-grid')[1].style.flexWrap = (setInputs.length > 9) ? 'wrap' : 'nowrap';
      newSetInput.focus();
      document.querySelector("[data-remove-set-input]").disabled = false;
    }
    ui.reloadUnsavedInputs();
  }

  // Remove set input
  if (document.querySelector("[data-remove-set-input]")) {
    document.querySelector("[data-remove-set-input]").addEventListener("click", removeSet);
  }

  function removeSet() {
    setInputs = document.querySelectorAll('[data-set-input]');
    if (setInputs.length > 1) {
      highestDataElement = null;
      setInputs.forEach(element => {
        if (highestDataElement === null || parseInt(element.getAttribute('data-set-input'), 10) > parseInt(highestDataElement.getAttribute('data-set-input'), 10)) highestDataElement = element;
      });
      if (highestDataElement !== null) highestDataElement.remove();
    }
    if (setInputs.length === 2) document.querySelector("[data-remove-set-input]").disabled = true;
    document.querySelectorAll('[data-answer-mode="set"] .button-grid')[1].style.flexWrap = (setInputs.length < 12) ? 'nowrap' : 'wrap';
  }

  function resetSetInput() {
    ui.setButtonSelectValue(document.getElementById("set-type-selector"), "brackets");
    document.querySelectorAll('[data-answer-mode="set"] .button-grid')[1].innerHTML = '<input type="text" autocomplete="off" id="set-input" data-set-input="1" /><button square data-add-set-input tooltip="Add Set Item"><i class="bi bi-plus"></i></button><button square data-remove-set-input disabled tooltip="Remove Set Item"><i class="bi bi-dash"></i></button>';
    if (document.querySelector("[data-add-set-input]")) {
      document.querySelector("[data-add-set-input]").addEventListener("click", addSet);
    }
    if (document.querySelector("[data-remove-set-input]")) {
      document.querySelector("[data-remove-set-input]").addEventListener("click", removeSet);
    }
  }

  // Add matrix column
  if (document.querySelector("[data-add-matrix-column]")) document.querySelector("[data-add-matrix-column]").addEventListener("click", addColumn);

  function addColumn() {
    var rows = [...document.getElementById('matrix').children];
    rows.forEach(row => {
      var newColumn = document.createElement('input');
      newColumn.setAttribute('type', 'text');
      newColumn.setAttribute('autocomplete', 'off');
      newColumn.setAttribute('data-matrix-column', row.children.length + 1);
      row.appendChild(newColumn);
    });
    rows[0].lastElementChild.focus();
    ui.setUnsavedChanges(true);
    var columns = document.querySelectorAll('#matrix [data-matrix-row]:first-child [data-matrix-column]');
    if (columns.length === 10) document.querySelector("[data-add-matrix-column]").disabled = true;
    document.querySelector("[data-remove-matrix-column]").disabled = false;
    ui.reloadUnsavedInputs();
  }

  // Remove matrix column
  if (document.querySelector("[data-remove-matrix-column]")) document.querySelector("[data-remove-matrix-column]").addEventListener("click", removeColumn);

  function removeColumn() {
    var rows = [...document.getElementById('matrix').children];
    rows.forEach(row => {
      var lastColumn = row.lastElementChild;
      if (lastColumn) lastColumn.remove();
    });
    if (rows[0].children.length < 10) document.querySelector("[data-add-matrix-column]").disabled = false;
    if (rows[0].children.length === 1) document.querySelector("[data-remove-matrix-column]").disabled = true;
  }

  // Add matrix row
  if (document.querySelector("[data-add-matrix-row]")) document.querySelector("[data-add-matrix-row]").addEventListener("click", addRow);

  function addRow() {
    var newRow = document.createElement('div');
    newRow.classList.add('row');
    newRow.setAttribute('data-matrix-row', document.querySelectorAll('[data-matrix-row]').length + 1);
    var columns = document.querySelectorAll('[data-matrix-row]:first-child [data-matrix-column]');
    columns.forEach(column => {
      var newColumn = document.createElement('input');
      newColumn.setAttribute('type', 'text');
      newColumn.setAttribute('autocomplete', 'off');
      newColumn.setAttribute('data-matrix-column', column.getAttribute('data-matrix-column'));
      newRow.appendChild(newColumn);
    });
    document.getElementById('matrix').appendChild(newRow);
    newRow.firstElementChild.focus();
    ui.setUnsavedChanges(true);
    var rows = document.querySelectorAll('[data-matrix-row]');
    if (rows.length === 10) document.querySelector("[data-add-matrix-row]").disabled = true;
    document.querySelector("[data-remove-matrix-row]").disabled = false;
    ui.reloadUnsavedInputs();
  }

  // Remove matrix row
  if (document.querySelector("[data-remove-matrix-row]")) document.querySelector("[data-remove-matrix-row]").addEventListener("click", removeRow);

  function removeRow() {
    var rows = document.querySelectorAll('[data-matrix-row]');
    if (rows.length > 1) {
      var lastRow = rows[rows.length - 1];
      lastRow.remove();
      if (rows.length < 10) document.querySelector("[data-add-matrix-row]").disabled = false;
      if (rows.length === 2) document.querySelector("[data-remove-matrix-row]").disabled = true;
    }
  }

  function resetMatrix() {
    var matrix = document.getElementById('matrix');
    matrix.innerHTML = '<div class="row" data-matrix-row="1"><input type="text" autocomplete="off" id="matrix-column" data-matrix-column="1" /><input type="text" autocomplete="off" id="matrix-column" data-matrix-column="2" /></div><div class="row" data-matrix-row="2"><input type="text" autocomplete="off" id="matrix-column" data-matrix-column="1" /><input type="text" autocomplete="off" id="matrix-column" data-matrix-column="2" /></div>';
    document.querySelectorAll('[data-answer-mode="matrix"] .button-grid')[1].innerHTML = '<button square data-add-matrix-column tooltip="Add Matrix Column"><i class="bi bi-arrow-90deg-left rotate-right"></i></button><button square data-remove-matrix-column tooltip="Remove Matrix Column"><i class="bi bi-x"></i></button>';
    document.querySelectorAll('[data-answer-mode="matrix"] .button-grid')[2].innerHTML = '<button square data-add-matrix-row tooltip="Add Matrix Row"><i class="bi bi-arrow-return-left"></i></button><button square data-remove-matrix-row tooltip="Remove Matrix Row"><i class="bi bi-x"></i></button>';
    if (document.querySelector("[data-add-matrix-column]")) document.querySelector("[data-add-matrix-column]").addEventListener("click", addColumn);
    if (document.querySelector("[data-remove-matrix-column]")) document.querySelector("[data-remove-matrix-column]").addEventListener("click", removeColumn);
    if (document.querySelector("[data-add-matrix-row]")) document.querySelector("[data-add-matrix-row]").addEventListener("click", addRow);
    if (document.querySelector("[data-remove-matrix-row]")) document.querySelector("[data-remove-matrix-row]").addEventListener("click", removeRow);
  }

  function toggleLayout() {
    const checker = document.getElementById('checker');
    if (!checker) return;
    checker.classList.toggle('horizontal');
    storage.set('layout', checker.classList.toString());
    auth.syncPush('layout');
  }

  async function updateNotifications(filteredHistory) {
    var notifications = ui.getNotifications();
    var notificationsToClear = notifications.filter(notification => filteredHistory.find(r => Number(r.question_id) === Number(notification)));
    if (notificationsToClear.length > 0) {
      await clearNotifications(notificationsToClear);
      await ui.setNotifications(notifications.filter(notification => !notificationsToClear.includes(notification)));
      await updateSegment(null, true);
    }
  }

  async function clearNotifications(notifications) {
    await fetch(domain + '/notifications', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("password"),
        question_ids: notifications
      }),
    });
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ clicker.js: ${error.message}`);
  };
  throw error;
};