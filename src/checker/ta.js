/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var courses = [];
var questions = [];
var answers = [];
var responses = [];
var active = false;
var timestamps = false;
var unsavedChanges = false;
var noReloadCourse = false;

try {
  async function init() {
    if (!storage.get("code")) return window.location.href = '/';
    if (!storage.get("pwd")) return ui.modal({
      title: 'Enter Password',
      body: `<p>Enter the assigned password for TA seat code <code>${storage.get("code")}</code>.</p>`,
      input: {
        type: 'password'
      },
      buttons: [
        {
          text: 'Verify',
          class: 'submit-button',
          onclick: (inputValue) => {
            storage.set("pwd", inputValue);
            init();
          },
          close: true,
        },
      ],
    });

    // Show clear data fix guide
    // if (storage.get("created")) {
    //   document.querySelector(`[data-modal-view="clear-data-fix"]`).remove();
    // } else {
    //   storage.set("created", Date.now());
    // }

    await fetch(domain + '/courses?ta=' + storage.get("code") + '&pwd=' + storage.get("pwd"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    })
      .then(async (r) => {
        if (!r.ok) {
          try {
            var re = await r.json();
            if (re.error || re.message) {
              ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
              throw new Error(re.error || re.message);
            } else {
              throw new Error("API error");
            }
          } catch (e) {
            throw new Error(e.message || "API error");
          }
        }
        return await r.json();
      })
      .then(async c => {
        courses = c;
        if (courses.length === 0) return ui.modal({
          title: 'Enter Password',
          body: `<p>Enter the assigned password for TA seat code <code>${storage.get("code")}</code>.</p>`,
          input: {
            type: 'password'
          },
          buttons: [
            {
              text: 'Verify',
              class: 'submit-button',
              onclick: (inputValue) => {
                storage.set("pwd", inputValue);
                init();
              },
              close: true,
            },
          ],
        });
        if (!noReloadCourse) {
          document.getElementById("course-period-input").innerHTML = "";
          c.sort((a, b) => a.id - b.id).forEach(course => {
            var coursePeriods = JSON.parse(course.periods);
            const option = document.createElement("option");
            option.value = course.id;
            option.innerHTML = document.getElementById("course-input") ? course.name : `${course.name}${(coursePeriods.length > 0) ? ` (Period${(coursePeriods.length > 1) ? 's' : ''} ${coursePeriods.join(', ')})` : ''}`;
            document.getElementById("course-period-input").appendChild(option);
          });
        }
        document.getElementById("course-period-input").addEventListener("change", updateResponses);
        document.getElementById("sort-segment-input").addEventListener("input", updateResponses);
        document.getElementById("sort-question-input").addEventListener("input", updateResponses);
        document.getElementById("sort-seat-input").addEventListener("input", updateResponses);
        await fetch(domain + '/questions?ta=' + storage.get("code") + '&pwd=' + storage.get("pwd"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          }
        })
          .then(async (r) => {
            if (!r.ok) throw new Error(r.error || r.message || "API error");
            return await r.json();
          })
          .then(async q => {
            questions = q;
            await fetch(domain + '/answers?ta=' + storage.get("code") + '&pwd=' + storage.get("pwd"), {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              }
            })
              .then(async (r) => {
                if (!r.ok) throw new Error(r.error || r.message || "API error");
                return await r.json();
              })
              .then(async a => {
                answers = a;
                await fetch(domain + '/responses?ta=' + storage.get("code") + '&pwd=' + storage.get("pwd"), {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  }
                })
                  .then(async (r) => {
                    if (!r.ok) throw new Error(r.error || r.message || "API error");
                    return await r.json();
                  })
                  .then(async r => {
                    responses = r;
                    if (!noReloadCourse) document.getElementById("course-period-input").value = courses.find(c => JSON.parse(c.periods).includes(Number(String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0]?.seatCode)[0]))) ? courses.find(c => JSON.parse(c.periods).includes(Number(String(responses.sort((a, b) => String(a.seatCode)[0] - String(b.seatCode)[0])[0]?.seatCode)[0]))).id : 0;
                    await updateResponses();
                    active = true;
                    ui.stopLoader();
                    ui.toast("Data restored.", 1000, "info", "bi bi-cloud-arrow-down");
                  })
                  .catch((e) => {
                    console.error(e);
                    ui.view("api-fail");
                  });
              })
              .catch((e) => {
                console.error(e);
                ui.view("api-fail");
              });
          })
          .catch((e) => {
            console.error(e);
            ui.view("api-fail");
          });
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      });
    reloadUnsavedInputs();
  }

  init();

  window.addEventListener('beforeunload', function (event) {
    if (!unsavedChanges) return;
    const confirmationMessage = 'You have unsaved changes. Do you really want to leave?';
    event.returnValue = confirmationMessage;
    return confirmationMessage;
  });

  function reloadUnsavedInputs() {
    document.querySelectorAll('textarea').forEach(input => input.addEventListener('input', () => {
      unsavedChanges = true;
    }));
    document.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      unsavedChanges = true;
    }));
  }

  document.querySelector('[data-timestamps]').addEventListener("click", toggleTimestamps);

  function toggleTimestamps() {
    if (!active) return;
    if (timestamps) {
      timestamps = false;
      document.querySelector('[data-timestamps] .bi-clock').style.display = "block";
      document.querySelector('[data-timestamps] .bi-clock-fill').style.display = "none";
      document.querySelector('#checker').classList.remove('timestamps');
    } else {
      timestamps = true;
      document.querySelector('[data-timestamps] .bi-clock').style.display = "none";
      document.querySelector('[data-timestamps] .bi-clock-fill').style.display = "block";
      document.querySelector('#checker').classList.add('timestamps');
    }
  }

  async function updateResponses() {
    document.querySelector('.awaitingResponses .section').innerHTML = '';
    document.querySelector('.trendingResponses .section').innerHTML = '';
    document.querySelector('.responses .section').innerHTML = '';
    var trendingResponses = [];
    var timedResponses = [];
    var responses1 = responses
      .filter(r => courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value)?.periods).includes(Number(String(r.seatCode)[0])) : false)
      .filter(r => String(r.segment).startsWith(document.getElementById("sort-segment-input")?.value))
      .filter(r => questions.find(q => q.id == r.question_id).number.startsWith(document.getElementById("sort-question-input")?.value))
      .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
      .sort((a, b) => {
        if (a.flagged && !b.flagged) return -1;
        if (!a.flagged && b.flagged) return 1;
        return b.id - a.id;
      });
    responses1.forEach(r => {
      var responseString = r.response;
      if (responseString.includes('[')) {
        var parsedResponse = JSON.parse(r.response);
        responseString = parsedResponse.join(', ');
      }
      var correctResponsesString = `Accepted: ${answers.find(a => a.id === questions.find(q => q.id == r.question_id).id).correct_answers.join(', ')}`;
      const date = new Date(r.timestamp);
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const currentDate = new Date(r.timestamp);
      var timeTaken = "N/A";
      var timeTakenToRevise = "N/A";
      const sameSeatCodeResponses = responses1.filter(a => a.seatCode === r.seatCode).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const sameQuestionResponses = sameSeatCodeResponses.filter(a => a.question_id === r.question_id);
      const lastResponseIndex = sameSeatCodeResponses.findIndex(a => new Date(a.timestamp) >= currentDate) - 1;
      const lastResponse = lastResponseIndex >= 0 ? sameSeatCodeResponses[lastResponseIndex] : null;
      const lastSameQuestionResponseIndex = sameQuestionResponses.findIndex(a => new Date(a.timestamp) >= currentDate) - 1;
      const lastSameQuestionResponse = lastSameQuestionResponseIndex >= 0 ? sameQuestionResponses[lastSameQuestionResponseIndex] : null;
      let timeDifference;
      if (lastResponse) {
        timeDifference = calculateTimeDifference(currentDate, lastResponse.timestamp);
        timeTaken = formatTimeDifference(timeDifference);
        timedResponses.push(timeDifference);
      }
      if (lastSameQuestionResponse) {
        timeDifference = calculateTimeDifference(currentDate, lastSameQuestionResponse.timestamp);
        timeTakenToRevise = formatTimeDifference(timeDifference);
      }
      var [daysPart, z, timePart] = r.timeTaken.split(' ');
      const days = parseInt(daysPart, 10);
      timePart = timePart || daysPart;
      const [hours1, minutes1] = timePart.split(':').map(part => parseInt(part, 10));
      const totalHours = days * 24 + hours1;
      let result;
      if (totalHours >= 24) {
        result = `${days}d ${hours1}h`;
      } else if (totalHours >= 1) {
        result = `${hours1}h ${minutes1}m`;
      } else {
        result = `${minutes1}m`;
      }
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      buttonGrid.id = `response-${r.id}`;
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.id}" disabled hidden />${(r.flagged == '1') ? `<button square data-unflag-response tooltip="Unflag Response"><i class="bi bi-flag-fill"></i></button>` : `<button square data-flag-response tooltip="Flag Response"><i class="bi bi-flag"></i></button>`}<input type="text" autocomplete="off" class="small" id="response-segment-input" value="${r.segment}" disabled data-segment /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => q.id == r.question_id).number}" disabled data-question /><input type="text" autocomplete="off" class="small${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => q.id == r.question_id).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-seat-code-input" value="${r.seatCode}" disabled data-seat-code /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTaken}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTakenToRevise}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><!--<input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${result}" disabled data-time-taken />--><input type="text" autocomplete="off" id="response-response-input" value="${responseString}" disabled />${(r.status === 'Incorrect') ? `<button square data-edit-reason tooltip="Edit Reason"><i class="bi bi-reply${(r.reason) ? '-fill' : ''}"></i></button>` : ''}<input type="text" autocomplete="off" class="smedium${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => q.id == r.question_id).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-timestamp-input" value="${date.getMonth() + 1}/${date.getDate()} ${hours % 12 || 12}:${minutes < 10 ? '0' + minutes : minutes} ${hours >= 12 ? 'PM' : 'AM'}" disabled />${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => q.id == r.question_id).id).correct_answers.length > 0)) ? `<input type="text" autocomplete="off" class="showonhover" id="response-correct-responses-input" value="${correctResponsesString}" disabled />` : ''}<button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      document.querySelector('.responses .section').appendChild(buttonGrid);
      if (((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')) document.querySelector('.awaitingResponses .section').appendChild(buttonGrid);
      var trend = trendingResponses.find(t => (t.segment === r.segment) && (t.question_id === r.question_id) && (t.response === responseString) && (t.status === r.status));
      if (trend) {
        trend.count++;
      } else {
        trendingResponses.push({
          segment: r.segment,
          question_id: r.question_id,
          response: r.response,
          status: r.status,
          count: 1
        });
      }
    });
    const stdDev = calculateStandardDeviation(timedResponses);
    // console.log("Standard Deviation:", stdDev);
    document.querySelectorAll('[data-time-taken]').forEach(d => {
      if (d.hasAttribute('time') && (Number(d.getAttribute('time')) > stdDev)) d.classList.add('disabled');
    });
    trendingResponses.filter(t => t.count > 1).forEach(r => {
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.id}" disabled hidden /><input type="text" autocomplete="off" class="small" id="response-segment-input" value="${r.segment}" disabled data-segment /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => q.id == r.question_id).number}" disabled data-question /><input type="text" autocomplete="off" id="response-response-input" value="${r.response}" disabled /><input type="text" autocomplete="off" class="small" id="response-count-input" value="${r.count}" disabled /><button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      document.querySelector('.trendingResponses .section').appendChild(buttonGrid);
    });
    document.querySelectorAll('#mark-correct-button').forEach(a => a.addEventListener('click', markCorrect));
    document.querySelectorAll('#mark-incorrect-button').forEach(a => a.addEventListener('click', markIncorrect));
    document.querySelectorAll('[data-flag-response]').forEach(a => a.addEventListener('click', flagResponse));
    document.querySelectorAll('[data-unflag-response]').forEach(a => a.addEventListener('click', unflagResponse));
    document.querySelectorAll('[data-edit-reason]').forEach(a => a.addEventListener('click', editReason));
  }

  function calculateTimeDifference(currentDate, previousTimestamp) {
    const lastResponseDate = new Date(previousTimestamp);
    return (currentDate - lastResponseDate) / 60000;
  }

  function formatTimeDifference(timeDifference) {
    if (timeDifference >= 1440) {
      const days = Math.floor(timeDifference / 1440);
      const hours = Math.floor((timeDifference % 1440) / 60);
      return `${days}d ${hours > 0 ? `${hours}h` : ''}`.trim();
    } else if (timeDifference >= 60) {
      const hours = Math.floor(timeDifference / 60);
      const minutes = Math.floor(timeDifference % 60);
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
    } else {
      return `${Math.floor(timeDifference)} min${Math.floor(timeDifference) === 1 ? '' : 's'}`;
    }
  }

  function calculateStandardDeviation(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
    const variance = arr.reduce((sum, value) => {
      const diff = value - mean;
      return sum + diff * diff;
    }, 0) / arr.length;
    return Math.sqrt(variance);
  }

  function flagResponse() {
    if (!active) return;
    unsavedChanges = true;
    fetch(domain + '/flag?ta=' + storage.get("code"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: this.parentElement.querySelector('#response-id-input').value,
        seatCode: this.parentElement.querySelector('#response-seat-code-input').value,
        pwd: storage.get("pwd"),
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          try {
            var re = await r.json();
            if (re.error || re.message) {
              ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
              throw new Error(re.error || re.message);
            } else {
              throw new Error("API error");
            }
          } catch (e) {
            throw new Error(e.message || "API error");
          }
        }
        return await r.json();
      })
      .then(() => {
        unsavedChanges = false;
        ui.toast("Flagged response for review.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      });
  }

  function unflagResponse() {
    if (!active) return;
    unsavedChanges = true;
    fetch(domain + '/unflag?ta=' + storage.get("code"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: this.parentElement.querySelector('#response-id-input').value,
        seatCode: this.parentElement.querySelector('#response-seat-code-input').value,
        pwd: storage.get("pwd"),
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          try {
            var re = await r.json();
            if (re.error || re.message) {
              ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
              throw new Error(re.error || re.message);
            } else {
              throw new Error("API error");
            }
          } catch (e) {
            throw new Error(e.message || "API error");
          }
        }
        return await r.json();
      })
      .then(() => {
        unsavedChanges = false;
        ui.toast("Unflagged response.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      });
  }

  function markCorrect() {
    if (!active) return;
    unsavedChanges = true;
    fetch(domain + '/mark_correct?ta=' + storage.get("code"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questions.find(q => q.number == this.parentElement.querySelector('#response-question-input').value).id,
        answer: this.parentElement.querySelector('#response-response-input').value,
        pwd: storage.get("pwd"),
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          try {
            var re = await r.json();
            if (re.error || re.message) {
              ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
              throw new Error(re.error || re.message);
            } else {
              throw new Error("API error");
            }
          } catch (e) {
            throw new Error(e.message || "API error");
          }
        }
        return await r.json();
      })
      .then(() => {
        unsavedChanges = false;
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        noReloadCourse = true;
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      });
  }

  function markIncorrect() {
    if (!active) return;
    ui.modal({
      title: 'Add Reason',
      body: '<p>Add a reason that this response is incorrect.</p>',
      input: {
        type: 'text',
        placeholder: 'Take the derivative of x^2 before multiplying.',
        defaultValue: '',
      },
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: (inputValue) => {
            markIncorrectConfirm(inputValue, this);
          },
          close: true,
        },
      ],
    });
  }

  function markIncorrectConfirm(reason, e) {
    if (!active) return;
    unsavedChanges = true;
    fetch(domain + '/mark_incorrect?ta=' + storage.get("code"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questions.find(q => q.number == e.parentElement.querySelector('#response-question-input').value).id,
        answer: e.parentElement.querySelector('#response-response-input').value,
        reason: reason,
        pwd: storage.get("pwd"),
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          try {
            var re = await r.json();
            if (re.error || re.message) {
              ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
              throw new Error(re.error || re.message);
            } else {
              throw new Error("API error");
            }
          } catch (e) {
            throw new Error(e.message || "API error");
          }
        }
        return await r.json();
      })
      .then(() => {
        unsavedChanges = false;
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        noReloadCourse = true;
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
      });
  }

  function editReason() {
    if (!active) return;
    ui.modal({
      title: 'Edit Reason',
      body: '<p>Edit your reason that this response is incorrect.</p>',
      input: {
        type: 'text',
        placeholder: responses.find(r => r.id == this.parentElement.querySelector('#response-id-input').value).reason || '',
        defaultValue: responses.find(r => r.id == this.parentElement.querySelector('#response-id-input').value).reason || '',
      },
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: (inputValue) => {
            markIncorrectConfirm(inputValue, this);
          },
          close: true,
        },
      ],
    });
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ ta.js: ${error.message}`);
  };
  throw error;
};