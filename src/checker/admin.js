import * as ui from "/src/modules/ui.js";

import { convertLatexToAsciiMath, convertLatexToMarkup, renderMathInElement } from "mathlive";
``;

const domain = (window.location.hostname.search('check') != -1) ? 'https://api.check.vssfalcons.com' : 'http://localhost:5000';

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
    c.forEach(course => {
      const option = document.createElement("option");
      option.value = course.id;
      option.innerHTML = course.period;
      document.getElementById("period-input").appendChild(option);
      const elem = document.createElement("div");
      elem.classList = "button-grid inputs";
      elem.innerHTML = `<input type="text" autocomplete="off" id="course-${course.id}" value="${course.name || ''}" /><div class="drag"><i class="bi bi-grip-horizontal"></i></div>`;
      document.querySelector(".reorder").appendChild(elem);
    });
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
  draggedItem = this.parentNode; // Assuming the .drag element is a direct child of the item container
  e.dataTransfer.effectAllowed = 'move';
  console.log(12)
}

function handleDragOver(e) {
  e.preventDefault(); // Necessary to allow dropping
  e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
  e.stopPropagation(); // Stops some browsers from redirecting.
  const targetItem = this.parentNode; // Assuming the .drag element is a direct child of the item container
  if (draggedItem !== targetItem) {
    // Swap the positions of the draggedItem and targetItem in the DOM
    let parent = draggedItem.parentNode;
    parent.insertBefore(draggedItem, targetItem);
  }
  return false;
}