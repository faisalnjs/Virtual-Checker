import * as ui from "/src/modules/ui.js";

import { convertLatexToAsciiMath, convertLatexToMarkup, renderMathInElement } from "mathlive";
``;

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : 'http://localhost:5000';
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var courses = [];
var segments = [];
var questions = [];
var answers = [];
var responses = [];
let draggedItem = null;
var formData = new FormData();

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
          option.innerHTML = course.period;
          document.getElementById("course-period-input").appendChild(option);
          const elem = document.createElement("div");
          elem.classList = "button-grid inputs";
          elem.style = "flex-wrap: nowrap;";
          elem.innerHTML = `<input type="text" autocomplete="off" id="course-${course.id}" value="${course.name || ''}" /><div class="drag"><i class="bi bi-grip-vertical"></i></div>`;
          document.querySelector(".reorder").appendChild(elem);
        });
        const course = courses.find(c => c.id == document.getElementById("course-period-input").value);
        document.getElementById("course-input").value = course.name;
        document.querySelectorAll('.drag').forEach(item => {
          item.setAttribute('draggable', true);
          item.addEventListener('dragstart', handleDragStart);
          item.addEventListener('dragover', handleDragOver);
          item.addEventListener('drop', handleDrop);
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
                    .then(r => {
                      responses = r;
                      if (document.querySelector('.responses.section')) {
                        document.getElementById("sort-course-input").value = courses.find(c => c.id == String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0].seatCode)[0]).id;
                        updateResponses();
                      }
                    })
                    .catch((e) => {
                      console.error(e);
                      ui.view("api-fail");
                    });
                })
                .catch((e) => {
                  console.error(e);
                  ui.view("api-fail");
                });
            })
            .catch((e) => {
              console.error(e);
              ui.view("api-fail");
            });
        })
        .catch((e) => {
          console.error(e);
          ui.view("api-fail");
        });
    })
    .catch((e) => {
      console.error(e);
      ui.view("api-fail");
    });
  if (document.getElementById("course-period-input")) {
    document.querySelector('.course-reorder').style.display = 'none';
    document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.removeEventListener('click', removeSegment));
    document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
    document.getElementById("course-period-input").value = courses.find(c => c.id == segments.sort((a, b) => a.course - b.course)[0].course).id;
    updateSegments();
  }
}

init();

if (document.getElementById("course-period-input")) document.getElementById("course-period-input").addEventListener("change", updateSegments);
document.querySelector('[data-select-multiple]').addEventListener("click", toggleSelecting);
document.querySelector('[data-delete-multiple]').addEventListener("click", deleteMultiple);

function toggleSelecting() {
  if (document.querySelector('.segments .section')) document.querySelector('.segments .section').classList.toggle('selecting');
  if (document.querySelector('.questions .section')) document.querySelector('.questions .section').classList.toggle('selecting');
}

function removeSelecting() {
  if (document.querySelector('.segments .section')) document.querySelector('.segments .section').classList.remove('selecting');
  if (document.querySelector('.questions .section')) document.querySelector('.questions .section').classList.remove('selecting');
}

function deleteMultiple() {
  document.querySelectorAll('.selected').forEach(e => e.remove());
}

function toggleSelected() {
  this.parentElement.parentElement.classList.toggle('selected');
}

function removeAllSelected() {
  document.querySelectorAll('.selected').forEach(e => e.classList.remove('.selected'));
}

