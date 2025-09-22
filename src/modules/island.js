/* eslint-disable no-redeclare */
import { convertLatexToMarkup, renderMathInElement } from "mathlive";
import mediumZoom from "medium-zoom";
import Quill from "quill";
import "faz-quill-emoji/autoregister";

var lastIslandSourceId = null;
var islandSource = null;
var islandSource2 = null;
var islandSource3 = null;
var islandElement = null;
var hideIslandTimeout = null;

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export default function spawnIsland(element = null, source = null, dataType = 'question', data = {}, source2 = null, source3 = null) {
    if (element) {
        islandElement = element;
        document.querySelectorAll('.island-extends').forEach(a => a.classList.remove('island-extends'));
        element.classList.add('island-extends');
        clearTimeout(hideIslandTimeout);
    } else {
        hideIslandTimeout = setTimeout(() => {
            if (document.querySelector('.island:hover')) return;
            if (Array.from(document.querySelectorAll('dialog')).find(dialog => dialog.querySelector('h2')?.innerText === 'Add Reason')) return;
            document.querySelectorAll('.island-extends').forEach(a => a.classList.remove('island-extends'));
            var island = document.querySelector('.island');
            if (island) island.classList.remove('visible');
        }, 2500);
        return;
    }
    var island = document.querySelector('.island');
    if (!island) {
        island = document.createElement('div');
        island.classList.add('island');
        document.body.appendChild(island);
    }
    if (Object.keys(data).length === 0) return island.classList.remove('visible');
    if (window.innerWidth < 1400) return island.classList.remove('visible');
    if (document.querySelector('.questions .section.expanded')) return island.classList.remove('visible');
    if (data.id) {
        if (lastIslandSourceId && (data.sourceId === lastIslandSourceId)) return island.classList.add('visible');
        lastIslandSourceId = data.id;
    }
    island.innerHTML = '';
    if (source) islandSource = source;
    if (source2) islandSource2 = source2;
    if (source3) islandSource3 = source3;
    island.classList.remove('rendered');
    island.setAttribute('datatype', dataType);
    island.setAttribute('sourceid', String(data.sourceId || ''));
    if (data.id) {
        var id = document.createElement('code');
        id.innerHTML = data.id;
        island.appendChild(id);
    }
    if (data.title) {
        var title = document.createElement('h4');
        title.innerHTML = data.title;
        island.appendChild(title);
    }
    if (data.subtitle) {
        var subtitle = document.createElement('h6');
        if (data.subtitleLatex) {
            subtitle.innerHTML = convertLatexToMarkup(data.subtitle);
            island.appendChild(subtitle);
            renderMathInElement(subtitle);
        } else {
            subtitle.innerHTML = data.subtitle;
            island.appendChild(subtitle);
        }
    }
    if (data.description && data.description.includes('ops') && (data.description != '{"ops":[{"insert":"\\n"}]}') && JSON.parse(data.description.replaceAll(/\s/g, ''))) {
        var description = document.createElement('div');
        description.classList = 'description extra hidden';
        var textarea = document.createElement('div');
        textarea.classList.add('textarea');
        textarea.setAttribute('content', data.description);
        description.appendChild(textarea);
        island.appendChild(description);
    }
    if (data.attachments && JSON.parse(data.attachments)) {
        var attachments = document.createElement('div');
        attachments.classList = 'attachments extra hidden';
        JSON.parse(data.attachments).forEach(attachment => {
            var image = document.createElement('img');
            image.setAttribute('data-src', attachment);
            attachments.appendChild(image);
        });
        island.appendChild(attachments);
    }
    if (data.lists) {
        data.lists.forEach(list => {
            var listContainer = document.createElement('div');
            if (list.title) {
                var title = document.createElement('h5');
                title.innerHTML = list.title;
                listContainer.appendChild(title);
            }
            if (list.items) {
                var listUl = document.createElement('ul');
                list.items.forEach(item => {
                    var itemElement = document.createElement('li');
                    if (typeof item === 'object') {
                        Object.keys(item).forEach(itemKey => {
                            itemElement.innerHTML += `${itemKey[0].toUpperCase()}${itemKey.slice(1)}: ${escapeHTML(item[itemKey])}, `;
                            if (data.activeItem && (data.activeItem === item[itemKey])) itemElement.classList.add('island-extends-item');
                        });
                        itemElement.innerHTML = itemElement.innerHTML.slice(0, itemElement.innerHTML.length - 2);
                    } else {
                        itemElement.innerHTML = escapeHTML(item);
                        if (data.activeItem && (data.activeItem === item)) itemElement.classList.add('island-extends-item');
                    }
                    listUl.appendChild(itemElement);
                });
                listContainer.appendChild(listUl);
            }
            island.appendChild(listContainer);
        });
    }
    island.classList.add('visible');
}

