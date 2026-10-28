import './reset.css';
import './layout.css';
import './design.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@excalidraw/excalidraw/index.css';
import './themes/themes.js';
import * as ui from './modules/ui.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw, exportToSvg, restoreElements, WelcomeScreen } from '@excalidraw/excalidraw';
import HTTPSockBroadcast from 'httpsock/broadcast.mjs';
import * as auth from './modules/auth.js';
import storage from './modules/storage.js';

const socketDomain = ((location.hostname.includes('check')) || location.hostname.includes('127')) ? `https://${location.hostname.includes('beta') ? 'beta.' : ''}ws.api.check.vssfalcons.com` : `http://${document.domain}:1234`;

let api = null;
let scene = { elements: [], appState: {}, files: {} };
let broadcaster = null;
let timer = null;
let active = false;
let receiveBoard = true;
let hadWhiteboardContent = false;
let welcomeScreenVisible = false;
const period = document.getElementById('whiteboard-period');
const start = document.getElementById('start-whiteboard');
const end = document.getElementById('end-whiteboard');
const focusButton = document.getElementById('focus-whiteboard');

function whiteboardState() {
  const styles = getComputedStyle(document.body);
  return {
    theme: styles.colorScheme.includes('dark') ? 'dark' : 'light',
  };
}

async function send(final) {
  if (!broadcaster || !api) return;
  const appState = api.getAppState();
  const svg = await exportToSvg({ elements: scene.elements, appState: scene.appState, files: scene.files, exportPadding: 20 });
  const savedScene = {
    elements: scene.elements,
    appState: {
      ...whiteboardState(),
      gridSize: scene.appState.gridSize,
      viewBackgroundColor: appState.viewBackgroundColor,
    },
    files: scene.files,
  };
  const width = appState.width || window.innerWidth;
  const height = appState.height || window.innerHeight;
  const x = -(appState.scrollX || 0);
  const y = -(appState.scrollY || 0);
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('x', x);
  background.setAttribute('y', y);
  background.setAttribute('width', width);
  background.setAttribute('height', height);
  background.setAttribute('fill', appState.viewBackgroundColor || '#ffffff');
  svg.prepend(background);
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  broadcaster.sendQuiet({ type: 'whiteboard', content: { scene: savedScene, svg: svg.outerHTML, final } });
}

function loadScene(savedScene) {
  if (!api || !savedScene || !Array.isArray(savedScene.elements)) return;
  const { gridSize } = savedScene.appState || {};
  scene = { elements: restoreElements(savedScene.elements, null), appState: { ...whiteboardState(), gridSize, showWelcomeScreen: savedScene.elements.length === 0 }, files: savedScene.files || {} };
  api.updateScene(scene);
  hadWhiteboardContent = scene.elements.length > 0;
  if (hadWhiteboardContent) api.setActiveTool({ type: 'freedraw' });
  requestAnimationFrame(focusWhiteboard);
}

function receive(response) {
  if (!receiveBoard) return;
  try {
    const data = JSON.parse(response);
    if ((data.type === 'whiteboard') && data.scene) {
      loadScene(data.scene);
      receiveBoard = false;
    }
  } catch { }
}

function connect() {
  if (broadcaster) return;
  broadcaster = new HTTPSockBroadcast({ server: `${socketDomain}/${period.value}/whiteboard?noBroadcast=true`, cert: './certs/chain.pem', auth: { username: storage.get('usr'), password: storage.get('pwd') }, callback: receive });
  broadcaster.sendQuiet('ping');
}

async function startWhiteboard() {
  await auth.suggestionRequest('/admin/suggestions', {}, true);
  connect();
  receiveBoard = false;
  active = true;
  period.disabled = true;
  start.disabled = true;
  end.disabled = false;
  await send(false);
  timer = setInterval(() => send(false).catch(() => { }), 2000);
}

async function endWhiteboard() {
  clearInterval(timer);
  await send(true);
  broadcaster = null;
  active = false;
  period.disabled = false;
  start.disabled = false;
  end.disabled = true;
}

function focusWhiteboard() {
  if (!api) return;
  const elements = api.getSceneElements();
  if (!elements.length) {
    api.updateScene({ appState: { zoom: { value: 1 }, showWelcomeScreen: welcomeScreenVisible, activeTool: { type: 'freedraw' } } });
    return;
  }
  api.scrollToContent(elements, { fitToViewport: true, viewportZoomFactor: 0.9, animate: true });
}

function welcomeLogo() {
  const logo = document.querySelector('.virtual-checker-logo');
  if (!logo) return null;
  const color = (excalidrawTheme === 'dark') ? '#ffffff' : '#000000';
  const svg = logo.outerHTML.replaceAll('currentColor', color);
  return React.createElement('img', { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt: 'Virtual Checker', style: { height: '4rem', width: 'auto' } });
}

start.addEventListener('click', () => startWhiteboard().catch(error => alert(error.message)));
end.addEventListener('click', () => endWhiteboard().catch(error => alert(error.message)));
focusButton.addEventListener('click', focusWhiteboard);
period.addEventListener('change', () => {
  if (active) return;
  broadcaster = null;
  receiveBoard = true;
  scene = { elements: [], appState: {}, files: {} };
  hadWhiteboardContent = false;
  api?.updateScene({ ...scene, appState: { showWelcomeScreen: true, activeTool: { type: 'freedraw' } } });
  connect();
});
window.addEventListener('beforeunload', () => clearInterval(timer));

const whiteboardRoot = createRoot(document.getElementById('whiteboard-root'));
let excalidrawTheme = whiteboardState().theme;

function renderWhiteboard() {
  whiteboardRoot.render(React.createElement(Excalidraw, {
    theme: excalidrawTheme,
    initialData: { appState: { ...whiteboardState(), activeTool: { type: 'freedraw' }, showWelcomeScreen: true } },
    excalidrawAPI: value => {
      api = value;
      if (api.getSceneElements().length) api.setActiveTool({ type: 'freedraw' });
      requestAnimationFrame(focusWhiteboard);
      connect();
    },
    onChange: (elements, appState, files) => {
      scene = { elements, appState, files };
      const hasElements = elements.some(element => !element.isDeleted);
      if (hasElements) {
        hadWhiteboardContent = true;
        welcomeScreenVisible = false;
      } else if (appState.showWelcomeScreen) {
        welcomeScreenVisible = true;
      } else if (welcomeScreenVisible) {
        welcomeScreenVisible = false;
        api?.setActiveTool({ type: 'freedraw' });
      } else if (hadWhiteboardContent) {
        hadWhiteboardContent = false;
        api?.updateScene({ appState: { showWelcomeScreen: true, activeTool: { type: 'freedraw' } } });
      }
    }
  }, React.createElement(WelcomeScreen, null,
    React.createElement(WelcomeScreen.Center, null,
      React.createElement(WelcomeScreen.Center.Logo, null, welcomeLogo()),
      React.createElement(WelcomeScreen.Center.Heading, null, 'Virtual Checker Whiteboard')
    )
  )));
}

function syncExcalidrawTheme() {
  const theme = whiteboardState().theme;
  if (theme === excalidrawTheme) return;
  excalidrawTheme = theme;
  api?.updateScene({ appState: { theme, showWelcomeScreen: welcomeScreenVisible, activeTool: { type: 'freedraw' } } });
  renderWhiteboard();
}

const themeObserver = new MutationObserver(syncExcalidrawTheme);
themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'style'] });
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncExcalidrawTheme);
renderWhiteboard();
ui.stopLoader();