function updateSegments() {
  const course = courses.find(c => c.id == document.getElementById("course-period-input").value);
  document.getElementById("course-input").value = course.name;
  var c = segments.filter(s => s.course == course.id);
  if (c.length > 0) {
    document.querySelector('.segments .section').innerHTML = '';
    c.forEach(s => {
      var segment = document.createElement('div');
      segment.className = "section";
      segment.id = `segment-${s.number}`;
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="${s.number}" placeholder="${s.number}" /></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="${s.name}" placeholder="${s.name}" /></div></div><button square data-remove-segment-input><i class="bi bi-dash"></i></button><button square data-toggle-segment><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
      segment.appendChild(buttonGrid);
      var questionsString = "";
      var questions = document.createElement('div');
      questions.classList = "questions";
      JSON.parse(s.question_ids).forEach(q => {
        questionsString += `<div class="input-group"><input type="text" autocomplete="off" id="segment-question-name-input" value="${q.name}" placeholder="${q.name}" /><input type="number" autocomplete="off" id="segment-question-id-input" value="${q.id}" placeholder="${q.id}" /></div>`;
      });
      questions.innerHTML = `<div class="button-grid inputs"><div class="input-group small"><label>Name</label><label>ID</label></div>${questionsString}<div class="input-group fit"><button square data-add-segment-question-input><i class="bi bi-plus"></i></button><button square data-remove-segment-question-input${(JSON.parse(s.question_ids).length === 1) ? ' disabled' : ''}><i class="bi bi-dash"></i></button></div></div>`;
      segment.appendChild(questions);
      document.querySelector('.segments .section').appendChild(segment);
    });
    document.querySelector('.segments .section').innerHTML += '<button data-add-segment-input>Add Segment</button>';
  } else {
    document.querySelector('.segments .section').innerHTML = '<button data-add-segment-input>Add Segment</button>';
  }
  document.querySelectorAll('[data-add-segment-input]').forEach(a => a.addEventListener('click', addSegment));
  document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
  document.querySelectorAll('[data-add-segment-question-input]').forEach(a => a.addEventListener('click', addSegmentQuestion));
  document.querySelectorAll('[data-remove-segment-question-input]').forEach(a => a.addEventListener('click', removeSegmentQuestion));
  document.querySelectorAll('[data-toggle-segment]').forEach(a => a.addEventListener('click', toggleSegment));
  document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
}

function toggleSegment() {
  this.parentElement.parentElement.classList.toggle('expanded');
}

