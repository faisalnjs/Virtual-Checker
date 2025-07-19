/* eslint-disable no-extra-semi */
/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as auth from "/src/modules/auth.js";

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
  const frqInput = document.getElementById("frq-input");
  var frqParts = document.querySelectorAll(".frq-parts .part");
  var frqPartInputs = document.querySelectorAll(".frq-parts .part input");
  const questionImages = document.querySelector('.images');
  const nextQuestionButtons = document.querySelectorAll('[data-next-question]');
  const prevQuestionButtons = document.querySelectorAll('[data-prev-question]');
  var period = document.getElementById("period-input")?.value;

  var courses = [];
  let currentAnswerMode;
  let currentSetType = "brackets";
  let multipleChoice = null;
  let highestDataElement = null;
  let restoredSetType = "";

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
    document.getElementById("period-input").addEventListener("change", () => {
      document.getElementById("seat-grid").innerHTML = "";
      for (let col = 1; col <= 5; col++) {
        for (let row = 6; row > 0; row--) {
          period = document.getElementById("period-input").value;
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
    });
    if (document.querySelector('[data-logout]')) document.querySelector('[data-logout]').addEventListener('click', () => auth.logout(init));
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
    await updateCode();
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
    // Update history feed
    updateHistory();
    // Focus answer input
    document.getElementById("answer-suggestion").addEventListener("click", () => answerInput.focus());
    // Initialize questionsAnswered if not already set
    if (!storage.get("questionsAnswered")) storage.set("questionsAnswered", []);
    document.querySelector("[data-sync]").addEventListener("click", () => auth.syncManual());
    ui.reloadUnsavedInputs();
  };

  init();

  window.addEventListener('beforeunload', function (event) {
    if (!ui.unsavedChanges) return;
    const confirmationMessage = 'You have unsaved changes. Do you really want to leave?';
    event.returnValue = confirmationMessage;
    return confirmationMessage;
  });

  // Process check
  function processCheck(part = null) {
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
        } else if (mode === "frq") {
          if (part && document.querySelector(`[data-frq-part="${part}"]`)) {
            return document.querySelector(`[data-frq-part="${part}"]`).value?.trim();
          } else {
            return frqInput.value;
          };
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
        } else if (mode === "frq") {
          if (part) {
            if (document.querySelector(`[data-frq-part="${part}"]`).parentElement.nextElementSibling && (document.querySelector(`[data-frq-part="${part}"]`).parentElement.nextElementSibling.classList.contains('part'))) {
              document.querySelector(`[data-frq-part="${part}"]`).parentElement.nextElementSibling.querySelector('input').classList.add("attention");
              document.querySelector(`[data-frq-part="${part}"]`).parentElement.nextElementSibling.querySelector('input').focus();
            } else {
              document.querySelector(`[data-frq-part="${part}"]`).classList.add("attention");
              document.querySelector(`[data-frq-part="${part}"]`).focus();
            };
          } else {
            frqInput.classList.add("attention");
            frqInput.focus();
          };
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
      submitClick(storage.get("code"), segment, question, answer, mode, part);
    };
  };

  // Submit check
  document.getElementById("submit-button")?.addEventListener("click", () => processCheck());

  // Save check
  document.querySelectorAll(".frq-parts .part button").forEach(button => button.addEventListener("click", () => processCheck(button.getAttribute("data-save-part"))));

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
    frqInput.value = 4;
    // Switch input mode (exit multiple choice)
    answerMode(mode);
    multipleChoice = null;
    autocomplete.update();
    // Focus input element
    questionInput.focus();
  }

  // Check answer
  async function submitClick(code, segment, question, answer, mode, part) {
    var qA = storage.get("questionsAnswered") || [];
    var alreadyAnswered = qA.find(q => (String(q.segment) === String(segment)) && (String(q.question) === String(question)))
    if (alreadyAnswered && alreadyAnswered.status === 'Correct') {
      window.scroll(0, 0);
      ui.setUnsavedChanges(false);
      setTimeout(() => {
        document.getElementById("submit-button").disabled = false;
      }, 3000);
      return ui.modeless(`<i class="bi bi-exclamation-lg"></i>`, 'Already Correct');
    }
    ui.setUnsavedChanges(true);
    ui.toast("Submitting check...", 10000, "info", "bi bi-hourglass-split");
    await fetch(domain + '/check_answer', {
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
    })
      .then(r => r.json())
      .then(async r => {
        ui.setUnsavedChanges(false);
        window.scroll(0, 0);
        ui.clearToasts();
        if (typeof r.correct != 'undefined') {
          ui.modeless(`<i class="bi bi-${(r.correct) ? 'check' : 'x'}-lg"></i>`, (r.correct) ? 'Correct' : 'Try Again', r.reason || null);
          if (qA.find(q => (q.segment === segment) && (q.question === question))) {
            qA.find(q => (q.segment === segment) && (q.question === question)).status = (r.correct) ? 'Correct' : 'In Progress';
          } else {
            qA.push({ "segment": segment, "question": question, "status": (r.correct) ? 'Correct' : 'In Progress' });
          }
        } else if (typeof r.error != 'undefined') {
          ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, 'Error');
        } else {
          ui.modeless(`<i class="bi bi-hourglass"></i>`, "Submitted, Awaiting Scoring");
          if (qA.find(q => (q.segment === segment) && (q.question === question))) {
            qA.find(q => (q.segment === segment) && (q.question === question)).status = 'Pending';
          } else {
            qA.push({ "segment": segment, "question": question, "status": 'Pending' });
          }
        }
        storage.set("questionsAnswered", qA);
        await auth.syncPush("history");
        resetInputs();
        if ((typeof r.correct === 'undefined') || r.correct || (typeof r.error !== 'undefined')) {
          nextQuestion();
        } else {
          updateQuestion();
        }
        var storageClickMode = "text";
        if (mode === "math" && !multipleChoice) {
          storageClickMode = "latex";
        } else if (mode === "set" && !multipleChoice) {
          storageClickMode = "array";
        } else if (mode === "matrix" && !multipleChoice) {
          storageClickMode = "matrix";
        } else if (mode === "frq" && !multipleChoice) {
          storageClickMode = "frq";
        };
        await storeClick(storage.get("code"), segment, question, answer, r.reason, storageClickMode);
        if (mode === "frq") {
          if (part) {
            if (document.querySelector(`[data-frq-part="${part}"]`).parentElement.nextElementSibling && (document.querySelector(`[data-frq-part="${part}"]`).parentElement.nextElementSibling.classList.contains('part'))) {
              document.querySelector(`[data-frq-part="${part}"]`).parentElement.nextElementSibling.querySelector('input').focus();
            } else {
              document.querySelector(`[data-frq-part="${part}"]`).focus();
            };
          } else {
            frqInput.focus();
          };
        };
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
                updateCode();
                // Close all modals
                ui.view("");
                // Update URL parameters with seat code
                const params = new URLSearchParams(window.location.search);
                params.set("code", input);
                history.replaceState({}, "", "?" + params.toString());
                ui.setUnsavedChanges(false);
              },
              close: true,
            },
          ],
        });
      } else {
        storage.set("code", input);
        updateCode();
        // Close all modals
        ui.view("");
        // Update URL parameters with seat code
        const params = new URLSearchParams(window.location.search);
        params.set("code", input);
        history.replaceState({}, "", "?" + params.toString());
        ui.setUnsavedChanges(false);
      };
    } else {
      ui.alert("Error", "Seat code isn't possible");
    }
  }

  var questionsArray = [];
  var segmentsArray = [];

  // Update elements with new seat code
  async function updateCode() {
    const code = storage.get("code");
    if (code) {
      document.getElementById("code-input").value = storage.get("code");
      document.querySelectorAll("span.code").forEach((element) => {
        element.innerHTML = storage.get("code");
      });
      document.title = `Virtual Checker (${storage.get("code")})`;
      const periodRange = getExtendedPeriodRange(null, Number(code.slice(0, 1)));
      try {
        const coursesResponse = await fetch(`${domain}/courses`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        courses = await coursesResponse.json();
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
            document.querySelector('[data-syllabus-download]').removeAttribute('hidden', '');
            document.querySelector('[data-syllabus-download]').addEventListener('click', () => {
              window.open(course.syllabus, '_blank');
            });
          } else {
            document.querySelector('[data-syllabus-download]').setAttribute('hidden', '');
          }
        }
        const segmentsResponse = await fetch(`${domain}/segments?course=${course.id}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const segmentsData = await segmentsResponse.json();
        segments.innerHTML = '';
        segmentsArray = segmentsData;
        segmentsArray.sort((a, b) => a.order - b.order).forEach(segment => {
          const option = document.createElement('option');
          option.value = segment.id;
          const allQuestionsCorrect = (JSON.parse(segment.question_ids).length > 0) && JSON.parse(segment.question_ids).every(questionId => {
            const questionStatus = storage.get("questionsAnswered")?.find(q => (String(q.segment) === String(segment.id)) && (String(q.question) === String(questionId.id)))?.status;
            return questionStatus === 'Correct';
          });
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
        const questionsResponse = await fetch(`${domain}/questions`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        questionsArray = await questionsResponse.json();
        updateSegment();
        await auth.sync(false);
      } catch (error) {
        ui.view("api-fail");
      }
      ui.reloadUnsavedInputs();
    }
  }

  async function updateSegment() {
    const selectedSegment = segmentsArray.find(s => String(s.id) === String(segments.value));
    questions.innerHTML = '';
    if (!selectedSegment) return updateQuestion();
    JSON.parse(selectedSegment.question_ids).forEach(questionId => {
      if (questionsArray.find(q => String(q.id) === String(questionId.id))) {
        const questionOption = document.createElement('option');
        questionOption.value = questionId.id;
        questionOption.innerHTML = questionId.name;
        questions.append(questionOption);
      }
    });
    const qA = storage.get("questionsAnswered") || [];
    qA.forEach(q => {
      var i = questions.querySelector(`option[value="${q.question}"]`);
      const selectedSegment = segmentsArray.find(s => String(s.id) === String(segments.value));
      if (i) i.innerHTML = `${JSON.parse(selectedSegment.question_ids).find(q2 => String(q2.id) === String(q.question)).name} - ${q.status}`;
    });
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
    if ((questions.querySelectorAll('option').length > 0) && Array.from(questions.querySelectorAll('option')).every(option => {
      const questionId = option.value;
      const questionStatus = qA.find(q => (String(q.segment) === String(segments.value)) && (String(q.question) === String(questionId)))?.status;
      return questionStatus === 'Correct' || questionStatus === 'In Progress' || questionStatus === 'Pending';
    })) {
      document.getElementById("segment-completed").removeAttribute('hidden');
      questions.querySelectorAll('option').forEach(option => {
        const questionStatus = qA.find(q => (String(q.segment) === String(segments.value)) && (String(q.question) === String(option.value)))?.status;
        const li = document.createElement('li');
        if (questionStatus === 'Correct') {
          li.innerHTML = `<i class="bi bi-check-lg"></i> ${option.innerHTML}`;
        } else if (questionStatus === 'In Progress') {
          li.innerHTML = `<i class="bi bi-hourglass-split"></i> ${option.innerHTML}`;
        } else {
          li.innerHTML = `<i class="bi bi-hourglass"></i> ${option.innerHTML}`;
        }
        document.getElementById("segment-completed").querySelector('ul').append(li);
      });
    }
    if ((questions.querySelectorAll('option').length > 0) && Array.from(questions.querySelectorAll('option')).every(option => {
      const questionId = option.value;
      const questionStatus = qA.find(q => (String(q.segment) === String(segments.value)) && (String(q.question) === String(questionId)))?.status;
      return questionStatus === 'Correct';
    })) {
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
    if (!question) {
      questionImages.innerHTML = '<p style="margin-bottom: -12px;">There are no questions in this segment.</p>';
      document.getElementById('answer-mode-selector').setAttribute('hidden', '');
      return;
    }
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
    });
    mediumZoom(".images img", {
      background: "transparent"
    });
    const questionOptions = questions.querySelectorAll('option');
    const selectedQuestionOption = questions.querySelector('option:checked');

    if (questionOptions.length > 0) {
      const selectedQuestionOptionIndex = Array.from(questionOptions).indexOf(selectedQuestionOption);
      nextQuestionButtons.forEach(btn => btn.disabled = selectedQuestionOptionIndex === questionOptions.length - 1);
      prevQuestionButtons.forEach(btn => btn.disabled = selectedQuestionOptionIndex === 0);
      document.querySelector('.hiddenOnLoad:has(#answer-container)').classList.add('show');
      document.getElementById("submit-button").disabled = false;
    }

    await updateHistory();

    resetInputs();

    const feed = document.getElementById('question-history-feed');
    var latestResponses = (storage.get("history") || []).filter(r => (String(r.segment) === String(segments.value)) && (String(r.question) === String(question.id))).sort((a, b) => b.timestamp - a.timestamp);
    if (latestResponses.length > 0) {
      const fetchPromises = latestResponses.map(item =>
        fetch(`${domain}/response?seatCode=${item.code}&segment=${item.segment}&question=${item.question}&answer=${item.answer}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          }
        })
          .then(r => r.json())
          .then(r => ({ ...r, item }))
          .catch(e => {
            return { error: e, item };
          })
      );

      Promise.all(fetchPromises)
        .then(results => {
          feed.innerHTML = "";
          return results;
        })
        .then(results => {
          results.forEach(({ item, ...r }) => {
            if (r.error) {
              console.log(r.error);
              return;
            }
            const button = document.createElement("button");
            const latex = item.type === "latex";
            const array = item.type === "array";
            const matrix = item.type === "matrix";
            const frq = item.type === "frq";
            button.id = r.id;
            button.classList = (r.status === "Incorrect") ? 'incorrect' : (r.status === "Correct") ? 'correct' : '';
            if (String(r.flagged) === '1') button.classList.add('flagged');
            var response = `<b>Status:</b> ${r.status.includes('Unknown') ? r.status.split('Unknown, ')[1] : r.status} at ${unixToString(item.timestamp)}${(r.reason) ? `</p>\n<p><b>Response:</b> ${r.reason}<br>` : ''}</p><button data-flag-response><i class="bi bi-flag-fill"></i> ${(String(r.flagged) === '1') ? 'Unflag Response' : 'Flag for Review'}</button>`;
            item.number = questionsArray.find(question => question.id === Number(item.question)).number;
            if (!latex) {
              if (!array) {
                if (!matrix) {
                  if (!frq) {
                    button.innerHTML = `<p>${item.answer}</p>\n<p>${response}`;
                  } else {
                    button.innerHTML = `<p${item.answer}${(item.number === '1') ? '/9' : ''}</p>\n<p>${response}`;
                  }
                } else {
                  button.innerHTML = `<p>${JSON.stringify(JSON.parse(item.answer).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']')}</p>\n<p>${response}`;
                }
              } else {
                button.innerHTML = `<p>${JSON.parse(`[${item.answer.slice(1, -1).split(', ')}]`).join(', ')}</p>\n<p>${response}`;
              }
            } else {
              button.innerHTML = `${convertLatexToMarkup(item.answer)}\n<p class="hint">(Equation may not display properly)</p>\n<p>${response}`;
            }
            feed.prepend(button);
            renderMathInElement(button);
            // Resubmit check
            button.addEventListener("click", (event) => {
              if (event.target.hasAttribute('data-flag-response')) return (String(r.flagged) === '1') ? unflagResponse(event, true) : flagResponse(event, true);
              questionInput.value = item.question;
              if (latex) {
                answerMode("math");
                ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "math");
                mf.value = item.answer;
              } else if (array) {
                answerMode("set");
                ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "set");
                resetSetInput();
                restoredSetType = "brackets";
                switch (item.answer.slice(0, 1)) {
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
                JSON.parse(`[${item.answer.slice(1, -1).split(', ')}]`).forEach(a => {
                  setInputs = document.querySelectorAll("[data-set-input]");
                  setInputs[i].value = a;
                  i++;
                  if (i < item.answer.slice(1, -1).split(', ').length) addSet();
                });
              } else if (matrix) {
                answerMode("matrix");
                ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "matrix");
                resetMatrix();
                var rows = JSON.parse(item.answer);
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
              } else if (frq) {
                answerMode("frq");
                ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "frq");
                questionInput.value = '1';
                if (item.question === '1') {
                  frqInput.value = item.answer;
                  document.querySelector('[data-answer-mode="frq"] h1').innerText = item.answer;
                  frqInput.focus();
                } else {
                  if (document.querySelector(`[data-frq-part="${item.question}"]`)) {
                    document.querySelector(`[data-frq-part="${item.question}"]`).value = item.answer;
                    document.querySelector(`[data-frq-part="${item.question}"]`).focus();
                  } else {
                    while (!document.querySelector(`[data-frq-part="${item.question}"]`)) {
                      addPart();
                    };
                    document.querySelector(`[data-frq-part="${item.question}"]`).value = item.answer;
                    document.querySelector(`[data-frq-part="${item.question}"]`).focus();
                  };
                };
              } else {
                answerMode("input");
                const choice = item.answer.match(/^CHOICE ([A-E])$/);
                if (!choice) {
                  answerInput.value = item.answer;
                } else {
                  document.querySelector(`[data-multiple-choice="${choice[1].toLowerCase()}"]`).click();
                }
                questionInput.focus();
                autocomplete.update();
              }
              window.scrollTo(0, document.body.scrollHeight);
            });
          });
        })
        .then(() => {
          feedContainer.removeAttribute('hidden');
          feedContainer.classList.add('show');
          if (latestResponses.length > 2) {
            feed.style.maxHeight = `calc(${Array.from(feed.children).slice(-2).reduce((acc, el) => acc + el.offsetHeight, 0)}px + 0.25rem)`;
            feed.scrollTop = feed.scrollHeight;
          }
        })
    } else {
      feedContainer.classList.remove('show');
    }

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

  function nextQuestion() {
    const questionOptions = questions.querySelectorAll('option');
    const selectedQuestionOption = questions.querySelector('option:checked');
    const selectedQuestionOptionIndex = Array.from(questionOptions).indexOf(selectedQuestionOption);
    if (selectedQuestionOptionIndex < questionOptions.length - 1) {
      questionOptions[selectedQuestionOptionIndex + 1].selected = true;
      updateQuestion();
    } else if ((questionOptions.length > 0) && Array.from(questionOptions).every(option => {
      const questionId = option.value;
      const questionStatus = storage.get("questionsAnswered")?.find(q => (String(q.segment) === String(segments.value)) && (String(q.question) === String(questionId)))?.status;
      return questionStatus === 'Correct' || questionStatus === 'In Progress' || questionStatus === 'Pending';
    })) {
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

  // Store click to storage and history
  async function storeClick(code, segment, question, answer, reason, type) {
    ui.setUnsavedChanges(true);
    const history = storage.get("history") || [];
    const timestamp = Date.now();
    history.push({
      "code": code,
      "segment": segment,
      "question": question,
      "answer": answer,
      "reason": reason,
      "timestamp": timestamp,
      "type": type || "text",
    });
    storage.set("history", history);
    await auth.syncPush("history");
    updateHistory();
    ui.setUnsavedChanges(false);
  }

  document.getElementById("history-first")?.addEventListener("click", () => {
    historyIndex = getHistoryDates().length - 1;
    updateHistory();
  });

  document.getElementById("history-backward")?.addEventListener("click", () => {
    historyIndex++;
    updateHistory();
  });

  document.getElementById("history-forward")?.addEventListener("click", () => {
    historyIndex--;
    updateHistory();
  });

  document.getElementById("history-last")?.addEventListener("click", () => {
    historyIndex = 0;
    updateHistory();
  });

  // Count number of unique days
  function getHistoryDates() {
    const data = (storage.get("history") || []).map((entry) => {
      const day = entry.timestamp;
      const date = new Date(entry.timestamp).toISOString().split("T")[0];
      return { ...entry, day: day, date: date };
    });
    const unique = data
      .map((entry) => entry.date)
      .filter((value, i, array) => {
        return array.indexOf(value) === i;
      })
      .reverse();
    return unique;
  }

  // Filter history by date
  function filterHistory() {
    const data = (storage.get("history") || []).map((entry) => {
      const day = entry.timestamp;
      const date = new Date(entry.timestamp).toISOString().split("T")[0];
      return { ...entry, day: day, date: date };
    });
    return data.filter((entry) => entry.date === getHistoryDates()[historyIndex]);
  }

  // Update history feed
  async function updateHistory() {
    const history = filterHistory();
    const date =
      history[0] &&
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(history[0]?.day);

    // Update history navigation
    document.getElementById("history-first").disabled = historyIndex === getHistoryDates().length - 1;
    document.getElementById("history-backward").disabled = historyIndex === getHistoryDates().length - 1;
    document.getElementById("history-forward").disabled = historyIndex === 0;
    document.getElementById("history-last").disabled = historyIndex === 0;
    document.getElementById("history-date").textContent = date;

    const feed = document.getElementById("history-feed");
    if (history.length === 0) {
      feed.innerHTML = "<p>Submitted clicks will show up here!</p>";
      ui.reloadUnsavedInputs();
      return;
    }
    var qA = storage.get("questionsAnswered") || [];

    const questionsResponse = await fetch(`${domain}/questions`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    questionsArray = await questionsResponse.json();

    const fetchPromises = history.sort((a, b) => a.timestamp - b.timestamp).map(item =>
      fetch(`${domain}/response?seatCode=${item.code}&segment=${item.segment}&question=${item.question}&answer=${item.answer}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        }
      })
        .then(r => r.json())
        .then(r => ({ ...r, item }))
        .catch(e => {
          return { error: e, item };
        })
    );

    await Promise.all(fetchPromises)
      .then(results => {
        feed.innerHTML = "";
        return results;
      })
      .then(results => {
        results.forEach(({ item, ...r }) => {
          if (r.error) {
            console.log(r.error);
            return;
          }
          const button = document.createElement("button");
          const latex = item.type === "latex";
          const array = item.type === "array";
          const matrix = item.type === "matrix";
          const frq = item.type === "frq";
          button.id = r.id;
          button.classList = (r.status === "Incorrect") ? 'incorrect' : (r.status === "Correct") ? 'correct' : '';
          if (String(r.flagged) === '1') button.classList.add('flagged');
          var response = `<b>Status:</b> ${r.status.includes('Unknown') ? r.status.split('Unknown, ')[1] : r.status}${(r.reason) ? `</p>\n<p><b>Response:</b> ${r.reason}<br>` : ''}</p><button data-flag-response><i class="bi bi-flag-fill"></i> ${(String(r.flagged) === '1') ? 'Unflag Response' : 'Flag for Review'}</button>`;
          item.number = questionsArray.find(question => question.id === Number(item.question)).number;
          if (!latex) {
            if (!array) {
              if (!matrix) {
                if (!frq) {
                  button.innerHTML = `${(item.code !== storage.get("code")) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(item.code.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${item.segment} Question #${item.number}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n<p>${item.answer}</p>\n<p>${response}`;
                } else {
                  button.innerHTML = `${(item.code !== storage.get("code")) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(item.code.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${item.segment} Question #${item.number}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n<p>${item.answer}${(item.number === '1') ? '/9' : ''}</p>\n<p>${response}`;
                }
              } else {
                button.innerHTML = `${(item.code !== storage.get("code")) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(item.code.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${item.segment} Question #${item.number}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n<p>${JSON.stringify(JSON.parse(item.answer).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']')}</p>\n<p>${response}`;
              }
            } else {
              button.innerHTML = `${(item.code !== storage.get("code")) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(item.code.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${item.segment} Question #${item.number}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n<p>${JSON.parse(`[${item.answer.slice(1, -1).split(', ')}]`).join(', ')}</p>\n<p>${response}`;
            }
          } else {
            button.innerHTML = `${(item.code !== storage.get("code")) ? `<p><b>${courses.find(c => JSON.parse(c.periods).includes(Number(item.code.slice(0, 1))))?.name}</b></p>\n` : ''}<p><b>Segment ${item.segment} Question #${item.number}.</b> ${unixToTimeString(item.timestamp)} (${item.code})</p>\n${convertLatexToMarkup(item.answer)}\n<p class="hint">(Equation may not display properly)</p>\n<p>${response}`;
          }
          feed.prepend(button);
          renderMathInElement(button);
          // Resubmit check
          button.addEventListener("click", (event) => {
            if (event.target.hasAttribute('data-flag-response')) return (String(r.flagged) === '1') ? unflagResponse(event) : flagResponse(event);
            questionInput.value = item.question;
            ui.view("");
            if (latex) {
              answerMode("math");
              ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "math");
              mf.value = item.answer;
            } else if (array) {
              answerMode("set");
              ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "set");
              resetSetInput();
              restoredSetType = "brackets";
              switch (item.answer.slice(0, 1)) {
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
              JSON.parse(`[${item.answer.slice(1, -1).split(', ')}]`).forEach(a => {
                setInputs = document.querySelectorAll("[data-set-input]");
                setInputs[i].value = a;
                i++;
                if (i < item.answer.slice(1, -1).split(', ').length) addSet();
              });
            } else if (matrix) {
              answerMode("matrix");
              ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "matrix");
              resetMatrix();
              var rows = JSON.parse(item.answer);
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
            } else if (frq) {
              answerMode("frq");
              ui.setButtonSelectValue(document.getElementById("answer-mode-selector"), "frq");
              questionInput.value = '1';
              if (item.question === '1') {
                frqInput.value = item.answer;
                document.querySelector('[data-answer-mode="frq"] h1').innerText = item.answer;
                frqInput.focus();
              } else {
                if (document.querySelector(`[data-frq-part="${item.question}"]`)) {
                  document.querySelector(`[data-frq-part="${item.question}"]`).value = item.answer;
                  document.querySelector(`[data-frq-part="${item.question}"]`).focus();
                } else {
                  while (!document.querySelector(`[data-frq-part="${item.question}"]`)) {
                    addPart();
                  };
                  document.querySelector(`[data-frq-part="${item.question}"]`).value = item.answer;
                  document.querySelector(`[data-frq-part="${item.question}"]`).focus();
                };
              };
            } else {
              answerMode("input");
              const choice = item.answer.match(/^CHOICE ([A-E])$/);
              if (!choice) {
                answerInput.value = item.answer;
              } else {
                document.querySelector(`[data-multiple-choice="${choice[1].toLowerCase()}"]`).click();
              }
              questionInput.focus();
              autocomplete.update();
            }
          });
          if (qA.find(q => (q.segment === item.segment) && (q.question === item.question))) qA.find(q => (q.segment === item.segment) && (q.question === item.question)).status = (r.status.includes("Recorded")) ? "Pending" : r.status;
        });
        if (results.find(({ item, ...r }) => String(r.flagged) === '1')) {
          var p = document.createElement("p");
          p.classList = "flagged-response-alert";
          p.innerText = "You have flagged responses to review.";
          feed.prepend(p);
        }
      }).then(async () => {
        storage.set("questionsAnswered", qA);
      });
    qA.forEach(q => {
      var i = questions.querySelector(`option[value="${q.question}"]`);
      const selectedSegment = segmentsArray.find(s => String(s.id) === String(segments.value));
      if (i) i.innerHTML = `${JSON.parse(selectedSegment.question_ids).find(q2 => String(q2.id) === String(q.question)).name} - ${q.status}`;
    });
    ui.reloadUnsavedInputs();
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
        question_id: event.srcElement.parentElement.id,
        seatCode: storage.get("code"),
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
        question_id: event.srcElement.parentElement.id,
        seatCode: storage.get("code"),
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
  if (document.getElementById("answer-mode-selector")) {
    document.getElementById("answer-mode-selector").addEventListener("input", (e) => {
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
      } else if (mode === "frq") {
        answerLabel.setAttribute("for", "frq-input");
      }
    });
  }

  // Select set type
  if (document.getElementById("set-type-selector")) {
    document.getElementById("set-type-selector").addEventListener("input", (e) => {
      const mode = e.detail;
      currentSetType = mode;
    });
  }

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

  // Change FRQ choice
  frqInput?.addEventListener("change", (input) => {
    ui.setUnsavedChanges(true);
    document.querySelector('[data-answer-mode="frq"] h1').innerText = input.target.value;
  });

  frqInput?.addEventListener("input", (input) => {
    ui.setUnsavedChanges(true);
    document.querySelector('[data-answer-mode="frq"] h1').innerText = input.target.value;
  });

  // Add FRQ part
  if (document.querySelector("[data-add-frq-part]")) document.querySelector("[data-add-frq-part]").addEventListener("click", addPart);

  function addPart() {
    ui.setUnsavedChanges(true);
    frqPartInputs = document.querySelectorAll('.frq-parts .part input');
    highestDataElement = frqPartInputs[frqPartInputs.length - 1];
    var newPartLetter = String.fromCharCode(highestDataElement.getAttribute('data-frq-part').charCodeAt(0) + 1);
    var newFRQPart = document.createElement('div');
    newFRQPart.classList = 'part';
    newFRQPart.innerHTML = `<div class="prefix">${newPartLetter}.</div>
          <input type="text" autocomplete="off" data-frq-part="${newPartLetter}" />
          <button data-save-part="${newPartLetter}">Save</button>`;
    document.querySelector('.frq-parts').insertBefore(newFRQPart, document.querySelector('.frq-parts').children[document.querySelector('.frq-parts').children.length - 1]);
    frqParts = document.querySelectorAll('.frq-parts .part');
    highestDataElement = frqParts[frqParts.length - 1];
    highestDataElement.querySelector('button').addEventListener("click", () => processCheck(newPartLetter))
    highestDataElement.querySelector('input').focus();
    document.querySelector("[data-remove-frq-part]").disabled = false;
    if (newPartLetter === 'z') document.querySelector("[data-add-frq-part]").disabled = true;
    ui.reloadUnsavedInputs();
  }

  // Remove FRQ part
  if (document.querySelector("[data-remove-frq-part]")) {
    document.querySelector("[data-remove-frq-part]").addEventListener("click", removePart);
  }

  function removePart() {
    frqParts = document.querySelectorAll('.frq-parts .part');
    if (frqParts.length > 4) frqParts[frqParts.length - 1].remove();
    if (frqParts.length === 5) document.querySelector("[data-remove-frq-part]").disabled = true;
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
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ clicker.js: ${error.message}`);
  };
  throw error;
};