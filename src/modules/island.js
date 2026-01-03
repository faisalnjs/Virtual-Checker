/* eslint-disable no-empty */
/* eslint-disable no-redeclare */
import { convertLatexToMarkup } from "mathlive";
import mediumZoom from "medium-zoom";
import Quill from "quill";
import "faz-quill-emoji/autoregister";

var lastIslandSourceId = null;
var islandSource = null;
var islandSource2 = null;
var islandSource3 = null;
var islandElement = null;
var hideIslandTimeout = null;
var islandRenderTimer = null;
var islandRenderCache = new Map();

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
        if (islandRenderTimer) {
            clearTimeout(islandRenderTimer);
            islandRenderTimer = null;
        }
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
    if (window.innerWidth < 1000) return island.classList.remove('visible');
    if (document.querySelector('.questions .section.expanded')) return island.classList.remove('visible');
    if (data.id) {
        if (lastIslandSourceId && (String(data.id) === String(lastIslandSourceId))) return island.classList.add('visible');
        lastIslandSourceId = data.id;
    }
    if (source) islandSource = source;
    if (source2) islandSource2 = source2;
    if (source3) islandSource3 = source3;
    island.classList.remove('rendered');
    island.setAttribute('datatype', dataType);
    island.setAttribute('sourceid', String(data.sourceId || ''));
    function _getItemKey(it) {
        if (!it) return '';
        if (typeof it === 'string' || typeof it === 'number') return String(it);
        return String(it.id ?? it.number ?? it.name ?? it.period ?? '');
    }
    var sourceSignature = '';
    try {
        if (Array.isArray(islandSource) && islandSource.length > 0) {
            var first = _getItemKey(islandSource[0]);
            var last = _getItemKey(islandSource[islandSource.length - 1]);
            sourceSignature = `${islandSource.length}:${first}:${last}`;
        }
    } catch (e) {
        sourceSignature = '';
    }
    var positionIndex = '';
    try {
        if (element && element.parentElement) positionIndex = String([].indexOf.call(element.parentElement.children, element));
    } catch (e) {
        positionIndex = '';
    }
    function _hashString(str) {
        var h = 5381;
        for (var i = 0; i < str.length; i++) {
            h = ((h << 5) + h) + str.charCodeAt(i);
            h = h & 0xFFFFFFFF;
        }
        return (h >>> 0).toString(36);
    }
    var cacheKey = '';
    if (data && (data.id || data.uniqueId)) {
        cacheKey = `${dataType}:id:${String(data.id || data.uniqueId)}`;
    } else {
        try {
            var fingerprintSource = JSON.stringify(data || {});
            if (fingerprintSource.length > 1200) fingerprintSource = fingerprintSource.slice(0, 1200);
            var sig = _hashString(fingerprintSource);
            cacheKey = `${dataType}:full:${sig}:pos:${positionIndex}:${sourceSignature}`;
        } catch (e) {
            try {
                var fingerprintSource = JSON.stringify({
                    title: data.title || '',
                    subtitle: data.subtitle || '',
                    description: data.description || '',
                    attachments: data.attachments || '',
                    lists: data.lists ? data.lists.map(l => ({ title: l.title || '', len: (l.items || []).length })) : ''
                });
                var sig = _hashString(fingerprintSource);
                cacheKey = `${dataType}:sig:${sourceSignature}:${sig}`;
            } catch (e2) {
                cacheKey = `${dataType}:${sourceSignature}:${String(data.sourceId || data.number || '')}`;
            }
        }
    }
    if (islandRenderCache.has(cacheKey)) {
        island.innerHTML = islandRenderCache.get(cacheKey);
        island.classList.add('visible');
        requestAnimationFrame(() => renderExtras());
        return;
    }
    if (islandRenderTimer) clearTimeout(islandRenderTimer);
    islandRenderTimer = setTimeout(() => {
        try {
            var stem = null;
            var html = '';
            if (data.id) html += `<code>${escapeHTML(String(data.id))}</code>`;
            if (data.title) html += `<h4>${escapeHTML(String(data.title))}</h4>`;
            if (data.subtitle) html += `<h6>${data.subtitleLatex ? convertLatexToMarkup(String(data.subtitle)) : escapeHTML(String(data.subtitle))}</h6>`;
            if ((dataType === 'response' || dataType === 'question') && source2 && Array.isArray(source2)) {
                try {
                    var qId = String(data.id || '').match(/ID\s*(\d+)/) ? String(data.id || '').match(/ID\s*(\d+)/)[1] : (data.sourceId || null);
                    if (qId) {
                        const qObj = source2.find(q => String(q.id) === String(qId));
                        if (qObj && qObj.stem) stem = source2.find(sq => String(sq.id) === String(qObj.stem)) || null;
                    }
                } catch (e) { }
            }
            if (stem && stem.description && stem.description.includes('ops') && (stem.description != '{"ops":[{"insert":"\\n"}]}') && JSON.parse(String(stem.description).replaceAll(/\s/g, ''))) html += `<div class="description extra hidden"><div class="textarea" content='${escapeHTML(String(stem.description))}'></div></div>`;
            if (data.description && data.description.includes('ops') && (data.description != '{"ops":[{"insert":"\\n"}]}') && JSON.parse(String(data.description).replaceAll(/\s/g, ''))) html += `<div class="description extra hidden"><div class="textarea" content='${escapeHTML(String(data.description))}'></div></div>`;
            var islandAttachments = [...((stem && stem.images) ? JSON.parse(String(stem.images)) : []), ...(data.attachments ? JSON.parse(String(data.attachments)) : [])];
            if (islandAttachments.length) {
                html += `<div class="attachments extra hidden">`;
                islandAttachments.forEach(attachment => {
                    html += `<img data-src="${escapeHTML(String(attachment))}">`;
                });
                html += `</div>`;
            }
            if (data.lists) {
                data.lists.forEach(list => {
                    html += `<div>`;
                    if (list.title) html += `<h5>${escapeHTML(String(list.title))}</h5>`;
                    if (list.items) {
                        html += `<ul>`;
                        list.items.forEach(item => {
                            if (typeof item === 'object') {
                                var parts = [];
                                Object.keys(item).forEach(itemKey => {
                                    parts.push(`${escapeHTML(itemKey[0].toUpperCase() + itemKey.slice(1))}: ${escapeHTML(String(item[itemKey]))}`);
                                });
                                html += `<li>${parts.join(', ').replace(/, $/, '')}</li>`;
                            } else {
                                html += `<li>${escapeHTML(String(item))}</li>`;
                            }
                        });
                        html += `</ul>`;
                    }
                    html += `</div>`;
                });
            }
            island.innerHTML = html;
            island.classList.add('visible');
            try { islandRenderCache.set(cacheKey, html); } catch (e) { }
            if (islandRenderCache.size > 200) {
                const firstKey = islandRenderCache.keys().next().value;
                if (firstKey) islandRenderCache.delete(firstKey);
            }
            requestAnimationFrame(() => renderExtras());
        } finally {
            islandRenderTimer = null;
        }
    }, 120);
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