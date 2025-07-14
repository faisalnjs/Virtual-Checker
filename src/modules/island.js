import { convertLatexToMarkup, renderMathInElement } from "mathlive";

var lastIslandId = null;
var islandSource = null;
var islandSource2 = null;

export default function spawnIsland(source = null, dataType = 'question', data = {}, source2 = null) {
    var island = document.querySelector('.island');
    if (!island) {
        island = document.createElement('div');
        island.classList.add('island');
        document.body.appendChild(island);
    }
    if (Object.keys(data).length === 0) return island.classList.remove('visible');
    if (island.offsetWidth < 250) return island.classList.remove('visible');
    if (data.id) {
        if (lastIslandId && (data.id === lastIslandId)) return island.classList.add('visible');
        lastIslandId = data.id;
    }
    island.innerHTML = '';
    if (source) islandSource = source;
    if (source2) islandSource2 = source2;
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
                            itemElement.innerHTML += `${itemKey[0].toUpperCase()}${itemKey.slice(1)}: ${item[itemKey]}, `;
                        });
                        itemElement.innerHTML = itemElement.innerHTML.slice(0, itemElement.innerHTML.length - 2);
                    } else {
                        itemElement.innerHTML = item;
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
    var key = keys.includes('id') ? 'id' : keys.includes('number') ? 'number' : keys.includes('name') ? 'name' : keys.includes('period') ? 'period' : null;
    if (!key) return;
    var currentIndex = islandSource.findIndex(item => String(item[key]) === String(sourceId));
    if (currentIndex === -1) return;
    var newIndex = currentIndex + moveBy;
    if (newIndex < 0 || newIndex >= islandSource.length) return;
    var newItem = islandSource[newIndex];
    var newData = {};
    switch (dataType) {
        case 'segment':
            newData = {
                sourceId: String(newItem.number),
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
        default:
            newData = {
                sourceId: String(newItem.id),
                id: `ID ${newItem.id}`,
                title: `Question ${newItem.number}`,
                subtitle: `${newItem.question}`,
                subtitleLatex: newItem.latex,
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
    spawnIsland(islandSource, dataType, newData);
}