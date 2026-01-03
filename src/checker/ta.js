/* eslint-disable no-unused-vars */
/* eslint-disable no-unreachable */
/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as auth from "/src/modules/auth.js";
import island from "/src/modules/island.js";
import Element from "/src/modules/element.js";
import { convertLatexToMarkup, renderMathInElement } from "mathlive";
import Quill from "quill";
import "faz-quill-emoji/autoregister";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;
if (window.location.pathname.split('?')[0].endsWith('/ta')) window.location.pathname = '/ta/';
const params = Object.fromEntries((new URL(location)).searchParams);

var period = document.getElementById("period-input")?.value;

var courses = [];
var segments = [];
var questions = [];
var answers = [];
var responses = [];
var formData = new FormData();
var active = false;
var timestamps = false;
var noReloadCourse = false;
var renderedEditors = {};
var lastMarkedQuestion = {};
var pagination = {
  awaitingResponses: { page: 0, perPage: 25 },
  responses: { page: 0, perPage: 25 },
  questions: { page: 0, perPage: 25 },
};
var keepSegment = null;
var fromAwaitingScoring = false;

try {
  async function init() {
    if (!storage.get("code")) return window.location.href = '/';
    if (!storage.get("pwd")) return auth.ta(init);
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

    // Show clear data fix guide
    // if (storage.get("created")) {
    //   document.querySelector(`[data-modal-view="clear-data-fix"]`).remove();
    // } else {
    //   storage.set("created", Date.now());
    // }

    if (!(await auth.bulkLoad(["courses", "segments", "questions", "answers", "responses"], storage.get("code"), storage.get("pwd"), false, true, () => {
      auth.ta(init);
    }))) return;
    await storage.idbReady;
    const bulkLoad = (await storage.idbGet('adminCache')) || storage.get("adminCache") || {};
    courses = bulkLoad.courses;
    segments = bulkLoad.segments;
    questions = bulkLoad.questions;
    answers = bulkLoad.answers;
    responses = bulkLoad.responses;
    await auth.loadAdminSettings(courses);
    if (document.getElementById("course-period-input") && !noReloadCourse) {
      document.getElementById("course-period-input").innerHTML = "";
      courses.sort((a, b) => a.id - b.id).forEach(course => {
        var coursePeriods = JSON.parse(course.periods);
        const option = document.createElement("option");
        option.value = course.id;
        option.innerHTML = document.getElementById("course-input") ? course.name : `${course.name}${(coursePeriods.length > 0) ? ` (Period${(coursePeriods.length > 1) ? 's' : ''} ${coursePeriods.join(', ')})` : ''}`;
        document.getElementById("course-period-input").appendChild(option);
      });
    }
    document.getElementById("course-period-input")?.addEventListener("input", updateCourses);
    document.getElementById("course-period-input")?.addEventListener("change", updateResponses);
    document.getElementById("filter-segment-input").addEventListener("change", updateResponses);
    document.getElementById("sort-question-input")?.addEventListener("input", updateResponses);
    document.getElementById("sort-seat-input")?.addEventListener("input", updateResponses);
    if (document.getElementById("filter-segment-input")) updateCourses();
    if (responses.find(response => String(response.seatCode).includes('xx'))) document.getElementById("checker").classList.add("anonymous");
    if (document.querySelector('.questions.section')) {
      await updateQuestions();
      if (params?.question) toggleQuestion(null, params.question);
    }
    if (document.getElementById("course-period-input") && !noReloadCourse) document.getElementById("course-period-input").value = (storage.get('period') && courses.find(c => String(c.id) === String(storage.get('period')))) ? storage.get('period') : (((ui.defaultCourse !== null) && courses.find(c => String(c.id) === String(ui.defaultCourse))) ? ui.defaultCourse : courses.find(c => JSON.parse(c.periods).includes(Number(String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0]?.seatCode)[0]))) ? courses.find(c => JSON.parse(c.periods).includes(Number(String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0]?.seatCode)[0]))).id : 0);
    if (document.getElementById("course-period-input")) await updateResponses();
    active = true;
    ui.stopLoader();
    ui.toast("Data restored.", 1000, "info", "bi bi-cloud-arrow-down");
    if (document.getElementById("sort-question-input")) document.getElementById("filter-segment-input").addEventListener("change", () => {
      document.getElementById("sort-question-input").value = "";
      const event = new Event('input', { bubbles: true });
      document.getElementById("sort-question-input").dispatchEvent(event);
    });
    ui.reloadUnsavedInputs();
  }

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

  document.querySelectorAll('#previous-page-button').forEach(a => a.addEventListener("click", () => previousPage(a)));
  document.querySelectorAll('#next-page-button').forEach(a => a.addEventListener("click", () => nextPage(a)));
  document.querySelectorAll('#first-page-button').forEach(a => a.addEventListener("click", () => firstPage(a)));
  document.querySelectorAll('#last-page-button').forEach(a => a.addEventListener("click", () => lastPage(a)));

  // Limit seat code input to integers
  document.getElementById("code-input")?.addEventListener("input", (e) => {
    e.target.value = parseInt(e.target.value) || "";
  });

  // Save seat code on enter
  document.getElementById("code-input")?.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
      e.preventDefault();
      setTimeout(() => {
        saveCode();
      }, 100);
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
        var reservedSeatCodeModal = ui.modal({
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
        reservedSeatCodeModal.querySelector('.submit-button').focus();
      } else {
        // Close all modals
        ui.view("");
        storage.set("code", input);
        init();
        // Update URL parameters with seat code
        const params = new URLSearchParams(window.location.search);
        params.set("code", input);
        ui.setUnsavedChanges(false);
      }
    } else {
      ui.alert("Error", "Seat code isn't possible");
    }
  }

  document.querySelector('[data-timestamps]')?.addEventListener("click", toggleTimestamps);

  function toggleSelected() {
    if (!active) return;
    if (this.parentElement.parentElement.classList.contains('selecting')) {
      this.parentElement.classList.toggle('selected');
    } else {
      this.parentElement.parentElement.classList.toggle('selected');
    }
  }

  function toggleTimestamps() {
    if (!active) return;
    if (timestamps) {
      timestamps = false;
      document.querySelector('[data-timestamps] .bi-clock').style.display = "block";
      document.querySelector('[data-timestamps] .bi-clock-fill').style.display = "none";
      document.querySelector('#checker').classList.remove('timestamps');
    } else {
      timestamps = true;
      document.querySelector('[data-timestamps] .bi-clock').style.display = "none";
      document.querySelector('[data-timestamps] .bi-clock-fill').style.display = "block";
      document.querySelector('#checker').classList.add('timestamps');
    }
  }

  function updateCourses() {
    if (document.getElementById("filter-segment-input")) {
      document.getElementById("filter-segment-input").innerHTML = '<option value="" selected>#</option>';
      var filteredSegments = segments;
      const course = courses.find(c => document.getElementById("course-period-input") ? (String(c.id) === document.getElementById("course-period-input").value) : null);
      if (course) filteredSegments = filteredSegments.filter(segment => String(segment.course) === String(course.id));
      filteredSegments.forEach(segment => {
        document.getElementById("filter-segment-input").innerHTML += `<option value="${segment.id}" ${(document.location.search.split('?segment=')[1] && (document.location.search.split('?segment=')[1] === String(segment.id))) ? 'selected' : ''}>${segment.number} - ${segment.name}${segment.due ? ` (Due ${new Date(`${segment.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })})` : ''}</option>`;
      });
      if (keepSegment) document.getElementById("filter-segment-input").value = keepSegment;
      keepSegment = null;
    }
  }// Save
  document.querySelectorAll("#save-button").forEach(w => w.addEventListener("click", save));

  async function save(event, hideResult) {
    if (!active) return;
    if (!ui.unsavedChanges) {
      if (!hideResult) ui.toast("No changes to save.", 5000, "error", "bi bi-exclamation-triangle-fill");
      return;
    }
    var updatedInfo = {};
    if (document.querySelector('.questions.section')) {
      updatedInfo = {
        questions: []
      };
      if (document.getElementById("filter-segment-input").value) updatedInfo.segment = document.getElementById("filter-segment-input").value || null;
      var newQuestions = questions.map(q => {
        var allSegmentsQuestionIsIn = segments.filter(e => JSON.parse(e.question_ids).find(qId => String(qId.id) === String(q.id)));
        return {
          ...q,
          segment: segments.find(s => allSegmentsQuestionIsIn[0] && (allSegmentsQuestionIsIn[0].id === s.id))?.id ? Number(segments.find(s => allSegmentsQuestionIsIn[0] && (allSegmentsQuestionIsIn[0].id === s.id))?.id) : null,
          correctAnswers: answers.find(a => a.id === q.id)?.correct_answers || [],
          incorrectAnswers: answers.find(a => a.id === q.id)?.incorrect_answers || [],
          modifiedAnswers: false,
        };
      });
      Array.from(document.querySelectorAll('.questions .section .section'))
        .filter(w => w.id)
        .forEach(question => {
          if (!newQuestions.find(q => String(q.id) === question.id.split('-')[1])) return;
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).number = question.querySelector('#question-number-input').value;
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).segment = question.querySelector('#question-segment-input').value;
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).question = question.querySelector('#question-text-input').value;
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).stem = question.querySelector('#question-stem-input')?.value || null;
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).nonscored = question.querySelector('#question-nonscored-input')?.value || null;
          if (renderedEditors[Number(question.id.split('-')[1])]) newQuestions.find(q => String(q.id) === question.id.split('-')[1]).description = JSON.stringify(renderedEditors[Number(question.id.split('-')[1])].getContents());
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).images = Array.from(question.querySelectorAll('.attachments .image > *')).map(q => {
            return q.getAttribute('data-src');
          });
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).correctAnswers = Array.from(question.querySelectorAll('#question-correct-answer-input')).map(q => {
            return q.value;
          });
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).incorrectAnswers = Array.from(question.querySelectorAll('.incorrectAnswers .inputs')).map(q => {
            return {
              answer: q.querySelector('#question-incorrect-answer-input').value,
              reason: q.querySelector('#question-incorrect-answer-reason-input').value
            };
          });
          newQuestions.find(q => String(q.id) === question.id.split('-')[1]).latex = question.querySelector('[data-toggle-latex] i')?.classList.contains('bi-calculator-fill') || false;
          if (question.getAttribute('modified')) newQuestions.find(q => String(q.id) === question.id.split('-')[1]).modifiedAnswers = true;
        });
      var editedQuestions = [];
      newQuestions.forEach(q => {
        var changed = false;
        if (q.modifiedAnswers) changed = true;
        if (changed) editedQuestions.push(q);
      });
      updatedInfo.questions = editedQuestions;
      updatedInfo.edited_only = true;
      if (!editedQuestions.length) {
        if (!hideResult) ui.toast("No changes to save.", 5000, "error", "bi bi-exclamation-triangle-fill");
        return;
      }
    }
    for (const key in updatedInfo) {
      if (Object.prototype.hasOwnProperty.call(updatedInfo, key)) {
        formData.append(key, (typeof updatedInfo[key] === 'string') ? updatedInfo[key] : JSON.stringify(updatedInfo[key]));
      }
    }
    formData.append('usr', storage.get("code"));
    formData.append('pwd', storage.get("password"));
    ui.setUnsavedChanges(true);
    keepSegment = document.getElementById("filter-segment-input")?.value || null;
    fetch(domain + '/save?ta=true', {
      method: "POST",
      body: formData,
    })
      .then(async r => {
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
      })
      .then(() => {
        ui.setUnsavedChanges(false);
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
    document.querySelectorAll("#save-button").forEach(w => w.disabled = true);
    window.scroll(0, 0);
    if (typeof hideResult != 'boolean') ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
    await init();
    setTimeout(() => {
      document.querySelectorAll("#save-button").forEach(w => w.disabled = false);
    }, 2500);
  }

  async function updateQuestions() {
    if (questions.length > 0) {
      if (document.querySelector('.questions .section')) {
        var filteredQuestions = questions;
        if (document.getElementById("filter-segment-input")) {
          var selectedSegment = segments.find(segment => String(segment.id) === document.getElementById("filter-segment-input").value);
          if (selectedSegment) filteredQuestions = filteredQuestions.filter(q => JSON.parse(selectedSegment.question_ids).find(qId => String(qId.id) === String(q.id)));
        }
        if (this && (this.id === 'filter-segment-input')) pagination.questions.page = 0;
        pagination.questions.total = filteredQuestions.length;
        if (document.querySelector('.questions #current-page')) {
          const currentPage = document.querySelector('.questions #current-page');
          const input = currentPage.querySelector('.current-page-input');
          const totalSpan = currentPage.querySelector('.current-page-total');
          const totalPages = Math.max(1, Math.ceil((pagination.questions.total || 0) / (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.questions.perPage)));
          if (input) input.value = Math.min(Math.max(1, pagination.questions.page + 1), totalPages);
          if (totalSpan) totalSpan.innerText = totalPages;
          if (input && !input._pageHandlerAttached) {
            input.addEventListener('change', (e) => {
              let v = parseInt(e.target.value) || 1;
              if (v < 1) v = 1;
              if (v > totalPages) v = totalPages;
              e.target.value = v;
              goToPage(document.querySelector('.questions .pagination'), v - 1);
            });
            input._pageHandlerAttached = true;
          }
        }
        var currentPageQuestions = filteredQuestions.slice(pagination.questions.page * (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.questions.perPage), (pagination.questions.page + 1) * (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.questions.perPage));
        syncPagination();
        renderedEditors = {};
        document.querySelector('.questions .section').innerHTML = '';
        currentPageQuestions.forEach(q => {
          const isStem = questions.find(question1 => String(question1.stem || '') === String(q.id)) ? true : false;
          var question = document.createElement('div');
          question.className = "section";
          question.id = `question-${q.id}`;
          var buttonGrid = document.createElement('div');
          buttonGrid.className = "button-grid inputs";
          var allSegmentsQuestionIsIn = segments.filter(e => JSON.parse(e.question_ids).find(qId => String(qId.id) === String(q.id)));
          var segmentsString = "";
          segments.forEach(s => {
            segmentsString += `<option value="${s.id}"${(allSegmentsQuestionIsIn[0] && (allSegmentsQuestionIsIn[0].id === s.id)) ? ' selected' : ''}>${s.number}</option>`;
          });
          buttonGrid.innerHTML = `<button square data-select tooltip="Select Question"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="${q.id}" disabled /></div></div><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="${q.number}" placeholder="${q.number}" disabled /></div></div><div class="input-group small ${isStem ? 'hidden' : ''}"><div class="space" id="question-container"><select id="question-segment-input" disabled>${segmentsString}</select></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="${q.question}" placeholder="${q.question}" disabled /></div></div>`;
          if (window.innerWidth >= 1000) {
            buttonGrid.addEventListener('mouseenter', () => {
              var question = q;
              island(buttonGrid, filteredQuestions, 'question', {
                sourceId: String(question.id),
                id: `ID ${question.id}`,
                title: `Question ${question.number}`,
                subtitle: `${question.question}`,
                subtitleLatex: question.latex,
                description: question.description,
                attachments: question.images,
                lists: [
                  {
                    title: 'Correct Answers',
                    items: answers.find(a => a.id === question.id)?.correct_answers
                  },
                  {
                    title: 'Incorrect Answers',
                    items: answers.find(a => a.id === question.id)?.incorrect_answers
                  },
                ],
              }, answers);
            });
            buttonGrid.addEventListener('mouseleave', () => {
              island();
            });
          }
          question.appendChild(buttonGrid);
          var questionMathRendering = document.createElement('div');
          questionMathRendering.classList = `renderedMath${q.latex ? ' show' : ''}`;
          questionMathRendering.innerHTML = convertLatexToMarkup(q.question);
          renderMathInElement(questionMathRendering);
          question.appendChild(questionMathRendering);
          buttonGrid.querySelector("#question-text-input").addEventListener('input', (e) => {
            questionMathRendering.innerHTML = convertLatexToMarkup(e.target.value);
            renderMathInElement(questionMathRendering);
          });
          if (!isStem) {
            var buttonGrid2 = document.createElement('div');
            buttonGrid2.className = "button-grid stem-container";
            var stemSelectContainer = document.createElement('div');
            var stemLabel = document.createElement('label');
            stemLabel.innerText = "Stem"
            stemSelectContainer.appendChild(stemLabel);
            var stemSelect = document.createElement('select');
            stemSelect.id = "question-stem-input";
            stemSelect.classList = "stem-select";
            stemSelect.disabled = true;
            stemSelect.innerHTML = `<option value=""${!q.stem ? ' selected' : ''}>No Stem</option>` + questions.filter(question1 => String(question1.id) !== String(q.id)).map(question1 => `<option value="${question1.id}"${(String(q.stem || '') === String(question1.id)) ? ' selected' : ''}>${question1.number}: ${question1.question}</option>`).join('');
            stemSelectContainer.appendChild(stemSelect);
            buttonGrid2.appendChild(stemSelectContainer);
            stemSelect.addEventListener('change', () => {
              question.setAttribute('modified', 'true');
            });
            var nonScoredContainer = document.createElement('div');
            nonScoredContainer.style.minWidth = "156px";
            var nonScoredLabel = document.createElement('label');
            nonScoredLabel.innerText = "Scored"
            nonScoredContainer.appendChild(nonScoredLabel);
            var nonScoredSelect = document.createElement('select');
            nonScoredSelect.id = "question-nonscored-input";
            nonScoredSelect.classList = "stem-select";
            nonScoredSelect.disabled = true;
            nonScoredSelect.innerHTML = `<option value="0"${!q.nonscored ? ' selected' : ''}>Yes</option><option value="1"${q.nonscored ? ' selected' : ''}>No</option>`;
            nonScoredContainer.appendChild(nonScoredSelect);
            buttonGrid2.appendChild(nonScoredContainer);
            nonScoredSelect.addEventListener('change', () => {
              question.setAttribute('modified', 'true');
            });
            question.appendChild(buttonGrid2);
          }
          var textareaContainer = document.createElement('div');
          textareaContainer.classList = "description";
          var textarea = document.createElement('div');
          textarea.classList.add('textarea');
          textarea.setAttribute('content', q.description || '');
          textarea.disabled = true;
          textareaContainer.appendChild(textarea);
          question.appendChild(textareaContainer);
          var images = document.createElement('div');
          images.classList = "attachments";
          JSON.parse(q.images).forEach(q => {
            var image = document.createElement('div');
            image.classList = "image";
            image.innerHTML = `<img data-src="${q}" />`;
            images.appendChild(image);
          });
          question.appendChild(images);
          if (isStem) {
            var isStemMessage = document.createElement('ul');
            isStemMessage.classList = "stem-container";
            isStemMessage.innerHTML = `<br>This question is the stem for the following question(s):<br>${questions.filter(question1 => String(question1.stem || '') === String(q.id)).map(question1 => `<li>Segment ${allSegmentsQuestionIsIn[0]?.number || 'N/A'} Number ${question1.number}</li>`).join('')}`;
            question.appendChild(isStemMessage);
          } else {
            var correctAnswers = document.createElement('div');
            correctAnswers.classList = "answers";
            var correctAnswersString = "";
            var questionAnswers = answers.find(a => a.id === q.id);
            questionAnswers.correct_answers.forEach(a => {
              correctAnswersString += `<div class="button-grid inputs"><input type="text" autocomplete="off" id="question-correct-answer-input" value="${a}" placeholder="${a}" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button><button data-convert-correct-answer-to-incorrect-answer square><i class="bi bi-arrow-down-up"></i></button></div>`;
            });
            correctAnswers.innerHTML = `<b>Correct Answers</b><div class="section correctAnswers">${correctAnswersString}<button data-add-correct-answer-input>Add Correct Answer</button></div>`;
            question.appendChild(correctAnswers);
            var incorrectAnswers = document.createElement('div');
            incorrectAnswers.classList = "answers";
            var incorrectAnswersString = "";
            questionAnswers.incorrect_answers.forEach(a => {
              incorrectAnswersString += `<div class="button-grid inputs"><input type="text" autocomplete="off" id="question-incorrect-answer-input" value="${a.answer}" placeholder="${a.answer || 'Answer'}" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="${a.reason}" placeholder="${a.reason || 'Reason'}" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button><button data-convert-incorrect-answer-to-correct-answer square><i class="bi bi-arrow-down-up"></i></button></div>`;
            });
            incorrectAnswers.innerHTML = `<b>Incorrect Answers</b><div class="section incorrectAnswers">${incorrectAnswersString}<button data-add-incorrect-answer-input>Add Incorrect Answer</button></div>`;
            question.appendChild(incorrectAnswers);
          }
          document.querySelector('.questions .section').appendChild(question);
          if (!isStem) question.querySelectorAll('#question-correct-answer-input, #question-incorrect-answer-input, #question-incorrect-answer-reason-input').forEach(questionAnswerInput => questionAnswerInput.addEventListener('change', () => {
            question.setAttribute('modified', 'true');
          }));
        });
      }
    }
    document.querySelectorAll('[data-toggle-question]').forEach(a => a.addEventListener('click', toggleQuestion));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
    document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
    document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
    document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
    document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
    document.querySelectorAll('[data-convert-correct-answer-to-incorrect-answer]').forEach(a => a.addEventListener('click', convertToIncorrectAnswer));
    document.querySelectorAll('[data-convert-incorrect-answer-to-correct-answer]').forEach(a => a.addEventListener('click', convertToCorrectAnswer));
    ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  function addCorrectAnswer() {
    if (!active) return;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-correct-answer-input" value="" placeholder="Answer" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button><button data-convert-correct-answer-to-incorrect-answer square><i class="bi bi-arrow-down-up"></i></button>`;
    this.parentElement.insertBefore(input, this);
    this.parentElement.parentElement.parentElement.setAttribute('modified', 'true');
    document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
    document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
    document.querySelectorAll('[data-convert-correct-answer-to-incorrect-answer]').forEach(a => a.addEventListener('click', convertToIncorrectAnswer));
    ui.reloadUnsavedInputs();
  }

  function addIncorrectAnswer() {
    if (!active) return;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-incorrect-answer-input" value="" placeholder="Answer" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="" placeholder="Reason" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button><button data-convert-incorrect-answer-to-correct-answer square><i class="bi bi-arrow-down-up"></i></button>`;
    this.parentElement.insertBefore(input, this);
    this.parentElement.parentElement.parentElement.setAttribute('modified', 'true');
    document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
    document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
    document.querySelectorAll('[data-convert-incorrect-answer-to-correct-answer]').forEach(a => a.addEventListener('click', convertToCorrectAnswer));
    ui.reloadUnsavedInputs();
  }

  function removeCorrectAnswer() {
    if (!active) return;
    this.parentElement.parentElement.parentElement.parentElement.setAttribute('modified', 'true');
    this.parentElement.remove();
    ui.setUnsavedChanges(true);
  }

  function removeIncorrectAnswer() {
    if (!active) return;
    this.parentElement.parentElement.parentElement.parentElement.setAttribute('modified', 'true');
    this.parentElement.remove();
    ui.setUnsavedChanges(true);
  }

  function convertToIncorrectAnswer() {
    if (!active) return;
    const answerText = this.parentElement.querySelector('#question-correct-answer-input').value;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-incorrect-answer-input" value="${answerText}" placeholder="Answer" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="" placeholder="Reason" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button><button data-convert-incorrect-answer-to-correct-answer square><i class="bi bi-arrow-down-up"></i></button>`;
    this.parentElement.parentElement.parentElement.parentElement.querySelector('.incorrectAnswers').insertBefore(input, this.parentElement.parentElement.parentElement.parentElement.querySelector('.incorrectAnswers [data-add-incorrect-answer-input]'));
    document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
    document.querySelectorAll('[data-convert-incorrect-answer-to-correct-answer]').forEach(a => a.addEventListener('click', convertToCorrectAnswer));
    this.parentElement.parentElement.parentElement.parentElement.setAttribute('modified', 'true');
    this.parentElement.remove();
    ui.setUnsavedChanges(true);
  }

  function convertToCorrectAnswer() {
    if (!active) return;
    const answerText = this.parentElement.querySelector('#question-incorrect-answer-input').value;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-correct-answer-input" value="${answerText}" placeholder="Answer" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button><button data-convert-correct-answer-to-incorrect-answer square><i class="bi bi-arrow-down-up"></i></button>`;
    this.parentElement.parentElement.parentElement.parentElement.querySelector('.correctAnswers').insertBefore(input, this.parentElement.parentElement.parentElement.parentElement.querySelector('.correctAnswers [data-add-correct-answer-input]'));
    document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
    document.querySelectorAll('[data-convert-correct-answer-to-incorrect-answer]').forEach(a => a.addEventListener('click', convertToIncorrectAnswer));
    this.parentElement.parentElement.parentElement.parentElement.setAttribute('modified', 'true');
    this.parentElement.remove();
    ui.setUnsavedChanges(true);
  }

  async function toggleQuestion(event = null, questionId = null) {
    if (questionId) await goToPage(document.querySelector('.questions #current-page'), pageQuestionIsOn(document.querySelector('.questions #current-page'), questionId));
    const questionContainer = questionId ? document.querySelector(`#question-${questionId}`) : this.parentElement.parentElement;
    if (!questionContainer) return;
    if (questionContainer.classList.contains('expanded')) {
      hideAllQuestions();
    } else {
      hideAllQuestions();
      questionContainer.classList.add('expanded');
      // document.querySelectorAll('#save-button').forEach(w => w.style.display = "none");
      if (!questionContainer.classList.contains('rendered')) {
        var textarea = questionContainer.querySelector('.description .textarea');
        if (!textarea) return;
        var textareaContent = textarea.getAttribute('content');
        var toolbar = questionContainer.querySelector('.description #toolbar-container');
        var quill = new Quill(textarea, {
          modules: {
            syntax: true,
            toolbar,
            fazEmoji: {
              collection: 'fluent-emoji',
            },
          },
          placeholder: 'Add some written content to your question...',
          theme: 'snow'
        });
        if (JSON.parse(textareaContent)) quill.setContents(JSON.parse(textareaContent));
        quill.disable();
        renderedEditors[questionContainer.querySelector('#question-id-input').value] = quill;
        questionContainer.querySelectorAll('img[data-src]:not([src])').forEach(img => img.src = img.getAttribute('data-src'));
      }
    }
  }

  function hideAllQuestions() {
    if (!active) return;
    document.querySelectorAll('.expanded').forEach(q => q.classList.remove('expanded'));
    // document.querySelectorAll('#save-button').forEach(w => w.style.display = "block");
  }

  async function updateResponses() {
    document.querySelector('.awaitingResponses .section').innerHTML = '';
    document.querySelector('.trendingResponses .section').innerHTML = '';
    document.querySelector('.responses .section').innerHTML = '';
    var trendingResponses = [];
    var timedResponses = [];
    var responses1 = responses
      .filter(r => courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value)?.periods).includes(Number(String(r.seatCode)[0])) : false)
      .filter(r => document.getElementById("filter-segment-input")?.value ? (String(segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')) === document.getElementById("filter-segment-input").value) : true)
      .filter(r => document.getElementById("sort-question-input")?.value.startsWith('"') ? (questions.find(q => String(q.id) === String(r.question_id))?.number === document.getElementById("sort-question-input")?.value.replaceAll('"', '')) : questions.find(q => String(q.id) === String(r.question_id))?.number.startsWith(document.getElementById("sort-question-input")?.value))
      .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
      .filter(r => !questions.find(q => String(q.id) === String(r.question_id))?.nonscored)
      .sort((a, b) => {
        if (a.flagged && !b.flagged) return -1;
        if (!a.flagged && b.flagged) return 1;
        return b.id - a.id;
      });
    if (this && ((this.id === 'course-period-input') || (this.id === 'filter-segment-input') || (this.id === 'sort-question-input') || (this.id === 'sort-seat-input'))) {
      pagination.awaitingResponses.page = 0;
      pagination.responses.page = 0;
    }
    pagination.awaitingResponses.total = responses1.filter(r => ((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')).length;
    pagination.responses.total = responses1.filter(r => !((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.responses .section')).length;
    if (document.querySelector('.awaitingResponses #current-page')) {
      const currentPage = document.querySelector('.awaitingResponses #current-page');
      const input = currentPage.querySelector('.current-page-input');
      const totalSpan = currentPage.querySelector('.current-page-total');
      const totalPages = Math.max(1, Math.ceil((pagination.awaitingResponses.total || 0) / (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.awaitingResponses.perPage)));
      if (input) input.value = Math.min(Math.max(1, pagination.awaitingResponses.page + 1), totalPages);
      if (totalSpan) totalSpan.innerText = totalPages;
      if (input && !input._pageHandlerAttached) {
        input.addEventListener('change', (e) => {
          let v = parseInt(e.target.value) || 1;
          if (v < 1) v = 1;
          if (v > totalPages) v = totalPages;
          e.target.value = v;
          goToPage(document.querySelector('.awaitingResponses .pagination'), v - 1);
        });
        input._pageHandlerAttached = true;
      }
    }
    if (document.querySelector('.responses #current-page')) {
      const currentPage = document.querySelector('.responses #current-page');
      const input = currentPage.querySelector('.current-page-input');
      const totalSpan = currentPage.querySelector('.current-page-total');
      const totalPages = Math.max(1, Math.ceil((pagination.responses.total || 0) / (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.responses.perPage)));
      if (input) input.value = Math.min(Math.max(1, pagination.responses.page + 1), totalPages);
      if (totalSpan) totalSpan.innerText = totalPages;
      if (input && !input._pageHandlerAttached) {
        input.addEventListener('change', (e) => {
          let v = parseInt(e.target.value) || 1;
          if (v < 1) v = 1;
          if (v > totalPages) v = totalPages;
          e.target.value = v;
          goToPage(document.querySelector('.responses .pagination'), v - 1);
        });
        input._pageHandlerAttached = true;
      }
    }
    syncPagination();
    const awaitingSection = document.querySelector('.awaitingResponses .section');
    const responsesSection = document.querySelector('.responses .section');
    const awaitingResponses = responses1.filter(r => (r.status === 'Invalid Format' || r.status === 'Unknown, Recorded'));
    const normalResponses = responses1.filter(r => !(r.status === 'Invalid Format' || r.status === 'Unknown, Recorded'));
    const awaitingPageResponses = awaitingSection ? awaitingResponses.slice(pagination.awaitingResponses.page * (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.awaitingResponses.perPage), (pagination.awaitingResponses.page + 1) * (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.awaitingResponses.perPage)) : [];
    const responsesPageResponses = responsesSection ? normalResponses.slice(pagination.responses.page * (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.responses.perPage), (pagination.responses.page + 1) * (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination.responses.perPage)) : [];
    var pageResponses = [...awaitingPageResponses, ...responsesPageResponses];
    pageResponses.forEach(r => {
      var responseString = r.response;
      var isMatrix = null;
      if (responseString.includes('[[')) {
        try {
          isMatrix = responseString;
          responseString = JSON.stringify(JSON.parse(r.response).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']');
        } catch {
          isMatrix = null;
          console.log(`Invalid matrix: ${r.response}`);
        }
      } else if (responseString.includes('[')) {
        try {
          var parsedResponse = JSON.parse(r.response);
          responseString = parsedResponse.join(', ');
        } catch {
          console.log(`Invalid JSON: ${r.response}`);
        }
      }
      var correctResponsesString = `Accepted: ${answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.join(', ')}`;
      const date = new Date(r.timestamp);
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const currentDate = new Date(r.timestamp);
      var timeTaken = "N/A";
      var timeTakenToRevise = "N/A";
      const sameSeatCodeResponses = responses1.filter(a => a.seatCode === r.seatCode).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const sameQuestionResponses = sameSeatCodeResponses.filter(a => a.question_id === r.question_id);
      const lastResponseIndex = sameSeatCodeResponses.findIndex(a => new Date(a.timestamp) >= currentDate) - 1;
      const lastResponse = lastResponseIndex >= 0 ? sameSeatCodeResponses[lastResponseIndex] : null;
      const lastSameQuestionResponseIndex = sameQuestionResponses.findIndex(a => new Date(a.timestamp) >= currentDate) - 1;
      const lastSameQuestionResponse = lastSameQuestionResponseIndex >= 0 ? sameQuestionResponses[lastSameQuestionResponseIndex] : null;
      let timeDifference;
      if (lastResponse) {
        timeDifference = calculateTimeDifference(currentDate, lastResponse.timestamp);
        timeTaken = formatTimeDifference(timeDifference);
        timedResponses.push(timeDifference);
      }
      if (lastSameQuestionResponse) {
        timeDifference = calculateTimeDifference(currentDate, lastSameQuestionResponse.timestamp);
        timeTakenToRevise = formatTimeDifference(timeDifference);
      }
      var [daysPart, z, timePart] = r.timeTaken.split(' ');
      const days = parseInt(daysPart, 10);
      timePart = timePart || daysPart;
      const [hours1, minutes1] = timePart.split(':').map(part => parseInt(part, 10));
      const totalHours = days * 24 + hours1;
      let result;
      if (totalHours >= 24) {
        result = `${days}d ${hours1}h`;
      } else if (totalHours >= 1) {
        result = `${hours1}h ${minutes1}m`;
      } else {
        result = `${minutes1}m`;
      }
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      buttonGrid.id = `response-${r.id}`;
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.id}" disabled hidden />${(String(r.flagged) === '1') ? `<button square data-unflag-response tooltip="Unflag Response"><i class="bi bi-flag-fill"></i></button>` : `<button square data-flag-response tooltip="Flag Response"><i class="bi bi-flag"></i></button>`}<input type="text" autocomplete="off" class="small" id="response-segment-input" value="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).number || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.number || '-')}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => String(q.id) === String(r.question_id))?.number}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" data-question="${questions.find(q => String(q.id) === String(r.question_id))?.number}" data-question-id="${questions.find(q => String(q.id) === String(r.question_id))?.id}" /><input type="text" autocomplete="off" class="small" id="response-question-id-input" value="${questions.find(q => String(q.id) === String(r.question_id)).id}" disabled hidden /><input type="text" autocomplete="off" class="small${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-seat-code-input" value="${r.seatCode}" disabled data-seat-code /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTaken}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTakenToRevise}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><!--<input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${result}" disabled data-time-taken />--><textarea autocomplete="off" rows="1" id="response-response-input" value="${escapeHTML(responseString)}" ${isMatrix ? 'mockDisabled' : 'disabled'}>${escapeHTML(responseString)}</textarea>${(r.status === 'Incorrect') ? `<button square data-edit-reason tooltip="Edit Reason"><i class="bi bi-reply${(r.reason) ? '-fill' : ''}"></i></button>` : ''}<input type="text" autocomplete="off" class="smedium${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-timestamp-input" value="${date.getMonth() + 1}/${date.getDate()} ${hours % 12 || 12}:${minutes < 10 ? '0' + minutes : minutes} ${hours >= 12 ? 'PM' : 'AM'}" disabled />${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? `<textarea autocomplete="off" rows="1" class="showonhover" id="response-correct-responses-input" value="${correctResponsesString}" disabled>${correctResponsesString}</textarea>` : ''}<button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      if (window.innerWidth >= 1000) {
        buttonGrid.addEventListener('mouseenter', () => {
          var question = questions.find(q => String(q.id) === String(r.question_id));
          island(buttonGrid, buttonGrid.parentElement.children, 'response', {
            sourceId: String([...buttonGrid.parentElement.children].indexOf(buttonGrid)),
            id: `ID ${question.id}`,
            title: `Question ${question.number}`,
            subtitle: `${question.question}`,
            subtitleLatex: question.latex,
            description: question.description,
            attachments: question.images,
            lists: [
              {
                title: 'Correct Answers',
                items: answers.find(a => a.id === question.id)?.correct_answers
              },
              {
                title: 'Incorrect Answers',
                items: answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).incorrect_answers
              },
            ],
            activeItem: responseString,
          }, questions, answers);
        });
        buttonGrid.addEventListener('mouseleave', () => {
          island();
        });
      }
      if (document.querySelector('.responses .section')) {
        document.querySelector('.responses .section').appendChild(buttonGrid);
        document.querySelector('.responses .section .button-grid:last-child #response-segment-input').addEventListener('click', (e) => {
          if (e.target.getAttribute('data-segment')) {
            document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
            updateResponses();
          }
        });
        document.querySelector('.responses .section .button-grid:last-child #response-question-input').addEventListener('click', (e) => {
          if (e.target.getAttribute('data-question')) {
            if (e.target.getAttribute('data-segment')) document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
            if (document.getElementById("sort-question-input")) document.getElementById("sort-question-input").value = `"${e.target.getAttribute('data-question')}"`;
            updateResponses();
          }
        });
        if (isMatrix) document.querySelector('.responses .section .button-grid:last-child #response-response-input').addEventListener('click', () => ui.expandMatrix(isMatrix));
      }
      if (((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')) {
        document.querySelector('.awaitingResponses .section').appendChild(buttonGrid);
        document.querySelector('.awaitingResponses .section .button-grid:last-child #response-segment-input').addEventListener('click', (e) => {
          if (e.target.getAttribute('data-segment')) {
            document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
            updateResponses();
          }
        });
        document.querySelector('.awaitingResponses .section .button-grid:last-child #response-question-input').addEventListener('click', (e) => {
          if (e.target.getAttribute('data-question')) {
            if (e.target.getAttribute('data-segment')) document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
            if (document.getElementById("sort-question-input")) document.getElementById("sort-question-input").value = `"${e.target.getAttribute('data-question')}"`;
            updateResponses();
          }
        });
        if (isMatrix) document.querySelector('.awaitingResponses .section .button-grid:last-child #response-response-input').addEventListener('click', () => ui.expandMatrix(isMatrix));
      }
      var trend = trendingResponses.find(t => (t.segment === r.segment) && (t.question_id === r.question_id) && (t.response === responseString) && (t.status === r.status));
      if (trend) {
        trend.count++;
      } else {
        trendingResponses.push({
          single_response: r.id,
          segment: r.segment,
          question_id: r.question_id,
          response: r.response,
          status: r.status,
          count: 1
        });
      }
    });
    const stdDev = calculateStandardDeviation(timedResponses);
    // console.log("Standard Deviation:", stdDev);
    document.querySelectorAll('[data-time-taken]').forEach(d => {
      if (d.hasAttribute('time') && (Number(d.getAttribute('time')) > stdDev)) d.classList.add('disabled');
    });
    trendingResponses.filter(t => t.count > 1).forEach(r => {
      var responseString = r.response;
      var isMatrix = null;
      if (responseString.includes('[[')) {
        try {
          isMatrix = responseString;
          responseString = JSON.stringify(JSON.parse(r.response).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']');
        } catch {
          isMatrix = null;
          console.log(`Invalid matrix: ${r.response}`);
        }
      } else if (responseString.includes('[')) {
        try {
          var parsedResponse = JSON.parse(r.response);
          responseString = parsedResponse.join(', ');
        } catch {
          console.log(`Invalid JSON: ${r.response}`);
        }
      }
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.single_response}" disabled hidden /><input type="text" autocomplete="off" class="small" id="response-segment-input" value="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).number || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.number || '-')}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => String(q.id) === String(r.question_id))?.number}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" data-question="${questions.find(q => String(q.id) === String(r.question_id))?.number}" data-question-id="${questions.find(q => String(q.id) === String(r.question_id))?.id}" /><input type="text" autocomplete="off" class="small" id="response-question-id-input" value="${questions.find(q => String(q.id) === String(r.question_id)).id}" disabled hidden /><textarea autocomplete="off" rows="1" id="response-response-input" value="${escapeHTML(responseString)}" ${isMatrix ? 'mockDisabled' : 'disabled'}>${escapeHTML(responseString)}</textarea><input type="text" autocomplete="off" class="small" id="response-count-input" value="${r.count}" disabled /><button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      if (window.innerWidth >= 1000) {
        buttonGrid.addEventListener('mouseenter', () => {
          var question = questions.find(q => String(q.id) === String(r.question_id));
          island(buttonGrid, buttonGrid.parentElement.children, 'response', {
            sourceId: String([...buttonGrid.parentElement.children].indexOf(buttonGrid)),
            id: `ID ${question.id}`,
            title: `Question ${question.number}`,
            subtitle: `${question.question}`,
            subtitleLatex: question.latex,
            description: question.description,
            attachments: question.images,
            lists: [
              {
                title: 'Correct Answers',
                items: answers.find(a => a.id === question.id).correct_answers
              },
              {
                title: 'Incorrect Answers',
                items: answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).incorrect_answers
              },
            ],
            activeItem: responseString,
          }, questions, answers);
        });
        buttonGrid.addEventListener('mouseleave', () => {
          island();
        });
      }
      document.querySelector('.trendingResponses .section').appendChild(buttonGrid);
      document.querySelector('.trendingResponses .section .button-grid:last-child #response-segment-input').addEventListener('click', (e) => {
        if (e.target.getAttribute('data-segment')) {
          document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
          updateResponses();
        }
      });
      document.querySelector('.trendingResponses .section .button-grid:last-child #response-question-input').addEventListener('click', (e) => {
        if (e.target.getAttribute('data-question')) {
          if (e.target.getAttribute('data-segment')) document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
          if (document.getElementById("sort-question-input")) document.getElementById("sort-question-input").value = `"${e.target.getAttribute('data-question')}"`;
          updateResponses();
        }
      });
      if (isMatrix) document.querySelector('.trendingResponses .section .button-grid:last-child #response-response-input').addEventListener('click', () => ui.expandMatrix(isMatrix));
    });
    document.querySelectorAll('#mark-correct-button').forEach(a => a.addEventListener('click', markCorrect));
    document.querySelectorAll('#mark-incorrect-button').forEach(a => a.addEventListener('click', markIncorrect));
    document.querySelectorAll('[data-flag-response]').forEach(a => a.addEventListener('click', flagResponse));
    document.querySelectorAll('[data-unflag-response]').forEach(a => a.addEventListener('click', unflagResponse));
    document.querySelectorAll('[data-edit-reason]').forEach(a => a.addEventListener('click', editReason));
    if (fromAwaitingScoring && !awaitingResponses.length && document.getElementById("filter-segment-input")) {
      document.getElementById("filter-segment-input").value = '';
      fromAwaitingScoring = false;
      updateResponses();
    }
    ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  function calculateTimeDifference(currentDate, previousTimestamp) {
    const lastResponseDate = new Date(previousTimestamp);
    return (currentDate - lastResponseDate) / 60000;
  }

  function formatTimeDifference(timeDifference) {
    if (timeDifference >= 1440) {
      const days = Math.floor(timeDifference / 1440);
      const hours = Math.floor((timeDifference % 1440) / 60);
      return `${days}d ${hours > 0 ? `${hours}h` : ''}`.trim();
    } else if (timeDifference >= 60) {
      const hours = Math.floor(timeDifference / 60);
      const minutes = Math.floor(timeDifference % 60);
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
    } else {
      return `${Math.floor(timeDifference)} min${Math.floor(timeDifference) === 1 ? '' : 's'}`;
    }
  }

  function calculateStandardDeviation(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
    const variance = arr.reduce((sum, value) => {
      const diff = value - mean;
      return sum + diff * diff;
    }, 0) / arr.length;
    return Math.sqrt(variance);
  }

  function flagResponse() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/flag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("pwd"),
        question_id: this.parentElement.querySelector('#response-id-input').value,
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
      })
      .then(() => {
        ui.setUnsavedChanges(false);
        ui.toast("Flagged response for review.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.ta(init);
      });
  }

  function unflagResponse() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/unflag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("pwd"),
        question_id: this.parentElement.querySelector('#response-id-input').value,
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
      })
      .then(() => {
        ui.setUnsavedChanges(false);
        ui.toast("Unflagged response.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.ta(init);
      });
  }

  function markCorrect() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/mark_correct', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("pwd"),
        question_id: this.parentElement.querySelector('#response-question-id-input').value,
        single_response: this.parentElement.querySelector('#response-id-input').value,
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
      })
      .then(() => {
        ui.setUnsavedChanges(false);
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        noReloadCourse = true;
        keepSegment = document.getElementById("filter-segment-input").value;
        fromAwaitingScoring = (document.querySelector('.awaitingResponses .section') && Array.from(document.querySelector('.awaitingResponses .section').children).includes(this.parentElement)) ? true : false;
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.ta(init);
      });
  }

  function markIncorrect() {
    if (!active) return;
    ui.modal({
      title: 'Add Reason',
      body: '<p>Add a reason that this response is incorrect.</p>',
      input: {
        type: 'text',
        placeholder: 'Take the derivative of x^2 before multiplying.',
        defaultValue: (Object.keys(lastMarkedQuestion).length && (String(lastMarkedQuestion.question_id) === this.parentElement.querySelector('#response-question-id-input').value)) ? lastMarkedQuestion.reason : '',
        selectAll: true,
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
          onclick: (inputValue) => {
            markIncorrectConfirm(inputValue, this);
          },
          close: true,
        },
      ],
    });
  }

  function markIncorrectConfirm(reason, e) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/mark_incorrect', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("pwd"),
        question_id: e.parentElement.querySelector('#response-question-id-input').value,
        single_response: e.parentElement.querySelector('#response-id-input').value,
        reason: reason,
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
      })
      .then(() => {
        ui.setUnsavedChanges(false);
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        lastMarkedQuestion = {
          question_id: e.parentElement.querySelector('#response-question-id-input').value,
          single_response: e.parentElement.querySelector('#response-id-input').value,
          reason: reason
        };
        noReloadCourse = true;
        keepSegment = document.getElementById("filter-segment-input").value;
        fromAwaitingScoring = (document.querySelector('.awaitingResponses .section') && Array.from(document.querySelector('.awaitingResponses .section').children).includes(e.parentElement)) ? true : false;
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.ta(init);
      });
  }

  function editReason() {
    if (!active) return;
    ui.modal({
      title: 'Edit Reason',
      body: '<p>Edit your reason that this response is incorrect.</p>',
      input: {
        type: 'text',
        placeholder: responses.find(r => String(r.id) === this.parentElement.querySelector('#response-id-input').value).reason || '',
        defaultValue: responses.find(r => String(r.id) === this.parentElement.querySelector('#response-id-input').value).reason || '',
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
          onclick: (inputValue) => {
            markIncorrectConfirm(inputValue, this);
          },
          close: true,
        },
      ],
    });
  }

  function previousPage(paginationSection) {
    const group = Array.from(paginationSection.parentElement.parentElement.classList).find(a => Object.keys(pagination).includes(a));
    if (!group) return;
    pagination[group].page = pagination[group].page - 1;
    if (document.querySelector('.responses')) {
      updateResponses();
    } else if (document.querySelector('.questions')) {
      updateQuestions();
    }
    syncPagination();
  }

  function nextPage(paginationSection) {
    const group = Array.from(paginationSection.parentElement.parentElement.classList).find(a => Object.keys(pagination).includes(a));
    if (!group) return;
    pagination[group].page = pagination[group].page + 1;
    if (document.querySelector('.responses')) {
      updateResponses();
    } else if (document.querySelector('.questions')) {
      updateQuestions();
    }
    syncPagination();
  }

  function syncPagination() {
    Object.keys(pagination).forEach(group => {
      if (document.querySelector(`.${group} .pagination`)) {
        document.querySelectorAll(`.${group} .pagination`).forEach(paginationSection => {
          const currentPage = paginationSection.parentElement.querySelector('#current-page');
          const input = currentPage?.querySelector('.current-page-input');
          const totalSpan = currentPage?.querySelector('.current-page-total');
          const totalPages = Math.max(1, Math.ceil((pagination[group].total || 0) / (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination[group].perPage)));
          if (input) input.value = Math.min(Math.max(1, pagination[group].page + 1), totalPages);
          if (totalSpan) totalSpan.innerText = totalPages;
          if (input && !input._pageHandlerAttached) {
            input.addEventListener('change', (e) => {
              let v = parseInt(e.target.value) || 1;
              if (v < 1) v = 1;
              if (v > totalPages) v = totalPages;
              e.target.value = v;
              goToPage(paginationSection, v - 1);
            });
            input._pageHandlerAttached = true;
          }
          paginationSection.parentElement.querySelector('#next-page-button').disabled = (pagination[group].page + 1 >= totalPages) ? true : false;
          paginationSection.parentElement.querySelector('#previous-page-button').disabled = (pagination[group].page - 1 < 0) ? true : false;
          paginationSection.parentElement.querySelector('#first-page-button').disabled = (pagination[group].page - 1 < 0) ? true : false;
          paginationSection.parentElement.querySelector('#last-page-button').disabled = (pagination[group].page + 1 >= totalPages) ? true : false;
        });
      }
    });
  }

  function pageQuestionIsOn(paginationSection, questionId) {
    const group = Array.from(paginationSection.parentElement.parentElement.classList).find(a => Object.keys(pagination).includes(a));
    if (!group) return 0;
    const questionIndex = questions.filter(q => document.getElementById("filter-segment-input")?.value ? segments.filter(segment => JSON.parse(segment.question_ids).find(q1 => String(q1.id) === String(q.id))).map(segment => String(segment.id)).includes(String(document.getElementById("filter-segment-input")?.value)) : true).findIndex(q => String(q.id) === String(questionId));
    if (questionIndex === -1) return 0;
    return Math.floor(questionIndex / (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination[group].perPage)) || 0;
  }

  async function goToPage(paginationSection, page) {
    function findGroup(el) {
      let cur = el;
      for (let i = 0; i < 6 && cur; i++) {
        if (cur.classList) {
          const found = Array.from(cur.classList).find(a => Object.keys(pagination).includes(a));
          if (found) return found;
        }
        cur = cur.parentElement;
      }
      return null;
    }
    const group = findGroup(paginationSection);
    if (!group) return;
    pagination[group].page = page;
    if (document.querySelector('.responses')) {
      updateResponses();
    } else if (document.querySelector('.questions')) {
      updateQuestions();
    }
    syncPagination();
  }

  function firstPage(paginationSection) {
    goToPage(paginationSection, 0);
  }

  function lastPage(paginationSection) {
    const group = Array.from(paginationSection.parentElement.parentElement.classList).find(a => Object.keys(pagination).includes(a));
    if (!group) return;
    goToPage(paginationSection, Math.ceil(pagination[group].total / (storage.get("rowsPerPage") ? Number(storage.get("rowsPerPage")) : pagination[group].perPage)) - 1);
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ ta.js: ${error.message}`);
  }
  throw error;
}