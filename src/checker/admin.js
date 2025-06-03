/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as time from "/src/modules/time.js";
import { convertLatexToSpeakableText } from "mathlive";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var courses = [];
var segments = [];
var questions = [];
var answers = [];
var responses = [];
let draggedItem = null;
var formData = new FormData();
var polling = false;
var active = false;
var timestamps = false;
var speed = false;
var reorder = false;

try {
  async function init() {
    formData = new FormData();

    // Show clear data fix guide
    // if (storage.get("created")) {
    //   document.querySelector(`[data-modal-view="clear-data-fix"]`).remove();
    // } else {
    //   storage.set("created", Date.now());
    // }

    await fetch(domain + '/courses', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    })
      .then(c => c.json())
      .then(async c => {
        courses = c;
        if (document.getElementById("course-period-input")) {
          c.sort((a, b) => a.period - b.period).forEach(course => {
            const option = document.createElement("option");
            option.value = course.id;
            option.innerHTML = document.getElementById("course-input") ? course.period : `${course.period}${course.name ? ` (${course.name})` : ''}`;
            document.getElementById("course-period-input").appendChild(option);
            const elem = document.createElement("div");
            elem.classList = "button-grid inputs";
            elem.style = "flex-wrap: nowrap !important;";
            elem.innerHTML = `<input type="text" autocomplete="off" id="course-${course.id}" value="${course.name || ''}" /><div class="drag"><i class="bi bi-grip-vertical"></i></div>`;
            if (document.querySelector(".course-reorder .reorder")) document.querySelector(".course-reorder .reorder").appendChild(elem);
          });
          const course = courses.find(c => c.id == document.getElementById("course-period-input").value);
          if (document.getElementById("course-input")) document.getElementById("course-input").value = course.name;
          document.querySelectorAll('.drag').forEach(item => {
            item.setAttribute('draggable', true);
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDropCourse);
          });
        }
        if (document.getElementById("sort-course-input")) {
          c.sort((a, b) => a.period - b.period).forEach(course => {
            const option = document.createElement("option");
            option.value = course.period;
            option.innerHTML = `Period ${course.period}${course.name ? ` - ${course.name}` : ''}`;
            document.getElementById("sort-course-input").appendChild(option);
          });
          document.getElementById("sort-course-input").addEventListener("change", updateResponses);
          document.getElementById("sort-segment-input").addEventListener("input", updateResponses);
          document.getElementById("sort-question-input").addEventListener("input", updateResponses);
          document.getElementById("sort-seat-input").addEventListener("input", updateResponses);
        }
        await fetch(domain + '/segments', {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          }
        })
          .then(c => c.json())
          .then(async c => {
            segments = c;
            if (document.getElementById("course-period-input")) updateSegments();
            if (document.getElementById("speed-mode-segments")) updateSpeedModeSegments();
            await fetch(domain + '/questions', {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              }
            })
              .then(q => q.json())
              .then(async q => {
                questions = q;
                await fetch(domain + '/answers', {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  }
                })
                  .then(a => a.json())
                  .then(async a => {
                    answers = a;
                    if (document.querySelector('.questions.section')) updateQuestions();
                    await fetch(domain + '/responses', {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                      }
                    })
                      .then(r => r.json())
                      .then(async r => {
                        responses = r;
                        if (document.querySelector('.responses.section') || document.querySelector('.seat-code-reports')) {
                          document.getElementById("sort-course-input").value = courses.find(c => c.id == String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0].seatCode)[0]).id;
                          await updateResponses();
                        }
                        if (document.querySelector('.segment-reports')) updateSegments();
                        active = true;
                        ui.stopLoader();
                        if (!polling) ui.toast("Data restored.", 1000, "info", "bi bi-cloud-arrow-down");
                      })
                      .catch((e) => {
                        console.error(e);
                        ui.view("api-fail");
                        pollingOff();
                      });
                  })
                  .catch((e) => {
                    console.error(e);
                    ui.view("api-fail");
                    pollingOff();
                  });
              })
              .catch((e) => {
                console.error(e);
                ui.view("api-fail");
                pollingOff();
              });
          })
          .catch((e) => {
            console.error(e);
            ui.view("api-fail");
            pollingOff();
          });
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
      });
    if (document.getElementById("course-period-input")) {
      if (document.querySelector('.course-reorder')) document.querySelector('.course-reorder').style.display = 'none';
      if (document.querySelector('.segment-reorder')) document.querySelector('.segment-reorder').style.display = 'none';
      document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.removeEventListener('click', removeSegment));
      document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
      document.getElementById("course-period-input").value = courses.find(c => c.id == segments.sort((a, b) => a.course - b.course)[0].course).id;
      updateSegments();
    }
  }

  init();

  if (document.getElementById("course-period-input")) document.getElementById("course-period-input").addEventListener("change", updateSegments);
  if (document.querySelector('[data-select]')) document.querySelector('[data-select-multiple]').addEventListener("click", toggleSelecting);
  if (document.querySelector('[data-select]')) document.querySelector('[data-delete-multiple]').addEventListener("click", deleteMultiple);
  if (document.querySelector('[data-polling]')) document.querySelector('[data-polling]').addEventListener("click", togglePolling);
  if (document.querySelector('[data-timestamps]')) document.querySelector('[data-timestamps]').addEventListener("click", toggleTimestamps);
  if (document.querySelector('[data-speed]')) document.querySelector('[data-speed]').addEventListener("click", toggleSpeedMode);
  if (document.getElementById('enable-speed-mode-button')) document.getElementById('enable-speed-mode-button').addEventListener("click", enableSpeedMode);
  if (document.querySelector('[data-reorder]')) document.querySelector('[data-reorder]').addEventListener("click", toggleReorder);
  if (document.getElementById('sort-course-input')) document.getElementById('sort-course-input').addEventListener("change", updateSegments);
  if (document.getElementById('sort-segments-due')) document.getElementById('sort-segments-due').addEventListener("click", sortSegmentsDue);
  if (document.getElementById('sort-segments-increasing')) document.getElementById('sort-segments-increasing').addEventListener("click", sortSegmentsIncreasing);
  if (document.getElementById('sort-segments-decreasing')) document.getElementById('sort-segments-decreasing').addEventListener("click", sortSegmentsDecreasing);
  if (document.getElementById('sort-segments-button')) document.getElementById('sort-segments-button').addEventListener("click", sortSegments);
  if (document.getElementById('hideIncorrectAttempts')) document.getElementById('hideIncorrectAttempts').addEventListener("change", updateResponses);

  function toggleSelecting() {
    if (!active) return;
    if (document.querySelector('.segments .section')) document.querySelector('.segments .section').classList.toggle('selecting');
    if (document.querySelector('.questions .section')) document.querySelector('.questions .section').classList.toggle('selecting');
  }

  function removeSelecting() {
    if (!active) return;
    if (document.querySelector('.segments .section')) document.querySelector('.segments .section').classList.remove('selecting');
    if (document.querySelector('.questions .section')) document.querySelector('.questions .section').classList.remove('selecting');
  }

  function deleteMultiple() {
    if (!active) return;
    document.querySelectorAll('.selected').forEach(e => e.remove());
  }

  function toggleSelected() {
    if (!active) return;
    this.parentElement.parentElement.classList.toggle('selected');
  }

  function removeAllSelected() {
    if (!active) return;
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('.selected'));
  }

  function togglePolling() {
    if (!active) return;
    if (polling) {
      polling = false;
      document.querySelector('[data-polling] .bi-skip-forward-circle-fill').style.display = "block";
      document.querySelector('[data-polling] .bi-stop-circle-fill').style.display = "none";
    } else {
      polling = true;
      document.querySelector('[data-polling] .bi-skip-forward-circle-fill').style.display = "none";
      document.querySelector('[data-polling] .bi-stop-circle-fill').style.display = "block";
      let pollingInterval = setInterval(() => {
        if (!polling) {
          clearInterval(pollingInterval);
        } else {
          init();
        }
      }, 5000);
    }
  }

  function pollingOff() {
    if (!active) return;
    if (!document.querySelector('[data-polling]')) return;
    polling = false;
    document.querySelector('[data-polling] .bi-skip-forward-circle-fill').style.display = "block";
    document.querySelector('[data-polling] .bi-stop-circle-fill').style.display = "none";
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

  function updateSegments() {
    const course = courses.find(c => c.id == (document.getElementById("course-period-input") ? document.getElementById("course-period-input").value : document.getElementById("sort-course-input") ? document.getElementById("sort-course-input").value - 1 : null));
    if (document.getElementById("course-input")) document.getElementById("course-input").value = course.name;
    var c = segments.filter(s => s.course == course.id);
    if (course.syllabus) {
      if (document.querySelector('[data-syllabus-upload]')) document.querySelector('[data-syllabus-upload]').setAttribute('hidden', '');
      if (document.querySelector('[data-syllabus-remove]')) document.querySelector('[data-syllabus-remove]').parentElement.removeAttribute('hidden');
      if (document.querySelector('[data-syllabus-download]')) document.querySelector('[data-syllabus-download]').addEventListener("click", () => {
        window.open(course.syllabus, '_blank');
      });
      if (document.querySelector('[data-syllabus-remove]')) document.querySelector('[data-syllabus-remove]').addEventListener("click", () => {
        fetch(domain + '/syllabus', {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course_id: course.id
          }),
        })
          .then(s => s.json())
          .then(() => {
            init();
          })
          .catch((e) => {
            console.error(e);
            ui.view("api-fail");
            pollingOff();
          });
      });
    } else {
      if (document.querySelector('[data-syllabus-remove]')) document.querySelector('[data-syllabus-remove]').parentElement.setAttribute('hidden', '');
      if (document.querySelector('[data-syllabus-upload]')) document.querySelector('[data-syllabus-upload]').removeAttribute('hidden');
      if (document.querySelector('[data-syllabus-upload]')) {
        document.querySelector('[data-syllabus-upload]').addEventListener("click", () => {
          const url = '/admin/upload.html?syllabus=' + course.id;
          const width = 600;
          const height = 150;
          const left = (window.screen.width / 2) - (width / 2);
          const top = (window.screen.height / 2) - (height / 2);
          const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
          const newWindow = window.open(url, '_blank', windowFeatures);
          let uploadSSuccessful = false;
          window.addEventListener('message', (event) => {
            if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
            if (event.data === 'uploadSuccess') uploadSSuccessful = true;
          }, false);
          const checkWindowClosed = setInterval(function () {
            if (newWindow && newWindow.closed) {
              clearInterval(checkWindowClosed);
              if (uploadSSuccessful) {
                ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
              } else {
                ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, "Upload Cancelled");
              }
              init();
            }
          }, 1000);
        });
      }
    }
    if (document.querySelector('.segment-reports')) document.querySelector('.segment-reports').innerHTML = '';
    if (c.length > 0) {
      if (document.querySelector('.segments .section')) document.querySelector('.segments .section').innerHTML = '';
      if (document.querySelector(".segment-reorder .reorder")) document.querySelector(".segment-reorder .reorder").innerHTML = '';
      if (document.querySelector('.segments .section') || document.querySelector(".segment-reorder .reorder")) {
        c.sort((a, b) => a.order - b.order).forEach(s => {
          if (document.querySelector('.segments .section')) {
            var segment = document.createElement('div');
            segment.className = "section";
            segment.id = `segment-${s.number}`;
            var buttonGrid = document.createElement('div');
            buttonGrid.className = "button-grid inputs";
            buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="${s.number}" placeholder="${s.number}" /></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="${s.name}" placeholder="${s.name}" /></div></div><div class="input-group mediuml"><div class="space" id="question-container"><input type="date" id="segment-due-date" value="${s.due || ''}"></div></div><button square data-remove-segment-input><i class="bi bi-trash"></i></button><button square data-toggle-segment><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
            segment.appendChild(buttonGrid);
            var questionsString = "";
            var questions = document.createElement('div');
            questions.classList = "questions";
            JSON.parse(s.question_ids).forEach(q => {
              questionsString += `<div class="input-group"><div class="drag"><i class="bi bi-grip-vertical"></i></div><input type="text" autocomplete="off" id="segment-question-name-input" value="${q.name}" placeholder="${q.name}" /><input type="number" autocomplete="off" id="segment-question-id-input" value="${q.id}" placeholder="${q.id}" /></div>`;
            });
            questions.innerHTML = `<div class="button-grid"><button class="space fit" id="sort-segment-questions-increasing">Sort Increasing (1A-9Z)</button><button class="space fit" id="sort-segment-questions-decreasing">Sort Decreasing (9Z-1A)</button></div><br><div class="button-grid inputs"><div class="input-group small"><label>Name</label><label>ID</label></div>${questionsString}<div class="input-group fit"><button square data-add-segment-question-input><i class="bi bi-plus"></i></button><button square data-remove-segment-question-input${(JSON.parse(s.question_ids).length === 1) ? ' disabled' : ''}><i class="bi bi-dash"></i></button></div></div>`;
            segment.appendChild(questions);
            document.querySelector('.segments .section').appendChild(segment);
          }
          if (document.querySelector(".segment-reorder .reorder")) {
            const elem = document.createElement("div");
            elem.classList = "button-grid inputs";
            elem.style = "flex-wrap: nowrap !important;";
            elem.innerHTML = `<input type="text" autocomplete="off" id="segment-${s.number}" value="${s.name || ''}" /><div class="drag"><i class="bi bi-grip-vertical"></i></div>`;
            document.querySelector(".segment-reorder .reorder").appendChild(elem);
          }
        });
      }
      if (document.querySelector('.segments .section')) document.querySelector('.segments .section').innerHTML += '<button data-add-segment-input>Add Segment</button>';
      if (document.querySelector('.segment-reports')) {
        c.sort((a, b) => a.order - b.order).forEach(segment => {
          var detailedReport = '';
          JSON.parse(segment.question_ids).forEach(q => {
            var question = questions.find(q1 => q1.id == q.id);
            var questionResponses = responses.filter(r => String(r.segment) === String(segment.number)).filter(r => r.question_id === question.id);
            detailedReport += `<div class="detailed-report-question">
              <b>Question ${question.number} (${questionResponses.length} Response${(questionResponses.length != 1) ? 's' : ''})</b>
              <div class="barcount-wrapper">
                <div class="barcount correct"${(questionResponses.length != 0) ? ` style="width: calc(${questionResponses.filter(r => r.status === 'Correct').length / (questionResponses.length || 1)} * 100%)"` : ''}>${questionResponses.filter(r => r.status === 'Correct').length}</div>
                <div class="barcount incorrect"${(questionResponses.length != 0) ? ` style="width: calc(${questionResponses.filter(r => r.status === 'Incorrect').length / (questionResponses.length || 1)} * 100%)"` : ''}>${questionResponses.filter(r => r.status === 'Incorrect').length}</div>
                <div class="barcount other"${(questionResponses.length != 0) ? ` style="width: calc(${questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length / (questionResponses.length || 1)} * 100%)"` : ''}>${questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length}</div>
                <div class="barcount waiting"${(questionResponses.length != 0) ? ` style="width: calc(${questionResponses.filter(r => r.status.includes('Recorded')).length / (questionResponses.length || 1)} * 100%)"` : ''}>${questionResponses.filter(r => r.status.includes('Recorded')).length}</div>
              </div>
            </div>`;
          });
          document.querySelector('.segment-reports').innerHTML += `<div class="segment-report"${(JSON.parse(segment.question_ids) != 0) ? ` report="segment-${segment.number}"` : ''}>
            <b>Segment ${segment.number} (${JSON.parse(segment.question_ids).length} Question${JSON.parse(segment.question_ids).length != 1 ? 's' : ''})</b>
          </div>
          ${(JSON.parse(segment.question_ids) != 0) ? ` <div class="section detailed-report" id="segment-${segment.number}">
            ${detailedReport}
          </div>` : ''}`;
        });
      }
    } else {
      if (document.querySelector('.segments .section')) document.querySelector('.segments .section').innerHTML = '<button data-add-segment-input>Add Segment</button>';
    }
    document.querySelectorAll('[data-add-segment-input]').forEach(a => a.addEventListener('click', addSegment));
    document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
    document.querySelectorAll('[data-add-segment-question-input]').forEach(a => a.addEventListener('click', addSegmentQuestion));
    document.querySelectorAll('[data-remove-segment-question-input]').forEach(a => a.addEventListener('click', removeSegmentQuestion));
    document.querySelectorAll('[data-toggle-segment]').forEach(a => a.addEventListener('click', toggleSegment));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
    if (document.getElementById('sort-segment-questions-increasing')) document.getElementById('sort-segment-questions-increasing').addEventListener('click', sortSegmentQuestionsIncreasing);
    if (document.getElementById('sort-segment-questions-decreasing')) document.getElementById('sort-segment-questions-decreasing').addEventListener('click', sortSegmentQuestionsDecreasing);
    document.querySelectorAll('.drag').forEach(item => {
      item.setAttribute('draggable', true);
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('drop', handleDropSegment);
    });
    document.querySelectorAll('[report]').forEach(a => a.addEventListener('click', toggleDetailedReport));
  }

  function toggleSegment() {
    if (!active) return;
    this.parentElement.parentElement.classList.toggle('expanded');
  }

  function calculateButtonHeights(container) {
    if (!active) return;
    let totalHeight = 0;
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      const style = window.getComputedStyle(button);
      if (style.display !== 'none') {
        totalHeight += button.getBoundingClientRect().height;
      }
    });
    return totalHeight;
  }

  // Save Course Order
  document.getElementById("save-course-order-button")?.addEventListener("click", () => {
    if (!active) return;
    var updatedCourses = [...document.querySelector(".reorder").children].map((course, i) => {
      const courseId = course.querySelector('input').id.split('-')[1];
      return {
        id: courseId,
        name: document.getElementById(`course-${courseId}`).value,
        period: i + 1
      };
    }).sort((a, b) => a.period - b.period);
    fetch(domain + '/courses', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedCourses)
    })
      .then(r => r.json())
      .then(c => {
        courses = c;
        if (document.querySelector(".course-reorder .reorder")) document.querySelector(".course-reorder .reorder").innerHTML = "";
        document.getElementById("course-period-input").innerHTML = "";
        c.sort((a, b) => a.period - b.period).forEach(course => {
          const option = document.createElement("option");
          option.value = course.id;
          option.innerHTML = document.getElementById("course-input") ? course.period : `${course.period}${course.name ? ` (${course.name})` : ''}`;
          document.getElementById("course-period-input").appendChild(option);
          const elem = document.createElement("div");
          elem.classList = "button-grid inputs";
          elem.style = "flex-wrap: nowrap !important;";
          elem.innerHTML = `<input type="text" autocomplete="off" id="course-${course.id}" value="${course.name || ''}" placeholder="${course.name || ''}" /><div class="drag"><i class="bi bi-grip-vertical"></i></div>`;
          if (document.querySelector(".course-reorder .reorder")) document.querySelector(".course-reorder .reorder").appendChild(elem);
        });
        const course = courses.find(c => c.id == document.getElementById("course-period-input").value);
        if (document.getElementById("course-input")) document.getElementById("course-input").value = course.name;
        document.querySelectorAll('.drag').forEach(item => {
          item.setAttribute('draggable', true);
          item.addEventListener('dragstart', handleDragStart);
          item.addEventListener('dragover', handleDragOver);
          item.addEventListener('drop', handleDropCourse);
        });
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
      });
    // Show submit confirmation
    ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
  });

  // Save Segment Order
  document.getElementById("save-segment-order-button")?.addEventListener("click", () => {
    if (!active) return;
    var updatedSegments = [...document.querySelector(".segment-reorder .reorder").children].map((segment, i) => {
      const segmentNumber = segment.querySelector('input').id.split('-')[1];
      return {
        order: i,
        number: segmentNumber,
        name: segment.querySelector('input').value,
        question_ids: segments.find(s => String(s.number) === String(segmentNumber)).question_ids,
        course: Number(document.getElementById("course-period-input").value),
        due: segments.find(s => String(s.number) === String(segmentNumber)).due
      };
    }).sort((a, b) => a.order - b.order);
    fetch(domain + '/segments', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedSegments)
    })
      .then(r => r.json())
      .then(c => {
        segments = c;
        updateSegments();
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
      });
    // Show submit confirmation
    ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
  });

  // Save
  document.querySelectorAll("#save-button").forEach(w => w.addEventListener("click", save));

  async function save(hideResult) {
    if (!active) return;
    removeAllSelected();
    removeSelecting();
    var updatedInfo = {};
    if (document.getElementById('course-period-input')) {
      updatedInfo = {
        course: {
          id: document.getElementById("course-period-input").value,
          name: document.getElementById("course-input").value,
        },
        segments: []
      };
      var segmentOrder = 0;
      Array.from(document.querySelectorAll('.segments .section .section'))
        .filter(w => w.id)
        .forEach(segment => {
          updatedInfo.segments.push({
            order: segmentOrder,
            id: segment.id.split('-')[1],
            number: segment.querySelector('#segment-number-input').value,
            name: segment.querySelector('#segment-name-input').value,
            question_ids: JSON.stringify(Array.from(segment.querySelectorAll('#segment-question-name-input')).filter(q => (q.value.length > 0) && (q.value != ' ') && (q.nextElementSibling.value.length > 0) && (q.nextElementSibling.value != ' ')).map(q => {
              return {
                name: q.value,
                id: q.nextElementSibling.value
              };
            })),
            due: segment.querySelector('#segment-due-date').value || null,
          });
          segmentOrder++;
        });
    } else if (document.querySelector('.questions.section')) {
      updatedInfo = {
        questions: []
      };
      Array.from(document.querySelectorAll('.questions .section .section'))
        .filter(w => w.id)
        .forEach(question => {
          updatedInfo.questions.push({
            id: question.id.split('-')[1],
            number: question.querySelector('#question-number-input').value,
            segment: question.querySelector('#question-segment-input').value,
            question: question.querySelector('#question-text-input').value,
            images: Array.from(question.querySelectorAll('.attachments img')).map(q => {
              return q.src;
            }),
            correctAnswers: Array.from(question.querySelectorAll('#question-correct-answer-input')).map(q => {
              return q.value;
            }),
            incorrectAnswers: Array.from(question.querySelectorAll('.incorrectAnswers .inputs')).map(q => {
              return {
                answer: q.querySelector('#question-incorrect-answer-input').value,
                reason: q.querySelector('#question-incorrect-answer-reason-input').value
              };
            }),
            latex: question.querySelector('[data-toggle-latex] i').classList.contains('bi-calculator-fill')
          });
        });
    }
    for (const key in updatedInfo) {
      if (Object.prototype.hasOwnProperty.call(updatedInfo, key)) {
        formData.append(key, JSON.stringify(updatedInfo[key]));
      }
    }
    fetch(domain + '/save', {
      method: "POST",
      body: formData,
    })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
      });
    document.querySelectorAll("#save-button").forEach(w => w.disabled = true);
    window.scroll(0, 0);
    if ((typeof hideResult != 'boolean')) ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
    init();
    setTimeout(() => {
      document.querySelectorAll("#save-button").forEach(w => w.disabled = false);
    }, 2500);
  }

  function handleDragStart(e) {
    if (!active) return;
    draggedItem = this.parentNode;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    if (!active) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDropCourse(e) {
    if (!active) return;
    e.stopPropagation();
    const targetItem = this.parentNode;
    if (draggedItem !== targetItem) {
      let parent = draggedItem.parentNode;
      parent.insertBefore(draggedItem, targetItem);
    }
    const newOrder = [...document.querySelectorAll('.dragCourse')].sort((a, b) => {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });
    const parent = document.querySelector('.course-reorder .reorder');
    newOrder.forEach(item => parent.appendChild(item));
    return false;
  }

  function handleDropSegment(e) {
    if (!active) return;
    e.stopPropagation();
    const targetItem = this.parentNode;
    if (draggedItem !== targetItem) {
      let parent = draggedItem.parentNode;
      parent.insertBefore(draggedItem, targetItem);
    }
    const newOrder = [...document.querySelectorAll('.dragSegment')].sort((a, b) => {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });
    const parent = document.querySelector('.segment-reorder .reorder');
    newOrder.forEach(item => parent.appendChild(item));
    return false;
  }

  function addSegment() {
    if (!active) return;
    var group = document.createElement('div');
    group.className = "section";
    group.id = 'segment-new';
    var buttonGrid = document.createElement('div');
    buttonGrid.className = "button-grid inputs";
    buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="0" /></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="" /></div></div><div class="input-group mediuml"><div class="space" id="question-container"><input type="date" id="segment-due-date"></div></div><button square data-remove-segment-input><i class="bi bi-trash"></i></button><button square data-toggle-segment><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
    group.appendChild(buttonGrid);
    var questions = document.createElement('div');
    questions.classList = "questions";
    questions.innerHTML = `<div class="button-grid inputs"><div class="input-group small"><label>Name</label><label>ID</label></div><div class="input-group"><input type="text" autocomplete="off" id="segment-question-name-input" value="" /><input type="text" autocomplete="off" id="segment-question-id-input" value="" /></div><div class="input-group fit"><button square data-add-segment-question-input><i class="bi bi-plus"></i></button><button square data-remove-segment-question-input disabled><i class="bi bi-dash"></i></button></div></div>`;
    group.appendChild(questions);
    this.parentElement.insertBefore(group, this.parentElement.children[this.parentElement.children.length - 1]);
    document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.removeEventListener('click', removeSegment));
    document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
    document.querySelectorAll('[data-add-segment-question-input]').forEach(a => a.addEventListener('click', addSegmentQuestion));
    document.querySelectorAll('[data-remove-segment-question-input]').forEach(a => a.addEventListener('click', removeSegmentQuestion));
    document.querySelectorAll('[data-toggle-segment]').forEach(a => a.addEventListener('click', toggleSegment));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
  }

  function removeSegment() {
    if (!active) return;
    this.parentElement.parentElement.remove();
  }

  function addSegmentQuestion() {
    if (!active) return;
    var group = document.createElement('div');
    group.className = "input-group";
    group.innerHTML = `<input type="text" autocomplete="off" id="segment-question-name-input" value="" /><input type="number" autocomplete="off" id="segment-question-id-input" value="" />`;
    this.parentElement.parentElement.insertBefore(group, this.parentElement);
    this.parentElement.querySelector('[data-remove-segment-question-input]').disabled = false;
    this.parentElement.querySelector('[data-remove-segment-question-input]').addEventListener('click', removeSegmentQuestion);
  }

  function removeSegmentQuestion() {
    if (!active) return;
    this.parentElement.parentElement.children[this.parentElement.parentElement.children.length - 2].remove();
    if (this.parentElement.parentElement.children.length === 3) {
      this.parentElement.querySelector('[data-remove-segment-question-input]').disabled = true;
    }
  }

  function updateQuestions() {
    if (questions.length > 0) {
      document.querySelector('.questions .section').innerHTML = '';
      questions.forEach(q => {
        var question = document.createElement('div');
        question.className = "section";
        question.id = `question-${q.id}`;
        var buttonGrid = document.createElement('div');
        buttonGrid.className = "button-grid inputs";
        var segmentsString = "";
        segments.forEach(s => segmentsString += `<option value="${s.number}"${(segments.filter(e => JSON.parse(e.question_ids).find(qId => qId.id == q.id))[0].number === s.number) ? ' selected' : ''}>${s.number}</option>`);
        buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="${q.id}" disabled /></div></div><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="${q.number}" placeholder="${q.number}" /></div></div><div class="input-group small"><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="${q.question}" placeholder="${q.question}" /></div></div><button square data-toggle-latex><i class="bi bi-${q.latex ? 'calculator-fill' : 'cursor-text'}"></i></button><button square data-remove-question-input><i class="bi bi-trash"></i></button><button square data-toggle-question><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
        question.appendChild(buttonGrid);
        var images = document.createElement('div');
        images.classList = "attachments";
        JSON.parse(q.images).forEach(q => {
          var image = document.createElement('div');
          image.classList = "image";
          image.innerHTML = `<img src="${q}" />`;
          image.addEventListener('click', removeImage);
          images.appendChild(image);
        });
        var drop = document.createElement('div');
        drop.classList = "drop";
        drop.innerHTML = "+";
        drop.id = q.id;
        drop.addEventListener('click', renderPond);
        images.appendChild(drop);
        question.appendChild(images);
        var correctAnswers = document.createElement('div');
        correctAnswers.classList = "answers";
        var correctAnswersString = "";
        var questionAnswers = answers.find(a => a.id === q.id);
        questionAnswers.correct_answers.forEach(a => {
          correctAnswersString += `<div class="button-grid inputs"><input type="text" autocomplete="off" id="question-correct-answer-input" value="${a}" placeholder="${a}" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button></div>`;
        });
        correctAnswers.innerHTML = `<b>Correct Answers</b><div class="section correctAnswers">${correctAnswersString}<button data-add-correct-answer-input>Add Correct Answer</button></div>`;
        question.appendChild(correctAnswers);
        var incorrectAnswers = document.createElement('div');
        incorrectAnswers.classList = "answers";
        var incorrectAnswersString = "";
        questionAnswers.incorrect_answers.forEach(a => {
          incorrectAnswersString += `<div class="button-grid inputs"><input type="text" autocomplete="off" id="question-incorrect-answer-input" value="${a.answer}" placeholder="${a.answer}" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="${a.reason}" placeholder="${a.reason}" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button></div>`;
        });
        incorrectAnswers.innerHTML = `<b>Incorrect Answers</b><div class="section incorrectAnswers">${incorrectAnswersString}<button data-add-incorrect-answer-input>Add Incorrect Answer</button></div>`;
        question.appendChild(incorrectAnswers);
        document.querySelector('.questions .section').appendChild(question);
      });
      var addQuestionButton = document.createElement('button');
      addQuestionButton.setAttribute('data-add-question-input', '');
      addQuestionButton.innerText = "Add Question";
      document.querySelector('.questions .section').appendChild(addQuestionButton);
    } else {
      document.querySelector('.questions .section').innerHTML = '<button data-add-question-input>Add Question</button>';
    }
    document.querySelectorAll('[data-add-question-input]').forEach(a => a.addEventListener('click', addQuestion));
    document.querySelectorAll('[data-remove-question-input]').forEach(a => a.addEventListener('click', removeQuestion));
    document.querySelectorAll('[data-toggle-question]').forEach(a => a.addEventListener('click', toggleQuestion));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
    document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
    document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
    document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
    document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
    document.querySelectorAll('[data-toggle-latex]').forEach(a => a.addEventListener('click', toggleQuestionLatex));
  }

  function addCorrectAnswer() {
    if (!active) return;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-correct-answer-input" value="" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button>`;
    this.parentElement.insertBefore(input, this);
    document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
    document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
  }

  function addIncorrectAnswer() {
    if (!active) return;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-incorrect-answer-input" value="" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button>`;
    this.parentElement.insertBefore(input, this);
    document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
    document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
  }

  function removeCorrectAnswer() {
    if (!active) return;
    this.parentElement.remove();
  }

  function removeIncorrectAnswer() {
    if (!active) return;
    this.parentElement.remove();
  }

  function toggleQuestionLatex() {
    if (!active) return;
    this.disabled = true;
    const icon = this.querySelector('i');
    const question_id = this.parentElement.querySelector('#question-id-input').value;
    var isLatex = false;
    if (!icon.classList.contains('bi-cursor-text')) isLatex = true;
    fetch(domain + `/question/${isLatex ? 'not_' : ''}latex`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id
      })
    })
      .then(r => r.json())
      .then(q => {
        if (icon.classList.contains('bi-cursor-text')) {
          icon.classList.remove('bi-cursor-text');
          icon.classList.add('bi-calculator-fill');
          ui.toast("Question name marked as LaTeX.", 3000, "success", "bi bi-calculator-fill");
        } else {
          icon.classList.remove('bi-calculator-fill');
          icon.classList.add('bi-cursor-text');
          ui.toast("Question name marked as plain text.", 3000, "success", "bi bi-cursor-text");
        }
        this.disabled = false;
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
      });
  }

  function toggleQuestion() {
    if (!active) return;
    if (this.parentElement.parentElement.classList.contains('expanded')) {
      hideAllQuestions();
    } else {
      hideAllQuestions();
      this.parentElement.parentElement.classList.add('expanded');
      document.querySelector('[data-add-question-input]').style.display = "none";
      document.querySelectorAll('#save-button').forEach(w => w.style.display = "none");
    }
  }

  function hideAllQuestions() {
    if (!active) return;
    document.querySelectorAll('.expanded').forEach(q => q.classList.remove('expanded'));
    document.querySelector('[data-add-question-input]').style.display = "block";
    document.querySelectorAll('#save-button').forEach(w => w.style.display = "block");
  }

  function addQuestion() {
    if (!active) return;
    var group = document.createElement('div');
    group.className = "section";
    group.id = 'question-new';
    var buttonGrid = document.createElement('div');
    buttonGrid.className = "button-grid inputs";
    var segmentsString = "";
    segments.forEach(s => segmentsString += `<option value="${s.number}">${s.number}</option>`);
    buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="" disabled /></div></div><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="" /></div></div><div class="input-group small"><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="" /></div></div><button square data-toggle-latex disabled><i class="bi bi-cursor-text"></i></button><button square data-remove-question-input><i class="bi bi-trash"></i></button><button square data-toggle-question><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
    group.appendChild(buttonGrid);
    this.parentElement.insertBefore(group, this.parentElement.children[this.parentElement.children.length - 1]);
    document.querySelectorAll('[data-add-question-input]').forEach(a => a.addEventListener('click', addQuestion));
    document.querySelectorAll('[data-remove-question-input]').forEach(a => a.addEventListener('click', removeQuestion));
    document.querySelectorAll('[data-toggle-question]').forEach(a => a.addEventListener('click', toggleQuestion));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
  }

  function removeQuestion() {
    if (!active) return;
    this.parentElement.parentElement.remove();
    hideAllQuestions();
  }

  async function renderPond() {
    if (!active) return;
    await save(true);
    const url = '/admin/upload.html?question=' + this.id;
    const width = 600;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
    const newWindow = window.open(url, '_blank', windowFeatures);
    let uploadSuccessful = false;
    window.addEventListener('message', (event) => {
      if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      if (event.data === 'uploadSuccess') uploadSuccessful = true;
    }, false);
    const checkWindowClosed = setInterval(function () {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindowClosed);
        if (uploadSuccessful) {
          ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
        } else {
          ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, "Upload Cancelled");
        }
        init();
      }
    }, 1000);
  }

  async function removeImage(event) {
    if (!active) return;
    await save(true);
    const element = event.target;
    const rect = element.getBoundingClientRect();
    const clickYRelativeToElement = event.clientY - rect.top;
    const distanceFromBottom = rect.height - clickYRelativeToElement;
    if (distanceFromBottom <= 26) {
      await fetch(domain + '/upload', {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: event.target.parentElement.parentElement.querySelector('#question-id-input').value,
          file_url: event.target.querySelector('img').src
        }),
      })
        .then(q => q.json())
        .then(() => {
          ui.modeless(`<i class="bi bi-file-earmark-x"></i>`, "Removed");
          init();
        })
        .catch((e) => {
          console.error(e);
          ui.view("api-fail");
          pollingOff();
        });
    } else {
      window.open(event.target.src);
    }
  }

  async function updateResponses() {
    if (document.querySelector('.awaitingResponses .section')) document.querySelector('.awaitingResponses .section').innerHTML = '';
    if (document.querySelector('.trendingResponses .section')) document.querySelector('.trendingResponses .section').innerHTML = '';
    if (document.querySelector('.responses .section')) document.querySelector('.responses .section').innerHTML = '';
    if (document.querySelector('.seat-code-reports')) document.querySelector('.seat-code-reports').innerHTML = '';
    var trendingResponses = [];
    var timedResponses = [];
    var responses1 = responses
      .filter(r => String(r.seatCode)[0] == document.getElementById("sort-course-input")?.value)
      .filter(r => String(r.segment).startsWith(document.getElementById("sort-segment-input")?.value))
      .filter(r => questions.find(q => q.id == r.question_id).number.startsWith(document.getElementById("sort-question-input")?.value))
      .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
      .sort((a, b) => {
        if (a.flagged && !b.flagged) return -1;
        if (!a.flagged && b.flagged) return 1;
        return b.id - a.id;
      });
    var seatCodes = [];
    responses1.forEach(r => {
      if (document.querySelector('.responses .section') || document.querySelector('.awaitingResponses .section')) {
        var responseString = r.response;
        if (responseString.includes('[')) {
          var parsedResponse = JSON.parse(r.response);
          responseString = parsedResponse.join(', ');
        }
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
        buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.id}" disabled hidden />${(r.flagged == '1') ? `<button square data-unflag-response><i class="bi bi-flag-fill"></i></button>` : `<button square data-flag-response><i class="bi bi-flag"></i></button>`}<input type="text" autocomplete="off" class="small" id="response-segment-input" value="${r.segment}" disabled data-segment /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => q.id == r.question_id).number}" disabled data-question /><input type="text" autocomplete="off" class="small" id="response-seat-code-input" value="${r.seatCode}" disabled data-seat-code /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTaken}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTakenToRevise}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><!--<input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${result}" disabled data-time-taken />--><input type="text" autocomplete="off" id="response-response-input" value="${responseString}" disabled />${(r.status === 'Incorrect') ? `<button square data-edit-reason><i class="bi bi-reply${(r.reason) ? '-fill' : ''}"></i></button>` : ''}<input type="text" autocomplete="off" class="smedium" id="response-timestamp-input" value="${date.getMonth() + 1}/${date.getDate()} ${hours % 12 || 12}:${minutes < 10 ? '0' + minutes : minutes} ${hours >= 12 ? 'PM' : 'AM'}" disabled /><button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''}><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''}><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
        if (document.querySelector('.responses .section')) document.querySelector('.responses .section').appendChild(buttonGrid);
        if (((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')) document.querySelector('.awaitingResponses .section').appendChild(buttonGrid);
      }
      var trend = trendingResponses.find(t => (t.segment === r.segment) && (t.question_id === r.question_id) && (t.response === responseString) && (t.status === r.status));
      if (trend) {
        trend.count++;
      } else {
        trendingResponses.push({
          segment: r.segment,
          question_id: r.question_id,
          response: r.response,
          status: r.status,
          count: 1
        });
      }
      if (document.querySelector('.seat-code-reports')) {
        if (seatCodes.find(seatCode => seatCode.code === r.seatCode)) {
          const seatCode = seatCodes.find(seatCode => seatCode.code === r.seatCode);
          if (r.status === 'Correct') {
            seatCode.correct++;
          } else if (r.status === 'Incorrect') {
            seatCode.incorrect++;
          } else if (r.status.includes('Recorded')) {
            seatCode.waiting++;
          } else {
            seatCode.other++;
          }
          seatCode.total++;
          seatCode.responses.push(r);
        } else {
          seatCodes.push({
            code: r.seatCode,
            correct: (r.status === 'Correct') ? 1 : 0,
            incorrect: (r.status === 'Incorrect') ? 1 : 0,
            other: ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded')) ? 1 : 0,
            waiting: r.status.includes('Recorded') ? 1 : 0,
            total: 1,
            responses: [r],
          });
        }
      }
    });
    if (document.querySelector('.seat-code-reports')) {
      seatCodes.sort((a, b) => Number(a.code) - Number(b.code)).forEach(seatCode => {
        var detailedReport = '';
        var seatCodeResponses = seatCode.responses.sort((a, b) => a.timestamp - b.timestamp);
        if (document.getElementById('hideIncorrectAttempts').checked) seatCodeResponses = seatCodeResponses.filter((r, index, self) => r.status === 'Correct' || !self.some(other => other.question_id === r.question_id && other.status === 'Correct'));
        seatCodeResponses.forEach(r => {
          detailedReport += questions.find(q => q.id == r.question_id).number ? `<div class="detailed-report-question">
            <div class="color">
              <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
              <span class="color-name">Segment ${r.segment} Question ${questions.find(q => q.id == r.question_id).number} (${time.unixToString(r.timestamp)})</span>
            </div>
            <div class="color">
              <span class="color-name">${r.status}</span>
              <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
            </div>
          </div>` : '';
        });
        document.querySelector('.seat-code-reports').innerHTML += `<div class="seat-code-report" report="seat-code-${seatCode.code}">
          <b>${seatCode.code} (${seatCode.total} Response${(seatCode.total != 1) ? 's' : ''})</b>
          <div class="barcount-wrapper">
            <div class="barcount correct"${(seatCode.total != 0) ? ` style="width: calc(${seatCode.correct / (seatCode.total || 1)} * 100%)"` : ''}>${seatCode.correct}</div>
            <div class="barcount incorrect"${(seatCode.total != 0) ? ` style="width: calc(${seatCode.incorrect / (seatCode.total || 1)} * 100%)"` : ''}>${seatCode.incorrect}</div>
            <div class="barcount other"${(seatCode.total != 0) ? ` style="width: calc(${seatCode.other / (seatCode.total || 1)} * 100%)"` : ''}>${seatCode.other}</div>
            <div class="barcount waiting"${(seatCode.total != 0) ? ` style="width: calc(${seatCode.waiting / (seatCode.total || 1)} * 100%)"` : ''}>${seatCode.waiting}</div>
          </div>
        </div>
        <div class="section detailed-report" id="seat-code-${seatCode.code}">
          ${detailedReport}
        </div>`;
      });
    }
    const stdDev = calculateStandardDeviation(timedResponses);
    // console.log("Standard Deviation:", stdDev);
    document.querySelectorAll('[data-time-taken]').forEach(d => {
      if (d.hasAttribute('time') && (Number(d.getAttribute('time')) > stdDev)) d.classList.add('disabled');
    });
    trendingResponses.filter(t => t.count > 1).forEach(r => {
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-segment-input" value="${r.segment}" disabled data-segment /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => q.id == r.question_id).number}" disabled data-question /><input type="text" autocomplete="off" id="response-response-input" value="${r.response}" disabled /><input type="text" autocomplete="off" class="small" id="response-count-input" value="${r.count}" disabled /><button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''}><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''}><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      document.querySelector('.trendingResponses .section').appendChild(buttonGrid);
    });
    document.querySelectorAll('#mark-correct-button').forEach(a => a.addEventListener('click', markCorrect));
    document.querySelectorAll('#mark-incorrect-button').forEach(a => a.addEventListener('click', markIncorrect));
    document.querySelectorAll('[data-flag-response]').forEach(a => a.addEventListener('click', flagResponse));
    document.querySelectorAll('[data-unflag-response]').forEach(a => a.addEventListener('click', unflagResponse));
    document.querySelectorAll('[data-edit-reason]').forEach(a => a.addEventListener('click', editReason));
    document.querySelectorAll('[report]').forEach(a => a.addEventListener('click', toggleDetailedReport));
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
    fetch(domain + '/flag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: this.parentElement.querySelector('#response-id-input').value,
        seatCode: this.parentElement.querySelector('#response-seat-code-input').value,
      }),
    })
      .then(q => q.json())
      .then(() => {
        ui.toast("Flagged response for review.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
      });
  }

  function unflagResponse() {
    if (!active) return;
    fetch(domain + '/unflag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: this.parentElement.querySelector('#response-id-input').value,
        seatCode: this.parentElement.querySelector('#response-seat-code-input').value,
      }),
    })
      .then(q => q.json())
      .then(() => {
        ui.toast("Unflagged response.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
      });
  }

  function markCorrect() {
    if (!active) return;
    fetch(domain + '/mark_correct', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questions.find(q => q.number == this.parentElement.querySelector('#response-question-input').value).id,
        answer: responses.find(q => q.id == this.parentElement.querySelector('#response-id-input').value).response
      }),
    })
      .then(q => q.json())
      .then(() => {
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
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
        defaultValue: '',
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
    fetch(domain + '/mark_incorrect', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questions.find(q => q.number == e.parentElement.querySelector('#response-question-input').value).id,
        answer: responses.find(q => q.id == e.parentElement.querySelector('#response-id-input').value).response,
        reason: reason
      }),
    })
      .then(q => q.json())
      .then(() => {
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
      });
  }

  function editReason() {
    if (!active) return;
    ui.modal({
      title: 'Edit Reason',
      body: '<p>Edit your reason that this response is incorrect.</p>',
      input: {
        type: 'text',
        placeholder: responses.find(r => r.id == this.parentElement.querySelector('#response-id-input').value).reason || '',
        defaultValue: responses.find(r => r.id == this.parentElement.querySelector('#response-id-input').value).reason || '',
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

  function toggleSpeedMode() {
    if (!active) return;
    if (!speed) return ui.view("speed");
    speed = false;
    document.querySelector('[data-speed] .bi-lightning-charge').style.display = "block";
    document.querySelector('[data-speed] .bi-lightning-charge-fill').style.display = "none";
  }

  function updateSpeedModeSegments() {
    document.getElementById("speed-mode-segments").innerHTML = '';
    segments.forEach(segment => {
      var option = document.createElement('option');
      option.value = segment.number;
      option.innerHTML = segment.name;
      document.getElementById("speed-mode-segments").appendChild(option);
    });
  }

  function enableSpeedMode() {
    ui.view();
    speed = true;
    document.querySelector('[data-speed] .bi-lightning-charge').style.display = "none";
    document.querySelector('[data-speed] .bi-lightning-charge-fill').style.display = "block";
    var segmentId = document.getElementById("speed-mode-segments").value;
    renderSpeedPond(segmentId);
  }

  function disableSpeedMode() {
    ui.view();
    speed = false;
    document.querySelector('[data-speed] .bi-lightning-charge').style.display = "block";
    document.querySelector('[data-speed] .bi-lightning-charge-fill').style.display = "none";
    ui.modeless(`<i class="bi bi-check2-circle"></i>`, "Speed Mode Ended");
    window.location.reload();
  }

  async function renderSpeedPond(segment) {
    if (!active) return;
    const url = '/admin/upload.html?segment=' + segment;
    const width = 600;
    const height = 150;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
    const newWindow = window.open(url, '_blank', windowFeatures);
    let uploadSuccessful = false;
    window.addEventListener('message', (event) => {
      if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      if (event.data === 'uploadSuccess') uploadSuccessful = true;
    }, false);
    const checkWindowClosed = setInterval(function () {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindowClosed);
        if (uploadSuccessful) {
          ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
          renderSpeedPond(segment);
        } else {
          disableSpeedMode();
        }
        init();
      }
    }, 1000);
  }

  function toggleReorder() {
    if (!active) return;
    if (reorder) {
      reorder = false;
      document.querySelector('[data-reorder] .bi-arrows-move').style.display = "block";
      document.querySelector('[data-reorder] .bi-x').style.display = "none";
      const reorderSections = document.querySelectorAll(':has(> .reorder)');
      reorderSections.forEach(reorderSection => {
        const fromHeight = reorderSection?.getBoundingClientRect().height;
        reorderSection.parentElement.querySelector('.selector').style.display = 'flex';
        document.querySelectorAll('#save-button').forEach(w => w.style.display = '');
        reorderSection.style.display = 'none';
        const container = reorderSection.parentElement;
        const target = reorderSection.parentElement.querySelector('.selector');
        const toHeight = target.getBoundingClientRect().height + calculateButtonHeights(target);
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
      });
    } else {
      reorder = true;
      document.querySelector('[data-reorder] .bi-arrows-move').style.display = "none";
      document.querySelector('[data-reorder] .bi-x').style.display = "block";
      const reorderSections = document.querySelectorAll(':has(> .reorder)');
      reorderSections.forEach(reorderSection => {
        const fromHeight = reorderSection.parentElement.querySelector('.selector')?.getBoundingClientRect().height;
        reorderSection.style.display = 'flex';
        reorderSection.parentElement.querySelector('.selector').style.display = 'none';
        document.querySelectorAll('#save-button').forEach(w => w.style.display = 'none');
        const container = reorderSection.parentElement;
        const target = reorderSection;
        const toHeight = target.getBoundingClientRect().height + calculateButtonHeights(target);
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
      });
    }
  }

  function sortSegmentsDue() {
    if (!active) return;
    document.getElementById('sort-segments-types').value = 'due';
    return ui.view("sort-segments");
  }

  function sortSegmentsIncreasing() {
    if (!active) return;
    document.getElementById('sort-segments-types').value = 'az';
    return ui.view("sort-segments");
  }

  function sortSegmentsDecreasing() {
    if (!active) return;
    document.getElementById('sort-segments-types').value = 'za';
    return ui.view("sort-segments");
  }

  function sortSegments() {
    if (!active) return;
    var updatedSegments = [...document.querySelector(".segment-reorder .reorder").children].map((segment, i) => {
      const segmentNumber = segment.querySelector('input').id.split('-')[1];
      return {
        order: i,
        number: segmentNumber,
        name: segment.querySelector('input').value,
        question_ids: segments.find(s => String(s.number) === String(segmentNumber)).question_ids,
        course: Number(document.getElementById("course-period-input").value),
        due: segments.find(s => String(s.number) === String(segmentNumber)).due
      };
    });
    switch (document.getElementById('sort-segments-types').value) {
      case 'az':
        updatedSegments.sort((a, b) => {
          const nameA = a.number;
          const nameB = b.number;
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        break;
      case 'za':
        updatedSegments.sort((a, b) => {
          const nameA = a.number;
          const nameB = b.number;
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        updatedSegments.reverse();
        break;
      default:
        updatedSegments.sort((a, b) => {
          const dueA = a.due ? new Date(a.due) : null;
          const dueB = b.due ? new Date(b.due) : null;
          if (!dueA && dueB) return 1;
          if (dueA && !dueB) return -1;
          if (!dueA && !dueB) return 0;
          if (dueA < dueB) return -1;
          if (dueA > dueB) return 1;
          return 0;
        });
        break;
    }
    for (let i = 0; i < updatedSegments.length; i++) {
      updatedSegments[i].order = i;
    }
    fetch(domain + '/segments', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedSegments)
    })
      .then(r => r.json())
      .then(c => {
        segments = c;
        updateSegments();
        ui.view();
        ui.toast("Successfully sorted segments.", 3000, "success", "bi bi-sort-down");
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
        pollingOff();
      });
  }

  function sortSegmentQuestionsIncreasing() {
    if (!active) return;
    sortSegmentQuestions(this, 'az');
  }

  function sortSegmentQuestionsDecreasing() {
    if (!active) return;
    sortSegmentQuestions(this, 'za');
  }

  function sortSegmentQuestions(event, type) {
    if (!active) return;
    var updatedQuestions = [...event.parentElement.parentElement.querySelector('.inputs').children].filter(q => q.classList.value === 'input-group');
    switch (type) {
      case 'az':
        updatedQuestions.sort((a, b) => {
          const nameA = a.querySelector('#segment-question-name-input').value;
          const nameB = b.querySelector('#segment-question-name-input').value;
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        break;
      case 'za':
        updatedQuestions.sort((a, b) => {
          const nameA = a.querySelector('#segment-question-name-input').value;
          const nameB = b.querySelector('#segment-question-name-input').value;
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        updatedQuestions.reverse();
        break;
      default:
        break;
    }
    var updatedQuestionsString = '<div class="input-group small"><label>Name</label><label>ID</label></div>';
    for (let i = 0; i < updatedQuestions.length; i++) {
      updatedQuestionsString += `<div class="input-group"><div class="drag"><i class="bi bi-grip-vertical"></i></div><input type="text" autocomplete="off" id="segment-question-name-input" value="${updatedQuestions[i].querySelector('#segment-question-name-input').value}" /><input type="number" autocomplete="off" id="segment-question-id-input" value="${updatedQuestions[i].querySelector('#segment-question-id-input').value}" /></div>`;
    }
    updatedQuestionsString += '<div class="input-group fit"><button square="" data-add-segment-question-input=""><i class="bi bi-plus"></i></button><button square="" data-remove-segment-question-input=""><i class="bi bi-dash"></i></button></div>';
    event.parentElement.parentElement.querySelector('.inputs').innerHTML = updatedQuestionsString;
    document.querySelectorAll('[data-add-segment-question-input]').forEach(a => a.addEventListener('click', addSegmentQuestion));
    document.querySelectorAll('[data-remove-segment-question-input]').forEach(a => a.addEventListener('click', removeSegmentQuestion));
    document.querySelectorAll('.drag').forEach(item => {
      item.setAttribute('draggable', true);
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('drop', handleDropSegment);
    });
  }

  function toggleDetailedReport() {
    if (!this.getAttribute('report') || !document.getElementById(this.getAttribute('report'))) return;
    document.getElementById(this.getAttribute('report')).classList.toggle('active');
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ admin.js: ${error.message}`);
  };
  throw error;
};