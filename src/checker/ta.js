/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as time from "/src/modules/time.js";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;
if (window.location.pathname.split('?')[0].endsWith('/ta')) window.location.pathname = '/ta/';

var responses = [];
var polling = false;
var active = false;
var timestamps = false;

try {
  async function init() {
    if (document.getElementById('toggle-polling')) document.getElementById('toggle-polling').addEventListener('click', togglePolling);
    if (document.getElementById('toggle-timestamps')) document.getElementById('toggle-timestamps').addEventListener('click', toggleTimestamps);
    await fetchResponses();
  }

  init();

  async function fetchResponses() {
    const response = await fetch(`${domain}/responses`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
    .catch((e) => {
      console.error(e);
      if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      pollingOff();
    });
    responses = await response.json();
    updateResponses();
  }

  function updateResponses() {
    const responseContainer = document.getElementById('response-container');
    responseContainer.innerHTML = '';
    responses.forEach((response) => {
      const responseElement = document.createElement('div');
      responseElement.classList.add('response');
      responseElement.innerHTML = `
        <p><b>Question:</b> ${response.question}</p>
        <p><b>Answer:</b> ${response.answer}</p>
        <p><b>Status:</b> ${response.status}</p>
        ${timestamps ? `<p><b>Timestamp:</b> ${time.unixToString(response.timestamp)}</p>` : ''}
        <button class="flag-response" data-id="${response.id}">${response.flagged ? 'Unflag' : 'Flag'}</button>
        <button class="mark-response" data-id="${response.id}">${response.status === 'Correct' ? 'Mark Incorrect' : 'Mark Correct'}</button>
      `;
      responseContainer.appendChild(responseElement);
    });
    document.querySelectorAll('.flag-response').forEach((button) => {
      button.addEventListener('click', toggleFlag);
    });
    document.querySelectorAll('.mark-response').forEach((button) => {
      button.addEventListener('click', toggleMark);
    });
    active = true;
  }

  async function toggleFlag(event) {
    if (!active) return;
    const responseId = event.target.dataset.id;
    const response = responses.find((r) => r.id === responseId);
    response.flagged = !response.flagged;
    await fetch(`${domain}/responses/${responseId}/flag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ flagged: response.flagged }),
    })
    .catch((e) => {
      console.error(e);
      if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      pollingOff();
    });
    updateResponses();
  }

  async function toggleMark(event) {
    if (!active) return;
    const responseId = event.target.dataset.id;
    const response = responses.find((r) => r.id === responseId);
    response.status = response.status === 'Correct' ? 'Incorrect' : 'Correct';
    await fetch(`${domain}/responses/${responseId}/mark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: response.status }),
    })
    .catch((e) => {
      console.error(e);
      if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      pollingOff();
    });
    updateResponses();
  }

  function togglePolling() {
    if (!active) return;
    polling = !polling;
    document.getElementById('toggle-polling').textContent = polling ? 'Stop Polling' : 'Start Polling';
    if (polling) startPolling();
  }

  function startPolling() {
    if (!active) return;
    if (!polling) return;
    fetchResponses();
    setTimeout(startPolling, 5000);
  }

  function pollingOff() {
    if (!active) return;
    if (!document.querySelector('[data-polling]')) return;
    polling = false;
    document.querySelector('[data-polling] .bi-skip-forward-circle').style.display = "block";
    document.querySelector('[data-polling] .bi-stop-circle-fill').style.display = "none";
  }

  function toggleTimestamps() {
    if (!active) return;
    timestamps = !timestamps;
    document.getElementById('toggle-timestamps').textContent = timestamps ? 'Hide Timestamps' : 'Show Timestamps';
    updateResponses();
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ admin.js: ${error.message}`);
  };
  throw error;
};