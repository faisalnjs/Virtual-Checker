/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as auth from "/src/modules/auth.js";
import island from "/src/modules/island.js";
import Element from "/src/modules/element.js";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var period = document.getElementById("period-input")?.value;

var courses = [];
var segments = [];
var questions = [];
var answers = [];
var responses = [];
var active = false;
var timestamps = false;
var noReloadCourse = false;
var lastMarkedQuestion = {};
var pagination = {
  awaitingResponses: { page: 0, perPage: 50 },
  responses: { page: 0, perPage: 50 },
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

    await fetch(domain + '/bulk_load?ta=true', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("code"),
        pwd: storage.get("pwd"),
        fields: ["courses", "segments", "questions", "answers", "responses"]
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
      .then(async bulkLoad => {
        courses = bulkLoad.courses;
        segments = bulkLoad.segments;
        questions = bulkLoad.questions;
        answers = bulkLoad.answers;
        responses = bulkLoad.responses;
        if (courses.length === 0) return ui.modal({
          title: 'Enter Password',
          body: `<p>Enter the assigned password for TA seat code <code>${storage.get("code")}</code>.</p>`,
          input: {
            type: 'password'
          },
          buttons: [
            {
              text: 'Verify',
              class: 'submit-button',
              onclick: (inputValue) => {
                storage.set("pwd", inputValue);
                init();
              },
              close: true,
            },
          ],
        });
        await auth.loadAdminSettings(courses);
        if (!noReloadCourse) {
          document.getElementById("course-period-input").innerHTML = "";
          courses.sort((a, b) => a.id - b.id).forEach(course => {
            var coursePeriods = JSON.parse(course.periods);
            const option = document.createElement("option");
            option.value = course.id;
            option.innerHTML = document.getElementById("course-input") ? course.name : `${course.name}${(coursePeriods.length > 0) ? ` (Period${(coursePeriods.length > 1) ? 's' : ''} ${coursePeriods.join(', ')})` : ''}`;
            document.getElementById("course-period-input").appendChild(option);
          });
        }
        document.getElementById("course-period-input").addEventListener("input", updateCourses);
        document.getElementById("course-period-input").addEventListener("change", updateResponses);
        document.getElementById("filter-segment-input").addEventListener("change", updateResponses);
        document.getElementById("sort-question-input").addEventListener("input", updateResponses);
        document.getElementById("sort-seat-input").addEventListener("input", updateResponses);
        if (document.getElementById("filter-segment-input")) updateCourses();
        if (responses.find(response => String(response.seatCode).includes('xx'))) document.getElementById("checker").classList.add("anonymous");
        if (!noReloadCourse) document.getElementById("course-period-input").value = ((ui.defaultCourse !== null) && courses.find(c => String(c.id) === String(ui.defaultCourse))) ? ui.defaultCourse : courses.find(c => JSON.parse(c.periods).includes(Number(String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0]?.seatCode)[0]))) ? courses.find(c => JSON.parse(c.periods).includes(Number(String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0]?.seatCode)[0]))).id : 0;
        await updateResponses();
        active = true;
        ui.stopLoader();
        ui.toast("Data restored.", 1000, "info", "bi bi-cloud-arrow-down");
        document.getElementById("filter-segment-input").addEventListener("change", () => {
          document.getElementById("sort-question-input").value = "";
          const event = new Event('input', { bubbles: true });
          document.getElementById("sort-question-input").dispatchEvent(event);
        });
        ui.reloadUnsavedInputs();
      })
      .catch((e) => {
        console.error(e);
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.ta(init);
      });
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
      };
    } else {
      ui.alert("Error", "Seat code isn't possible");
    }
  }

  document.querySelector('[data-timestamps]').addEventListener("click", toggleTimestamps);

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
      .filter(r => questions.find(q => String(q.id) === String(r.question_id))?.number.startsWith(document.getElementById("sort-question-input")?.value))
      .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
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
    if (document.querySelector('.awaitingResponses #current-page')) document.querySelector('.awaitingResponses #current-page').innerText = `Page ${pagination.awaitingResponses.page + 1} of ${Math.ceil(pagination.awaitingResponses.total / pagination.awaitingResponses.perPage)}`;
    if (document.querySelector('.responses #current-page')) document.querySelector('.responses #current-page').innerText = `Page ${pagination.responses.page + 1} of ${Math.ceil(pagination.responses.total / pagination.responses.perPage)}`;
    syncPagination();
    const awaitingSection = document.querySelector('.awaitingResponses .section');
    const responsesSection = document.querySelector('.responses .section');
    const awaitingResponses = responses1.filter(r => (r.status === 'Invalid Format' || r.status === 'Unknown, Recorded'));
    const normalResponses = responses1.filter(r => !(r.status === 'Invalid Format' || r.status === 'Unknown, Recorded'));
    const awaitingPageResponses = awaitingSection ? awaitingResponses.slice(pagination.awaitingResponses.page * pagination.awaitingResponses.perPage, (pagination.awaitingResponses.page + 1) * pagination.awaitingResponses.perPage) : [];
    const responsesPageResponses = responsesSection ? normalResponses.slice(pagination.responses.page * pagination.responses.perPage, (pagination.responses.page + 1) * pagination.responses.perPage) : [];
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
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.id}" disabled hidden />${(String(r.flagged) === '1') ? `<button square data-unflag-response tooltip="Unflag Response"><i class="bi bi-flag-fill"></i></button>` : `<button square data-flag-response tooltip="Flag Response"><i class="bi bi-flag"></i></button>`}<input type="text" autocomplete="off" class="small" id="response-segment-input" value="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).number || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.number || '-')}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => String(q.id) === String(r.question_id))?.number}" mockDisabled data-question="${questions.find(q => String(q.id) === String(r.question_id))?.number}" /><input type="text" autocomplete="off" class="small" id="response-question-id-input" value="${questions.find(q => String(q.id) === String(r.question_id)).id}" disabled hidden /><input type="text" autocomplete="off" class="small${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-seat-code-input" value="${r.seatCode}" disabled data-seat-code /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTaken}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTakenToRevise}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><!--<input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${result}" disabled data-time-taken />--><textarea autocomplete="off" rows="1" id="response-response-input" value="${escapeHTML(responseString)}" ${isMatrix ? 'mockDisabled' : 'disabled'}>${escapeHTML(responseString)}</textarea>${(r.status === 'Incorrect') ? `<button square data-edit-reason tooltip="Edit Reason"><i class="bi bi-reply${(r.reason) ? '-fill' : ''}"></i></button>` : ''}<input type="text" autocomplete="off" class="smedium${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-timestamp-input" value="${date.getMonth() + 1}/${date.getDate()} ${hours % 12 || 12}:${minutes < 10 ? '0' + minutes : minutes} ${hours >= 12 ? 'PM' : 'AM'}" disabled />${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? `<textarea autocomplete="off" rows="1" class="showonhover" id="response-correct-responses-input" value="${correctResponsesString}" disabled>${correctResponsesString}</textarea>` : ''}<button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      if (window.innerWidth >= 1400) {
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
            document.getElementById("sort-question-input").value = e.target.getAttribute('data-question');
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
            document.getElementById("sort-question-input").value = e.target.getAttribute('data-question');
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
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.single_response}" disabled hidden /><input type="text" autocomplete="off" class="small" id="response-segment-input" value="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).number || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.number || '-')}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => String(q.id) === String(r.question_id))?.number}" mockDisabled data-question="${questions.find(q => String(q.id) === String(r.question_id))?.number}" /><input type="text" autocomplete="off" class="small" id="response-question-id-input" value="${questions.find(q => String(q.id) === String(r.question_id)).id}" disabled hidden /><textarea autocomplete="off" rows="1" id="response-response-input" value="${escapeHTML(responseString)}" ${isMatrix ? 'mockDisabled' : 'disabled'}>${escapeHTML(responseString)}</textarea><input type="text" autocomplete="off" class="small" id="response-count-input" value="${r.count}" disabled /><button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      if (window.innerWidth >= 1400) {
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
          document.getElementById("sort-question-input").value = e.target.getAttribute('data-question');
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
    updateResponses();
    paginationSection.parentElement.querySelector('#current-page').innerText = `Page ${pagination[group].page + 1} of ${Math.ceil(pagination[group].total / pagination[group].perPage)}`;
    paginationSection.parentElement.querySelector('#next-page-button').disabled = false;
    paginationSection.parentElement.querySelector('#previous-page-button').disabled = (pagination[group].page - 1 < 0) ? true : false;
  }

  function nextPage(paginationSection) {
    const group = Array.from(paginationSection.parentElement.parentElement.classList).find(a => Object.keys(pagination).includes(a));
    if (!group) return;
    pagination[group].page = pagination[group].page + 1;
    updateResponses();
    paginationSection.parentElement.querySelector('#current-page').innerText = `Page ${pagination[group].page + 1} of ${Math.ceil(pagination[group].total / pagination[group].perPage)}`;
    paginationSection.parentElement.querySelector('#next-page-button').disabled = (pagination[group].page + 1 >= Math.ceil(pagination[group].total / pagination[group].perPage)) ? true : false;
    paginationSection.parentElement.querySelector('#previous-page-button').disabled = false;
  }

  function syncPagination() {
    Object.keys(pagination).forEach(group => {
      if (document.querySelector(`.${group} .pagination`)) {
        document.querySelectorAll(`.${group} .pagination`).forEach(paginationSection => {
          paginationSection.parentElement.querySelector('#current-page').innerText = `Page ${pagination[group].page + 1} of ${Math.ceil(pagination[group].total / pagination[group].perPage)}`;
          paginationSection.parentElement.querySelector('#next-page-button').disabled = (pagination[group].page + 1 >= Math.ceil(pagination[group].total / pagination[group].perPage)) ? true : false;
          paginationSection.parentElement.querySelector('#previous-page-button').disabled = (pagination[group].page - 1 < 0) ? true : false;
        });
      }
    });
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ ta.js: ${error.message}`);
  };
  throw error;
};