function calculateButtonHeights(container) {
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

if (document.getElementById("reorder-courses-button")) {
  document.getElementById("reorder-courses-button").addEventListener("click", () => {
    const current = document.querySelector('.course-selector');
    const fromHeight = current?.getBoundingClientRect().height;
    document.querySelector('.course-reorder').style.display = 'flex';
    document.querySelector('.course-selector').style.display = 'none';
    document.getElementById('save-button').style.display = 'none';
    const container = document.querySelector('.section');
    const target = document.querySelector('.course-reorder');
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

  document.getElementById("cancel-reorder-courses-button").addEventListener("click", () => {
    const current = document.querySelector('.course-reorder');
    const fromHeight = current?.getBoundingClientRect().height;
    document.querySelector('.course-selector').style.display = 'flex';
    document.getElementById('save-button').style.display = '';
    document.querySelector('.course-reorder').style.display = 'none';
    const container = document.querySelector('.section');
    const target = document.querySelector('.course-selector');
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

  document.getElementById("save-course-order-button").addEventListener("click", () => {
    const current = document.querySelector('.course-reorder');
    const fromHeight = current?.getBoundingClientRect().height;
    document.querySelector('.course-selector').style.display = 'flex';
    document.getElementById('save-button').style.display = '';
    document.querySelector('.course-reorder').style.display = 'none';
    const container = document.querySelector('.section');
    const target = document.querySelector('.course-selector');
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

  // Save Course Order
  document.getElementById("save-course-order-button").addEventListener("click", () => {
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
        document.querySelector(".reorder").innerHTML = "";
        document.getElementById("course-period-input").innerHTML = "";
        c.sort((a, b) => a.period - b.period).forEach(course => {
          const option = document.createElement("option");
          option.value = course.id;
          option.innerHTML = course.period;
          document.getElementById("course-period-input").appendChild(option);
          const elem = document.createElement("div");
          elem.classList = "button-grid inputs";
          elem.style = "flex-wrap: nowrap;";
          elem.innerHTML = `<input type="text" autocomplete="off" id="course-${course.id}" value="${course.name || ''}" placeholder="${course.name || ''}" /><div class="drag"><i class="bi bi-grip-vertical"></i></div>`;
          document.querySelector(".reorder").appendChild(elem);
        });
        const course = courses.find(c => c.id == document.getElementById("course-period-input").value);
        document.getElementById("course-input").value = course.name;
        document.querySelectorAll('.drag').forEach(item => {
          item.setAttribute('draggable', true);
          item.addEventListener('dragstart', handleDragStart);
          item.addEventListener('dragover', handleDragOver);
          item.addEventListener('drop', handleDrop);
        });
      })
      .catch((e) => {
        console.error(e);
        ui.view("api-fail");
      });
    // Show submit confirmation
    ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
  });
}

// Save
document.getElementById("save-button").addEventListener("click", save);
  
async function save(hideResult) {
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
    Array.from(document.querySelectorAll('.segments .section .section'))
      .filter(w => w.id)
      .forEach(segment => {
        updatedInfo.segments.push({
          id: segment.id.split('-')[1],
          number: segment.querySelector('#segment-number-input').value,
          name: segment.querySelector('#segment-name-input').value,
          question_ids: JSON.stringify(Array.from(segment.querySelectorAll('#segment-question-name-input')).filter(q => (q.value.length > 0) && (q.value != ' ') && (q.nextElementSibling.value.length > 0) && (q.nextElementSibling.value != ' ')).map(q => {
            return {
              name: q.value,
              id: q.nextElementSibling.value
            };
          }))
        });
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
          })
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
  });
  document.getElementById("save-button").disabled = true;
  window.scroll(0, 0);
  if ((typeof hideResult != 'boolean')) ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
  init();
  setTimeout(() => {
    document.getElementById("save-button").disabled = false;
  }, 2500);
}

function handleDragStart(e) {
  draggedItem = this.parentNode;
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
  e.stopPropagation();
  const targetItem = this.parentNode;
  if (draggedItem !== targetItem) {
    let parent = draggedItem.parentNode;
    parent.insertBefore(draggedItem, targetItem);
  }
  const newOrder = [...document.querySelectorAll('.dragCourse')].sort((a, b) => {
    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  });
  const parent = document.querySelector('.reorder');
  newOrder.forEach(item => parent.appendChild(item));
  return false;
}

function addSegment() {
  var group = document.createElement('div');
  group.className = "section";
  group.id = 'segment-new';
  var buttonGrid = document.createElement('div');
  buttonGrid.className = "button-grid inputs";
  buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="0" /></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="" /></div></div><button square data-remove-segment-input><i class="bi bi-dash"></i></button><button square data-toggle-segment><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
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
  this.parentElement.parentElement.remove();
}

function addSegmentQuestion() {
  var group = document.createElement('div');
  group.className = "input-group";
  group.innerHTML = `<input type="text" autocomplete="off" id="segment-question-name-input" value="" /><input type="number" autocomplete="off" id="segment-question-id-input" value="" />`;
  this.parentElement.parentElement.insertBefore(group, this.parentElement);
  this.parentElement.querySelector('[data-remove-segment-question-input]').disabled = false;
  this.parentElement.querySelector('[data-remove-segment-question-input]').addEventListener('click', removeSegmentQuestion);
}

function removeSegmentQuestion() {
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
      buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="${q.id}" disabled /></div></div><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="${q.number}" placeholder="${q.number}" /></div></div><div class="input-group small"><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="${q.question}" placeholder="${q.question}" /></div></div><button square data-remove-question-input><i class="bi bi-dash"></i></button><button square data-toggle-question><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
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
}

function addCorrectAnswer() {
  var input = document.createElement('div');
  input.className = "button-grid inputs";
  input.innerHTML = `<input type="text" autocomplete="off" id="question-correct-answer-input" value="" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button>`;
  this.parentElement.insertBefore(input, this);
  document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
  document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
}

function addIncorrectAnswer() {
  var input = document.createElement('div');
  input.className = "button-grid inputs";
  input.innerHTML = `<input type="text" autocomplete="off" id="question-incorrect-answer-input" value="" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button>`;
  this.parentElement.insertBefore(input, this);
  document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
  document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
}

function removeCorrectAnswer() {
  this.parentElement.remove();
}

function removeIncorrectAnswer() {
  this.parentElement.remove();
}

function toggleQuestion() {
  if (this.parentElement.parentElement.classList.contains('expanded')) {
    hideAllQuestions();
  } else {
    hideAllQuestions();
    this.parentElement.parentElement.classList.add('expanded');
    document.querySelector('[data-add-question-input]').style.display = "none";
    document.querySelector('#save-button').style.display = "none";
  }
}

function hideAllQuestions() {
  document.querySelectorAll('.expanded').forEach(q => q.classList.remove('expanded'));
  document.querySelector('[data-add-question-input]').style.display = "block";
  document.querySelector('#save-button').style.display = "block";
}

function addQuestion() {
  var group = document.createElement('div');
  group.className = "section";
  group.id = 'question-new';
  var buttonGrid = document.createElement('div');
  buttonGrid.className = "button-grid inputs";
  var segmentsString = "";
  segments.forEach(s => segmentsString += `<option value="${s.number}">${s.number}</option>`);
  buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="" disabled /></div></div><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="" /></div></div><div class="input-group small"><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="" /></div></div><button square data-remove-question-input><i class="bi bi-dash"></i></button><button square data-toggle-question><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
  group.appendChild(buttonGrid);
  this.parentElement.insertBefore(group, this.parentElement.children[this.parentElement.children.length - 1]);
  document.querySelectorAll('[data-add-question-input]').forEach(a => a.addEventListener('click', addQuestion));
  document.querySelectorAll('[data-remove-question-input]').forEach(a => a.addEventListener('click', removeQuestion));
  document.querySelectorAll('[data-toggle-question]').forEach(a => a.addEventListener('click', toggleQuestion));
  document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
}

function removeQuestion() {
  this.parentElement.parentElement.remove();
  hideAllQuestions();
}

async function renderPond() {
  await save(true);
  const url = '/admin/upload.html?question=' + this.id;
  const width = 600;
  const height = 600;
  const left = (window.screen.width / 2) - (width / 2);
  const top = (window.screen.height / 2) - (height / 2);
  const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
  const newWindow = window.open(url, '_blank', windowFeatures);
  const checkWindowClosed = setInterval(function() {
    if (newWindow && newWindow.closed) {
      clearInterval(checkWindowClosed);
      ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
      init();
    }
  }, 1000);
}

async function removeImage(event) {
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
      });
  } else {
    window.open(event.target.src);
  }
}

