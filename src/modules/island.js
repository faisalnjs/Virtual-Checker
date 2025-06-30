import { convertLatexToMarkup, renderMathInElement } from "mathlive";

var lastIslandId = null;

export default function island(data) {
    var island = document.querySelector('.island');
    if (!island) {
        island = document.createElement('div');
        island.classList.add('island');
        document.body.appendChild(island);
    }
    if (!data) return island.classList.remove('visible');
    if (island.offsetWidth < 250) return island.classList.remove('visible');
    if (data.id) {
        if (lastIslandId && (data.id === lastIslandId)) return island.classList.add('visible');
        lastIslandId = data.id;
    }
    island.innerHTML = '';
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