import * as ui from "/src/modules/ui.js";

import { convertLatexToAsciiMath, convertLatexToMarkup, renderMathInElement } from "mathlive";
``;

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : 'http://localhost:5000';
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var courses = [];    
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
  });
  document.querySelector('.course-reorder').style.display = 'none';
}

document.getElementById("period-input").addEventListener("change", (e) => {
  const course = courses.find(c => c.id == e.target.value);
  document.getElementById("course-input").value = course.name;
});

document.getElementById("reorder-courses-button").addEventListener("click", () => {
  const current = document.querySelector('.course-selector');
  const fromHeight = current?.getBoundingClientRect().height;
  document.querySelector('.course-reorder').style.display = 'flex';
  document.querySelector('.course-selector').style.display = 'none';
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
  console.log(updatedCourses)
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
document.getElementById("save-button").addEventListener("click", () => {
  fetch(domain + '/save', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    }
  });
  // Show submit confirmation
  ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved!");
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