import * as ui from "/src/modules/ui.js";

import { convertLatexToAsciiMath, convertLatexToMarkup, renderMathInElement } from "mathlive";
``;

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : 'http://localhost:5000';
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var courses = [];
var segments = [];
let draggedItem = null;

// Initialization
{
  // Show clear data fix guide
  // if (storage.get("created")) {
  //   document.querySelector(`[data-modal-view="clear-data-fix"]`).remove();
  // } else {
  //   storage.set("created", Date.now());
  // }
  fetch(domain + '/courses', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    }
  })
  .then(c => c.json())
  .then(c => {
    courses = c;
    c.sort((a, b) => a.period - b.period).forEach(course => {
      const option = document.createElement("option");
      option.value = course.id;
      option.innerHTML = course.period;
      document.getElementById("period-input").appendChild(option);
      const elem = document.createElement("div");
      elem.classList = "button-grid inputs";
      elem.style = "flex-wrap: nowrap;";
      elem.innerHTML = `<input type="text" autocomplete="off" id="course-${course.id}" value="${course.name || ''}" /><div class="drag"><i class="bi bi-grip-vertical"></i></div>`;
      document.querySelector(".reorder").appendChild(elem);
    });
    const course = courses.find(c => c.id == document.getElementById("period-input").value);
    document.getElementById("course-input").value = course.name;
    document.querySelectorAll('.drag').forEach(item => {
      item.setAttribute('draggable', true);
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('drop', handleDrop);
    });
    fetch(domain + '/segments', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    })
    .then(c => c.json())
    .then(c => {
      segments = c;
      updateSegments();
    });
  });
  document.querySelector('.course-reorder').style.display = 'none';
  document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
}

document.getElementById("period-input").addEventListener("change", updateSegments);

function updateSegments() {
  const course = courses.find(c => c.id == document.getElementById("period-input").value);
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
      questions.innerHTML = `<div class="button-grid inputs"><div class="input-group small"><label>Name</label><label>ID</label></div>${questionsString}<div class="input-group fit"><button square data-add-segment-question-input><i class="bi bi-plus"></i></button><button square data-remove-segment-question-input><i class="bi bi-dash"></i></button></div></div>`;
      segment.appendChild(questions);
      document.querySelector('.segments .section').appendChild(segment);
    });
    document.querySelector('.segments .section').innerHTML += '<button data-add-segment-input>Add Segment</button>';
  } else {
    document.querySelector('.segments .section').innerHTML = '<button data-add-segment-input>Add Segment</button>';
  }
  document.querySelectorAll('[data-add-segment-input]').forEach(a => a.addEventListener('click', addSegment));
}

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
      document.getElementById("period-input").innerHTML = "";
      c.sort((a, b) => a.period - b.period).forEach(course => {
        const option = document.createElement("option");
        option.value = course.id;
        option.innerHTML = course.period;
        document.getElementById("period-input").appendChild(option);
        const elem = document.createElement("div");
        elem.classList = "button-grid inputs";
        elem.style = "flex-wrap: nowrap;";
        elem.innerHTML = `<input type="text" autocomplete="off" id="course-${course.id}" value="${course.name || ''}" /><div class="drag"><i class="bi bi-grip-vertical"></i></div>`;
        document.querySelector(".reorder").appendChild(elem);
      });
      const course = courses.find(c => c.id == document.getElementById("period-input").value);
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

// Save
document.getElementById("save-button").addEventListener("click", (e) => {
  var updatedInfo = {
    course: {
      id: document.getElementById("period-input").value,
      name: document.getElementById("course-input").value,
    }
  };
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
  ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved!");
  setTimeout(() => {
    e.target.disabled = false;
  }, 3000);
});

// Remove attention ring when user types in either input
// segmentInput.addEventListener("input", (e) => {
//   e.target.classList.remove("attention");
// });
// questionInput.addEventListener("input", (e) => {
//   e.target.classList.remove("attention");
// });
// answerInput.addEventListener("input", (e) => {
//   e.target.classList.remove("attention");
// });
// mf.addEventListener("input", (e) => {
//   e.target.classList.remove("attention");
// });
    
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
  questions.innerHTML = `<div class="button-grid inputs"><div class="input-group small"><label>Name</label><label>ID</label></div><div class="input-group"><input type="text" autocomplete="off" id="segment-question-name-input" value="" /><input type="text" autocomplete="off" id="segment-question-id-input" value="" /></div><div class="input-group fit"><button square data-add-segment-question-input><i class="bi bi-plus"></i></button><button square data-remove-segment-question-input><i class="bi bi-dash"></i></button></div></div>`;
  group.appendChild(questions);
  this.parentElement.insertBefore(group, this.parentElement.children[this.parentElement.children.length - 1]);
  document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.removeEventListener('click', removeSegment));
  document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
}

function removeSegment() {
  this.parentElement.parentElement.remove();
}