function updateResponses() {
  document.querySelector('.responses .section').innerHTML = '';
  responses
  .filter(r => String(r.seatCode)[0] == document.getElementById("sort-course-input").value)
  .filter(r => String(r.segment).startsWith(document.getElementById("sort-segment-input").value))
  .filter(r => String(r.question_id).startsWith(document.getElementById("sort-question-input").value))
  .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input").value))
  .forEach(r => {
    var buttonGrid = document.createElement('div');
    buttonGrid.className = "button-grid inputs";
    buttonGrid.id = `response-${r.id}`;
    buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.id}" disabled /><input type="text" autocomplete="off" class="small" id="response-segment-input" value="${r.segment}" disabled /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${r.question_id}" disabled /><input type="text" autocomplete="off" class="small" id="response-seat-code-input" value="${r.seatCode}" disabled /><input type="text" autocomplete="off" id="response-response-input" value="${r.response}" disabled /><select name="response-status-input" class="medium" id="response-status-input"><option value="Unknown, Recorded" ${(r.status === 'Unknown, Recorded') ? 'selected' : ''}>Unknown</option><option value="Incorrect" ${(r.status === 'Incorrect') ? 'selected' : ''}>Incorrect</option><option value="Correct" ${(r.status === 'Correct') ? 'selected' : ''}>Correct</option><option value="Invalid Format" ${(r.status === 'Invalid') ? 'selected' : ''}>Invalid</option></select>`;
    document.querySelector('.responses .section').appendChild(buttonGrid);
  });
  document.querySelectorAll('[data-add-response-input]').forEach(a => a.addEventListener('click', addQuestion));
  document.querySelectorAll('[data-remove-response-input]').forEach(a => a.addEventListener('click', removeQuestion));
}