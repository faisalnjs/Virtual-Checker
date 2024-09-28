import * as ui from "/src/modules/ui.js";

import { convertLatexToAsciiMath, convertLatexToMarkup, renderMathInElement } from "mathlive";
``;

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : 'http://localhost:5000';
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var courses = [];
var segments = [];
var questions = [];
let draggedItem = null;

async function init() {
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
            .then(q => {
              questions = q;
              if (document.querySelector('.questions.section')) updateQuestions();
            });
        });
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
      buttonGrid.innerHTML = `<div class="input-group small"><label for="segment-number-input">Number</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="${s.number}" /></div></div><div class="input-group"><label for="segment-name-input">Name</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="${s.name}" /></div></div><button square data-remove-segment-input><i class="bi bi-dash"></i></button>`;
      segment.appendChild(buttonGrid);
      var questionsString = "";
      var questions = document.createElement('div');
      questions.classList = "questions";
      JSON.parse(s.question_ids).forEach(q => {
        questionsString += `<div class="input-group"><input type="text" autocomplete="off" id="segment-question-name-input" value="${q.name}" /><input type="text" autocomplete="off" id="segment-question-id-input" value="${q.id}" /></div>`;
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
      });
    // Show submit confirmation
    ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved!");
  });
}

// Save
document.getElementById("save-button").addEventListener("click", (e) => {
  var updatedInfo = {
    course: {
      id: document.getElementById("course-period-input").value,
      name: document.getElementById("course-input").value,
    },
    segments: []
  };
  Array.from(document.querySelectorAll('.segments .section .section'))
    .filter(s => s.classList.length === 1)
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
  console.log(updatedInfo);
  fetch(domain + '/save', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedInfo)
  });
  e.target.disabled = true;
  // Show submit confirmation
  window.scroll(0, 0);
  ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved!");
  setTimeout(() => {
    e.target.disabled = false;
  }, 3000);
});

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
  buttonGrid.innerHTML = `<div class="input-group small"><label for="segment-number-input">Number</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="0" /></div></div><div class="input-group"><label for="segment-name-input">Name</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="" /></div></div><button square data-remove-segment-input><i class="bi bi-dash"></i></button>`;
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
}

function removeSegment() {
  this.parentElement.parentElement.remove();
}

function addSegmentQuestion() {
  var group = document.createElement('div');
  group.className = "input-group";
  group.innerHTML = `<input type="text" autocomplete="off" id="segment-question-name-input" value="" /><input type="text" autocomplete="off" id="segment-question-id-input" value="" />`;
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

if (document.querySelector('.questions.section')) {

}

function updateQuestions() {
  console.log(questions);
  if (questions.length > 0) {
    document.querySelector('.questions .section').innerHTML = '';
    questions.forEach(q => {
      var question = document.createElement('div');
      question.className = "section";
      question.id = `question-${q.id}`;
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      var segmentsString = "";
      segments.forEach(s => segmentsString += `<option value="${s.number}"${(segments.filter(e => JSON.parse(e.question_ids).find(qId => qId.id == q.id)).number === s.number) ? ' selected': ''}>${s.number}</option>`);
      buttonGrid.innerHTML = `<div class="input-group small"><label for="question-id-input">ID</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="${q.id}" disabled /></div></div><div class="input-group small"><label for="question-number-input">Number</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="${q.number}" /></div></div><div class="input-group small"><label for="question-segment-input">Segment</label><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><label for="question-text-input">Question</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="${q.question}" /></div></div><button square data-remove-question-input><i class="bi bi-dash"></i></button>`;
      question.appendChild(buttonGrid);
      var images = document.createElement('div');
      images.classList = "attachments";
      JSON.parse(q.images).forEach(q => {
        var image = document.createElement('div');
        image.classList = "image";
        image.innerHTML = `<img src="${q}" />`;
        images.appendChild(image);
      });
      var drop = document.createElement('div');
      drop.classList = "drop";
      drop.innerHTML = "+";
      images.appendChild(drop);
      question.appendChild(images);
      document.querySelector('.questions .section').appendChild(question);
    });
    document.querySelector('.questions .section').innerHTML += '<button data-add-question-input>Add Question</button>';
  } else {
    document.querySelector('.questions .section').innerHTML = '<button data-add-question-input>Add Question</button>';
  }
  document.querySelectorAll('[data-add-question-input]').forEach(a => a.addEventListener('click', addQuestion));
  document.querySelectorAll('[data-remove-question-input]').forEach(a => a.addEventListener('click', removeQuestion));
}

function addQuestion() {
  var group = document.createElement('div');
  group.className = "section";
  group.id = 'question-new';
  var buttonGrid = document.createElement('div');
  buttonGrid.className = "button-grid inputs";
  var segmentsString = "";
  segments.forEach(s => segmentsString += `<option value="${s.number}">${s.number}</option>`);
  buttonGrid.innerHTML = `<div class="input-group small"><label for="question-id-input">ID</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="" disabled /></div></div><div class="input-group small"><label for="question-number-input">Number</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="" /></div></div><div class="input-group small"><label for="question-segment-input">Segment</label><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><label for="question-text-input">Question</label><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="" /></div></div><button square data-remove-question-input><i class="bi bi-dash"></i></button>`;
  group.appendChild(buttonGrid);
  var images = document.createElement('div');
  images.classList = "attachments";
  var drop = document.createElement('div');
  drop.classList = "drop";
  drop.innerHTML = "+";
  images.appendChild(drop);
  group.appendChild(images);
  this.parentElement.insertBefore(group, this.parentElement.children[this.parentElement.children.length - 1]);
  document.querySelectorAll('[data-add-question-input]').forEach(a => a.addEventListener('click', addQuestion));
  document.querySelectorAll('[data-remove-question-input]').forEach(a => a.addEventListener('click', removeQuestion));
}

function removeQuestion() {
  this.parentElement.parentElement.remove();
}