export function moveFromCurrent(moveBy) {
    var island = document.querySelector('.island');
    var sourceId = island.getAttribute('sourceid');
    var dataType = island.getAttribute('datatype');
    if (!sourceId || !dataType || !islandSource) return;
    if (!islandSource[0]) return;
    var keys = Object.keys(islandSource[0]);
    if (dataType === 'response') {
        var currentIndex = Number(sourceId);
    } else {
        var key = keys.includes('id') ? 'id' : keys.includes('number') ? 'number' : keys.includes('name') ? 'name' : keys.includes('period') ? 'period' : null;
        if (!key) return;
        var currentIndex = islandSource.findIndex(item => String(item[key]) === String(sourceId));
    }
    if (currentIndex === -1) return;
    var newIndex = currentIndex + moveBy;
    if (newIndex < 0 || newIndex >= islandSource.length) return;
    var newItem = islandSource[newIndex];
    var newData = {};
    switch (dataType) {
        case 'segment':
            newData = {
                sourceId: String(newItem.id),
                id: `# ${newItem.number}`,
                title: `${newItem.name}`,
                subtitle: newItem.due ? `Due ${new Date(`${newItem.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}` : '',
                lists: [
                    {
                        title: 'Questions',
                        items: JSON.parse(newItem.question_ids)
                    },
                ],
            };
            break;
        case 'roster':
            var total = [...new Set(JSON.parse(newItem.data).flatMap(a => Number(a.seatCode)))];
            var registered = [...new Set(islandSource2.flatMap(a => a.code).filter(x => total.includes(x)))];
            newData = {
                sourceId: String(newItem.period),
                title: `Period ${newItem.period}`,
                subtitle: `${registered.length}/${total.length} Registered Students`,
                lists: [
                    {
                        title: 'Unregistered Students',
                        items: total.filter(a => !registered.includes(a)).map(a => { var student = JSON.parse(newItem.data).find(b => String(b.seatCode) === String(a)); return `${student.last}, ${student.first} (${a})`; })
                    },
                    {
                        title: 'Registered Students',
                        items: total.filter(a => registered.includes(a)).map(a => { var student = JSON.parse(newItem.data).find(b => String(b.seatCode) === String(a)); return `${student.last}, ${student.first} (${a})`; })
                    },
                ],
            };
            break;
        case 'response':
            var newQuestion = islandSource2.find(q => String(q.id) === String(newItem.querySelector('#response-question-id-input')?.value));
            newData = {
                sourceId: String(newIndex),
                id: `ID ${newQuestion.id}`,
                title: `Question ${newQuestion.number}`,
                subtitle: `${newQuestion.question}`,
                subtitleLatex: newQuestion.latex,
                description: newQuestion.description,
                attachments: newQuestion.images,
                lists: [
                    {
                        title: 'Correct Answers',
                        items: islandSource3.find(a => a.id === newQuestion.id).correct_answers
                    },
                    {
                        title: 'Incorrect Answers',
                        items: islandSource3.find(a => a.id === newQuestion.id).incorrect_answers
                    },
                ],
            };
            break;
        default:
            newData = {
                sourceId: String(newItem.id),
                id: `ID ${newItem.id}`,
                title: `Question ${newItem.number}`,
                subtitle: `${newItem.question}`,
                subtitleLatex: newItem.latex,
                description: newItem.description,
                attachments: newItem.images,
                lists: [
                    {
                        title: 'Correct Answers',
                        items: islandSource2.find(a => a.id === newItem.id).correct_answers
                    },
                    {
                        title: 'Incorrect Answers',
                        items: islandSource2.find(a => a.id === newItem.id).incorrect_answers
                    },
                ],
            };
            break;
    }
    spawnIsland(islandElement.parentElement.children[[...islandElement.parentElement.children].indexOf(islandElement) + moveBy], islandSource, dataType, newData);
}

export function renderExtras() {
    var island = document.querySelector('.island');
    if (!island) return;
    if (island.classList.contains('rendered')) return;
    var textarea = island.querySelector('.description .textarea');
    if (textarea) {
        var textareaContent = textarea.getAttribute('content');
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
        quill.setContents(JSON.parse(textareaContent));
    }
    island.querySelectorAll('img[data-src]:not([src])').forEach(img => img.src = img.getAttribute('data-src'));
    mediumZoom(".island .attachments img", {
        background: "transparent"
    });
    island.classList.add('rendered');
}