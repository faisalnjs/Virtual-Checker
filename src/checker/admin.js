/* eslint-disable no-unreachable */
/* eslint-disable no-inner-declarations */
import * as ui from "/src/modules/ui.js";
import storage from "/src/modules/storage.js";
import * as time from "/src/modules/time.js";
import * as auth from "/src/modules/auth.js";
import island from "/src/modules/island.js";
import { convertLatexToMarkup, renderMathInElement } from "mathlive";
import { createSwapy } from "swapy";
import Quill from "quill";
import "faz-quill-emoji/autoregister";

const domain = ((window.location.hostname.search('check') != -1) || (window.location.hostname.search('127') != -1)) ? 'https://api.check.vssfalcons.com' : `http://${document.domain}:5000`;
if (window.location.pathname.split('?')[0].endsWith('/admin')) window.location.pathname = '/admin/';

var archiveTypeSelected = null;
var courses = [];
var segments = [];
var questions = [];
var answers = [];
var responses = [];
var formData = new FormData();
var polling = false;
var active = false;
var timestamps = false;
var speed = false;
var expandedReports = [];
var loadedSegment = null;
var loadedSegmentEditor = false;
var loadedSegmentCreator = false;
var noReloadCourse = false;
var logs = [];
var renderedEditors = {};
var rosters = [];
var aiInfo = {};
var settings = [];
var lastMarkedQuestion = {};
var pagination = {
  awaitingResponses: { page: 0, perPage: 50 },
  responses: { page: 0, perPage: 50 },
};

var draggableQuestionList = null;
var draggableSegmentReorder = null;

try {
  async function init() {
    if (!storage.get("usr") || !storage.get("pwd")) return auth.admin(init);
    if (document.querySelector('[data-logout]')) document.querySelector('[data-logout]').addEventListener('click', () => auth.logout(init));

    formData = new FormData();

    // Show clear data fix guide
    // if (storage.get("created")) {
    //   document.querySelector(`[data-modal-view="clear-data-fix"]`).remove();
    // } else {
    //   storage.set("created", Date.now());
    // }

    await fetch(domain + '/bulk_load', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
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
      .then(async bulkLoad => {
        courses = bulkLoad.courses;
        segments = bulkLoad.segments;
        questions = bulkLoad.questions;
        var users = bulkLoad.users;
        logs = bulkLoad.logs;
        aiInfo = bulkLoad.ai;
        var passwords = bulkLoad.passwords;
        var backups = bulkLoad.backups;
        var archive = bulkLoad.archive;
        var rosters = bulkLoad.rosters;
        answers = bulkLoad.answers;
        responses = bulkLoad.responses;
        settings = bulkLoad.settings;
        if (document.querySelector('.users')) {
          if (document.getElementById('add-user-button')) document.getElementById('add-user-button').addEventListener('click', addUserModal);

          document.querySelector('.users').innerHTML = '<div class="row header"><span>User</span><span>Role</span><span>Partial Access</span><span>Full Access</span><span>Anonymous</span><span>Actions</span></div>';
          if (users.length > 0) {
            document.getElementById('no-users').setAttribute('hidden', '');
            document.querySelector('.users').removeAttribute('hidden');
          } else {
            document.getElementById('no-users').removeAttribute('hidden');
            document.querySelector('.users').setAttribute('hidden', '');
          }
          users = users.sort((a, b) => {
            const roleA = a.role.toLowerCase();
            const roleB = b.role.toLowerCase();
            if (roleA < roleB) return -1;
            if (roleA > roleB) return 1;
            return a.username.localeCompare(b.username);
          });
          users.forEach(user => {
            document.querySelector('.users').innerHTML += `<div class="enhanced-item" id="${user.username}">
              <span class="username">${user.username}</span>
              <span class="role">${user.role}</span>
              <span class="partialAccessCourses">${JSON.stringify(user.main_courses)}</span>
              <span class="fullAccessCourses">${JSON.stringify(user.access_courses)}</span>
              <span class="anonymousResponses">${user.anonymous_responses ? '<i class="bi bi-check-lg"></i>' : ''}</span>
              <span class="actions">
                <button class="icon" data-edit-user tooltip="Edit User">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="icon" data-delete-user tooltip="Delete User">
                  <i class="bi bi-trash"></i>
                </button>
              </span>
            </div>`;
          });
          document.querySelectorAll('[data-edit-user]').forEach(button => button.addEventListener('click', editUserModal));
          document.querySelectorAll('[data-delete-user]').forEach(button => button.addEventListener('click', deleteUserModal));
          ui.stopLoader();
          active = true;
        }
        if (document.querySelector('.logs')) {
          if (document.getElementById('clear-logs')) document.getElementById('clear-logs').addEventListener('click', clearLogsModal);
          if (document.getElementById("filter-logs-by-username-input")) document.getElementById("filter-logs-by-username-input").addEventListener("input", updateLogs);
          if (document.getElementById("filter-logs-by-action-input")) document.getElementById("filter-logs-by-action-input").addEventListener("input", updateLogs);
          if (document.getElementById("filter-logs-by-type")) document.getElementById("filter-logs-by-type").addEventListener("input", updateLogs);
          updateLogs();
          ui.stopLoader();
          active = true;
        }
        if (document.querySelector('.ai-manager')) {
          updateAISettings();
          ui.stopLoader();
          active = true;
        }
        if (document.querySelector('.passwords')) {
          if (document.getElementById('remove-passwords')) document.getElementById('remove-passwords').addEventListener('click', removePasswordsModal);

          document.querySelector('.passwords').innerHTML = '<div class="row header"><span>Seat Code</span><span>Saved Settings</span><span>Actions</span></div>';
          if (passwords.length > 0) {
            document.getElementById('no-passwords').setAttribute('hidden', '');
            document.querySelector('.passwords').removeAttribute('hidden');
          } else {
            document.getElementById('no-passwords').removeAttribute('hidden');
            document.querySelector('.passwords').setAttribute('hidden', '');
          }
          passwords = passwords.sort((a, b) => a.seatCode - b.seatCode);
          passwords.forEach(password => {
            document.querySelector('.passwords').innerHTML += `<div class="enhanced-item" id="${password.seatCode}">
              <span class="seatCode">${password.seatCode}</span>
              <span class="settings">${(password.settings !== '{}') ? '<i class="bi bi-check-lg"></i>' : ''}</span>
              <span class="actions">
                <button class="icon" data-reset-password tooltip="Reset Password">
                  <i class="bi bi-key"></i>
                </button>
                <button class="icon" data-remove-password tooltip="Remove Password">
                  <i class="bi bi-trash"></i>
                </button>
              </span>
            </div>`;
          });
          document.querySelectorAll('[data-reset-password]').forEach(button => button.addEventListener('click', resetPasswordModal));
          document.querySelectorAll('[data-remove-password]').forEach(button => button.addEventListener('click', removePasswordModal));
          ui.stopLoader();
          active = true;
        }
        if (document.querySelector('.backups')) {
          if (document.getElementById('create-backup-button')) document.getElementById('create-backup-button').addEventListener('click', createBackupModal);
          document.querySelector('.backups').innerHTML = '<div></div><div class="row header"><span>Name</span><span>Type</span><span>Modified</span><span>Size</span><span>Actions</span></div>';
          if (backups.length > 0) {
            document.getElementById('no-backups').setAttribute('hidden', '');
            document.querySelector('.backups').removeAttribute('hidden');
          } else {
            document.getElementById('no-backups').removeAttribute('hidden');
            document.querySelector('.backups').setAttribute('hidden', '');
          }
          backups = backups.sort((a, b) => new Date(b.modified) - new Date(a.modified));
          function humanReadableFileSize(size) {
            const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            let unitIndex = 0;
            while (size >= 1024 && unitIndex < units.length - 1) {
              size /= 1024;
              unitIndex++;
            }
            return `${size.toFixed(2)} ${units[unitIndex]}`;
          }
          backups.forEach(backup => {
            document.querySelector('.backups').innerHTML += `<div class="enhanced-item" id="${backup.full_url}">
              <span class="file_name">${backup.file_name.split('.')[0]}</span>
              <span class="type"><code>${backup.file_name.split('.')[1].toUpperCase()}</code></span>
              <span class="modified">${time.unixToString(backup.modified)}</span>
              <span class="size">${humanReadableFileSize(backup.size)}</span>
              <span class="actions">
                <button class="icon" data-download-backup tooltip="Download Backup (${backup.file_name.split('.')[1].toUpperCase()})">
                  <i class="bi bi-download"></i>
                </button>
                <button class="icon" data-delete-backup tooltip="Delete Backup">
                  <i class="bi bi-trash"></i>
                </button>
              </span>
            </div>`;
          });
          document.querySelector('.backups').innerHTML += `<button id="delete-backups-button">Delete All Backups</button>`;
          document.querySelectorAll('[data-download-backup]').forEach(button => button.addEventListener('click', downloadBackupModal));
          document.querySelectorAll('[data-delete-backup]').forEach(button => button.addEventListener('click', deleteBackupModal));
          document.getElementById('delete-backups-button').addEventListener('click', deleteBackupsModal);
          ui.stopLoader();
          active = true;
        }
        if (document.querySelector('.archives')) {
          archiveType("courses");
          document.getElementById("archive-type-selector").addEventListener("input", (e) => {
            const mode = e.detail;
            archiveType(mode);
          });
          courses = archive.courses;
          segments = archive.segments;
          questions = archive.questions;
          answers = archive.answers;
          responses = archive.responses;
          updateCourses();
          updateSegments();
          updateQuestions();
          updateResponses();
          document.querySelector('#archive-type-selector [aria-selected="true"]')?.click();
          ui.stopLoader();
          active = true;
        }
        await auth.loadAdminSettings(courses);
        if (document.querySelector('.users')) {
          ui.reloadUnsavedInputs();
          return;
        }
        if (document.getElementById("course-period-input") && !loadedSegmentEditor && !loadedSegmentCreator && !noReloadCourse) {
          document.getElementById("course-period-input").innerHTML = "";
          courses.sort((a, b) => a.id - b.id).forEach(course => {
            var coursePeriods = JSON.parse(course.periods);
            const option = document.createElement("option");
            option.value = course.id;
            option.innerHTML = document.getElementById("course-input") ? course.name : `${course.name}${(coursePeriods.length > 0) ? ` (Period${(coursePeriods.length > 1) ? 's' : ''} ${coursePeriods.join(', ')})` : ''}`;
            document.getElementById("course-period-input").appendChild(option);
          });
          const course = courses.find(c => String(c.id) === document.getElementById("course-period-input").value);
          if (document.getElementById("course-input") && course) document.getElementById("course-input").value = course.name;
        }
        if (document.getElementById("export-report-course")) updateExportReportCourses();
        if (document.getElementById("course-period-input")) document.getElementById("course-period-input").addEventListener("change", updateResponses);
        if (document.getElementById("filter-segment-input")) document.getElementById("filter-segment-input").addEventListener("change", updateResponses);
        if (document.getElementById("sort-question-input")) document.getElementById("sort-question-input").addEventListener("input", updateResponses);
        if (document.getElementById("sort-seat-input")) document.getElementById("sort-seat-input").addEventListener("input", updateResponses);
        if (document.getElementById("course-period-input")) document.getElementById("course-period-input").addEventListener("change", updateSegments);
        if (document.getElementById("filter-segment-input")) document.getElementById("filter-segment-input").addEventListener("change", updateSegments);
        if (document.getElementById("sort-question-input")) document.getElementById("sort-question-input").addEventListener("input", updateSegments);
        if (document.getElementById("sort-seat-input")) document.getElementById("sort-seat-input").addEventListener("input", updateSegments);
        if (document.getElementById("course-period-input")) document.getElementById("course-period-input").addEventListener("change", updateQuestionReports);
        if (document.getElementById("filter-segment-input")) document.getElementById("filter-segment-input").addEventListener("change", updateQuestionReports);
        if (document.getElementById("sort-question-input")) document.getElementById("sort-question-input").addEventListener("input", updateQuestionReports);
        if (document.getElementById("sort-seat-input")) document.getElementById("sort-seat-input").addEventListener("input", updateQuestionReports);
        if (document.getElementById("filter-segment-input")) document.getElementById("filter-segment-input").addEventListener("change", updateQuestions);
        if (document.getElementById("course-period-input")) document.getElementById("course-period-input").addEventListener("input", updateCourses);
        if (document.getElementById("export-responses-course")) updateExportResponsesCourses();
        if (document.querySelector(".course-reorder .reorder") && !loadedSegmentEditor && !loadedSegmentCreator && !noReloadCourse) {
          document.querySelector(".course-reorder .reorder").innerHTML = "";
          for (let i = 1; i < 10; i++) {
            const elem = document.createElement("div");
            elem.classList = "button-grid inputs";
            elem.style = "flex-wrap: nowrap !important;";
            var periodCourse = courses.find(course => JSON.parse(course.periods).includes(i))?.id;
            var coursesSelectorString = "";
            courses.sort((a, b) => a.id - b.id).forEach(course => {
              coursesSelectorString += `<option value="${course.id}" ${(periodCourse === course.id) ? 'selected' : ''}>${course.name}</option>`;
            });
            elem.innerHTML = `<input type="text" autocomplete="off" id="period-${i}" class="small" value="Period ${i}" disabled /><select id="periodCourseSelector" value="${(periodCourse === undefined) ? '' : periodCourse}"><option value="" ${(periodCourse === undefined) ? 'selected' : ''}></option>${coursesSelectorString}</select>${rosters.find(roster => String(roster.period) === String(i)) ? '<button class="fit" style="min-width: 126px !important;" data-view-roster>View Roster</button>' : '<button class="fit" style="min-width: 126px !important;" data-upload-roster>Upload Roster</button>'}`;
            document.querySelector(".course-reorder .reorder").appendChild(elem);
          }
          document.querySelectorAll("[data-view-roster]").forEach(a => a.addEventListener("click", viewRoster));
          document.querySelectorAll("[data-upload-roster]").forEach(a => a.addEventListener("click", uploadRoster));
        }
        if (document.getElementById("course-period-input") && !loadedSegmentEditor && !loadedSegmentCreator && !noReloadCourse) updateSegments();
        if (document.getElementById("filter-segment-input")) updateCourses();
        if (document.getElementById("speed-mode-segments")) updateSpeedModeSegments();
        if (document.getElementById("add-question-input")) {
          document.getElementById("add-question-input").innerHTML = '';
          questions.sort((a, b) => a.id - b.id).forEach(question => {
            if (document.querySelector(`#question-list .question:has(input[id="${question.id}"])`)) return;
            const option = document.createElement("option");
            option.value = question.id;
            option.innerHTML = `ID ${question.id} #${question.number} - ${question.question}`;
            document.getElementById("add-question-input").appendChild(option);
          });
          if (questions.length === 0) document.getElementById("add-existing-question-button").disabled = true;
        }
        if (document.getElementById("speed-mode-starting-question")) updateSpeedModeStartingQuestion();
        if (document.querySelector('.questions.section')) updateQuestions();
        if (document.getElementById("course-period-input") && !loadedSegmentEditor && !loadedSegmentCreator && !noReloadCourse) {
          document.getElementById("course-period-input").value = ((ui.defaultCourse !== null) && courses.find(c => String(c.id) === String(ui.defaultCourse))) ? ui.defaultCourse : courses.find(c => responses.some(r => JSON.parse(c.periods).includes(Number(String(r.seatCode)[0])))) ? courses.find(c => responses.some(r => JSON.parse(c.periods).includes(Number(String(r.seatCode)[0])))).id : courses.sort((a, b) => a.id - b.id)[0]?.id;
          await updateResponses();
        }
        if (noReloadCourse) await updateResponses();
        if (document.querySelector('.segment-reports')) updateSegments();
        if (document.querySelector('.question-reports')) updateQuestionReports();
        if (window.location.pathname.split('/admin/')[1] === 'editor') loadSegmentEditor();
        active = true;
        ui.stopLoader();
        if (!polling) ui.toast("Data restored.", 1000, "info", "bi bi-cloud-arrow-down");
        if (polling && (expandedReports.length > 0)) {
          expandedReports.forEach(er => {
            if (document.getElementById(er)) document.getElementById(er).classList.add('active');
          });
        }
        if (document.getElementById("course-period-input") && !loadedSegmentEditor && !loadedSegmentCreator && !noReloadCourse) {
          document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.removeEventListener('click', removeSegment));
          document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
          if (document.getElementById("course-input")) document.getElementById("course-input").value = courses.find(c => String(c.id) === document.getElementById("course-period-input").value).name;
          updateSegments();
        }
        if (document.getElementById("sort-segments-types")) document.getElementById("sort-segments-types").value = await getSettings('sort-segments');
        ui.reloadUnsavedInputs();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  init();

  window.addEventListener('beforeunload', function (event) {
    if (!ui.unsavedChanges) return;
    const confirmationMessage = 'You have unsaved changes. Do you really want to leave?';
    event.returnValue = confirmationMessage;
    return confirmationMessage;
  });

  function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  if (document.getElementById("course-period-input")) document.getElementById("course-period-input").addEventListener("change", updateSegments);
  if (document.querySelector('[data-select-multiple]')) document.querySelector('[data-select-multiple]').addEventListener("click", toggleSelecting);
  if (document.querySelector('[data-delete-multiple]')) document.querySelector('[data-delete-multiple]').addEventListener("click", deleteMultiple);
  if (document.querySelector('[data-polling]')) document.querySelector('[data-polling]').addEventListener("click", togglePolling);
  if (document.querySelector('[data-timestamps]')) document.querySelector('[data-timestamps]').addEventListener("click", toggleTimestamps);
  if (document.querySelector('[data-speed]')) document.querySelector('[data-speed]').addEventListener("click", toggleSpeedMode);
  if (document.getElementById('enable-speed-mode-button')) document.getElementById('enable-speed-mode-button').addEventListener("click", enableSpeedMode);
  if (document.getElementById('sort-segments-due')) document.getElementById('sort-segments-due').addEventListener("click", sortSegmentsDue);
  if (document.getElementById('sort-segments-increasing')) document.getElementById('sort-segments-increasing').addEventListener("click", sortSegmentsIncreasing);
  if (document.getElementById('sort-segments-decreasing')) document.getElementById('sort-segments-decreasing').addEventListener("click", sortSegmentsDecreasing);
  if (document.getElementById('sort-segments-button')) document.getElementById('sort-segments-button').addEventListener("click", sortSegments);
  if (document.getElementById('hideIncorrectAttempts')) document.getElementById('hideIncorrectAttempts').addEventListener("change", updateSegments);
  if (document.getElementById('hideIncorrectAttempts')) document.getElementById('hideIncorrectAttempts').addEventListener("change", updateResponses);
  if (document.getElementById('hideIncorrectAttempts')) document.getElementById('hideIncorrectAttempts').addEventListener("change", updateQuestionReports);
  if (document.querySelector('[data-expand-reports]')) document.querySelector('[data-expand-reports]').addEventListener("click", toggleAllReports);
  if (document.getElementById('launch-speed-mode')) document.getElementById('launch-speed-mode').addEventListener("click", toggleSpeedMode);
  if (document.getElementById('add-existing-question-button')) document.getElementById('add-existing-question-button').addEventListener("click", addExistingQuestion);
  if (document.querySelector('[data-syllabus-upload]')) document.querySelector('[data-syllabus-upload]').addEventListener("click", renderSyllabusPond);
  if (document.getElementById('new-course-button')) document.getElementById('new-course-button').addEventListener("click", newCourseModal);
  if (document.getElementById('remove-segments-due-dates-button')) document.getElementById('remove-segments-due-dates-button').addEventListener("click", removeAllSegmentsDueDates);
  if (document.querySelector('[data-clear-responses]')) document.querySelector('[data-clear-responses]').addEventListener("click", clearResponsesConfirm1);
  if (document.getElementById('export-report')) document.getElementById('export-report').addEventListener("click", exportReport);
  if (document.querySelector('[data-archive-course]')) document.querySelector('[data-archive-course]').addEventListener("click", () => archiveModal('course'));
  if (document.querySelector('[data-archive-segment]')) document.querySelector('[data-archive-segment]').addEventListener("click", () => archiveModal('segment'));
  if (document.querySelector('[data-archive-multiple]')) document.querySelector('[data-archive-multiple]').addEventListener("click", archiveMultipleModal);
  if (document.querySelector('[data-unarchive-multiple]')) document.querySelector('[data-unarchive-multiple]').addEventListener("click", unarchiveMultipleModal);
  if (document.getElementById('filter-report-responses')) document.getElementById('filter-report-responses').addEventListener("input", updateSegments);
  if (document.getElementById('filter-report-responses')) document.getElementById('filter-report-responses').addEventListener("input", updateResponses);
  if (document.getElementById('filter-report-responses')) document.getElementById('filter-report-responses').addEventListener("input", updateQuestionReports);
  if (document.getElementById('useRoster')) document.getElementById('useRoster').addEventListener("change", updateSegments);
  if (document.getElementById('useRoster')) document.getElementById('useRoster').addEventListener("change", updateResponses);
  if (document.getElementById('useRoster')) document.getElementById('useRoster').addEventListener("change", updateQuestionReports);
  if (document.getElementById('sort-report-responses')) document.getElementById('sort-report-responses').addEventListener("input", updateSegments);
  if (document.getElementById('sort-report-responses')) document.getElementById('sort-report-responses').addEventListener("input", updateResponses);
  if (document.getElementById('sort-report-responses')) document.getElementById('sort-report-responses').addEventListener("input", updateQuestionReports);
  if (document.getElementById('hideUnanswered')) document.getElementById('hideUnanswered').addEventListener("input", updateSegments);
  if (document.getElementById('hideUnanswered')) document.getElementById('hideUnanswered').addEventListener("input", updateResponses);
  if (document.getElementById('hideUnanswered')) document.getElementById('hideUnanswered').addEventListener("input", updateQuestionReports);
  if (document.querySelector('[data-select-between]')) document.querySelector('[data-select-between]').addEventListener("click", selectBetween);
  if (document.getElementById('rotate-period')) document.getElementById('rotate-period').addEventListener("click", rotatePeriodConfirm);
  if (document.getElementById('export-responses')) document.getElementById('export-responses').addEventListener("click", exportResponses);
  if (document.querySelector('[data-clicker-announcement-image-upload]')) document.querySelector('[data-clicker-announcement-image-upload]').addEventListener("click", () => renderAnnouncementPond('clicker'));
  if (document.querySelector('[data-checker-announcement-image-upload]')) document.querySelector('[data-checker-announcement-image-upload]').addEventListener("click", () => renderAnnouncementPond('checker'));
  if (document.querySelector('[data-clicker-announcement-clear]')) document.querySelector('[data-clicker-announcement-clear]').addEventListener("click", () => clearAnnouncement('clicker'));
  if (document.querySelector('[data-checker-announcement-clear]')) document.querySelector('[data-checker-announcement-clear]').addEventListener("click", () => clearAnnouncement('checker'));
  document.querySelectorAll('#previous-page-button').forEach(a => a.addEventListener("click", () => previousPage(a)));
  document.querySelectorAll('#next-page-button').forEach(a => a.addEventListener("click", () => nextPage(a)));

  function toggleSelecting() {
    if (!active) return;
    if (document.querySelector('.segments .section')) document.querySelector('.segments .section').classList.toggle('selecting');
    if (document.querySelector('.questions .section')) document.querySelector('.questions .section').classList.toggle('selecting');
    if (document.querySelector('.responses .section')) document.querySelector('.responses .section').classList.toggle('selecting');
    if (document.querySelector('.awaitingResponses .section')) document.querySelector('.awaitingResponses .section').classList.toggle('selecting');
    if (document.querySelector('.trendingResponses .section')) document.querySelector('.trendingResponses .section').classList.toggle('selecting');
    document.querySelectorAll('.archives .section').forEach(a => a.classList.toggle('selecting'));
  }

  function removeSelecting() {
    if (!active) return;
    if (document.querySelector('.segments .section')) document.querySelector('.segments .section').classList.remove('selecting');
    if (document.querySelector('.questions .section')) document.querySelector('.questions .section').classList.remove('selecting');
    if (document.querySelector('.responses .section')) document.querySelector('.responses .section').classList.remove('selecting');
    if (document.querySelector('.awaitingResponses .section')) document.querySelector('.awaitingResponses .section').classList.remove('selecting');
    if (document.querySelector('.trendingResponses .section')) document.querySelector('.trendingResponses .section').classList.remove('selecting');
    document.querySelectorAll('.archives .section').forEach(a => a.classList.toggle('selecting'));
  }

  function deleteMultiple() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    document.querySelectorAll('.selected').forEach(e => e.remove());
  }

  function toggleSelected() {
    if (!active) return;
    if (this.parentElement.parentElement.classList.contains('selecting')) {
      this.parentElement.classList.toggle('selected');
    } else {
      this.parentElement.parentElement.classList.toggle('selected');
    }
  }

  function removeAllSelected() {
    if (!active) return;
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('.selected'));
  }

  function togglePolling() {
    if (!active) return;
    if (polling) {
      polling = false;
      document.querySelector('[data-polling] .bi-skip-forward-circle').style.display = "block";
      document.querySelector('[data-polling] .bi-stop-circle-fill').style.display = "none";
    } else {
      polling = true;
      document.querySelector('[data-polling] .bi-skip-forward-circle').style.display = "none";
      document.querySelector('[data-polling] .bi-stop-circle-fill').style.display = "block";
      let pollingInterval = setInterval(() => {
        if (!polling) {
          clearInterval(pollingInterval);
        } else {
          init();
        }
      }, 5000);
    }
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

  function updateCourses() {
    if (document.getElementById("filter-segment-input")) {
      document.getElementById("filter-segment-input").innerHTML = '<option value="" selected>#</option>';
      var filteredSegments = segments;
      const course = courses.find(c => document.getElementById("course-period-input") ? (String(c.id) === document.getElementById("course-period-input").value) : null);
      if (course) filteredSegments = filteredSegments.filter(segment => String(segment.course) === String(course.id));
      filteredSegments.forEach(segment => {
        document.getElementById("filter-segment-input").innerHTML += `<option value="${segment.id}" ${(document.location.search.split('?segment=')[1] && (document.location.search.split('?segment=')[1] === String(segment.id))) ? 'selected' : ''}>${segment.number} - ${segment.name}${segment.due ? ` (Due ${new Date(`${segment.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })})` : ''}</option>`;
      });
    }
    const coursesArchiveTab = document.querySelector('[data-archive-type="courses"]');
    if (coursesArchiveTab) {
      const coursesArchives = coursesArchiveTab.querySelector('.archives');
      const coursesArchivesList = coursesArchives.querySelector('.section');
      if (courses.length > 0) {
        coursesArchiveTab.querySelector('#no-archive').setAttribute('hidden', '');
        coursesArchives.removeAttribute('hidden');
      } else {
        coursesArchiveTab.querySelector('#no-archive').removeAttribute('hidden');
        coursesArchives.setAttribute('hidden', '');
      }
      coursesArchivesList.innerHTML = '';
      courses.sort((a, b) => a.id - b.id).forEach(course => {
        var buttonGrid = document.createElement('div');
        buttonGrid.className = "button-grid inputs";
        buttonGrid.setAttribute('archive-type', 'course');
        buttonGrid.id = course.id;
        buttonGrid.innerHTML = `<button square data-select tooltip="Select Item"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button>
        <div class="input-group rsmall">
          <div class="space" id="question-container">
            <input type="text" id="course-id-input" value="${course.id}" disabled />
          </div>
        </div>
        <div class="input-group">
          <div class="space" id="question-container">
            <input type="text" id="course-name-input" value="${course.name}" disabled />
          </div>
        </div>
        <div class="input-group small">
          <div class="space" id="question-container">
            <input type="text" id="course-periods-input" value="${JSON.parse(course.periods).join(', ')}" disabled />
          </div>
        </div>
        <div class="input-group">
          <div class="space" id="question-container">
            <input type="text" id="course-syllabus-input" value="${course.syllabus || ''}" disabled />
          </div>
        </div>
        <button square data-restore-item tooltip="Restore Item"><i class="bi bi-arrow-counterclockwise"></i></button>`;
        coursesArchivesList.appendChild(buttonGrid);
      });
      coursesArchivesList.querySelectorAll('[data-restore-item]').forEach(item => item.addEventListener('click', unarchiveModal));
    }
  }

  function updateSegments() {
    expandedReports = [];
    document.querySelectorAll('.detailed-report.active').forEach(dr => expandedReports.push(dr.id));
    const course = courses.find(c => document.getElementById("course-period-input") ? (String(c.id) === document.getElementById("course-period-input").value) : null);
    if (document.getElementById("course-input") && course) document.getElementById("course-input").value = course.name;
    document.querySelector('[data-clicker-announcement-image-upload]')?.setAttribute('hidden', '');
    document.querySelector('[data-clicker-announcement-image-remove]')?.setAttribute('hidden', '');
    if (document.getElementById('clicker-announcement-title')) document.getElementById('clicker-announcement-title').value = "";
    if (document.getElementById('clicker-announcement-content')) document.getElementById('clicker-announcement-content').value = "";
    if (document.getElementById('clicker-announcement-link')) document.getElementById('clicker-announcement-link').value = "";
    if (document.getElementById('clicker-announcement-layout')) document.getElementById('clicker-announcement-layout').value = "";
    if (document.getElementById('clicker-announcement-expires')) document.getElementById('clicker-announcement-expires').value = "";
    document.querySelector('[data-checker-announcement-image-upload]')?.setAttribute('hidden', '');
    document.querySelector('[data-checker-announcement-image-remove]')?.setAttribute('hidden', '');
    if (document.getElementById('checker-announcement-title')) document.getElementById('checker-announcement-title').value = "";
    if (document.getElementById('checker-announcement-content')) document.getElementById('checker-announcement-content').value = "";
    if (document.getElementById('checker-announcement-link')) document.getElementById('checker-announcement-link').value = "";
    if (document.getElementById('checker-announcement-layout')) document.getElementById('checker-announcement-layout').value = "";
    if (document.getElementById('checker-announcement-expires')) document.getElementById('checker-announcement-expires').value = "";
    if (course) {
      var clicker_announcement = course.clicker_announcement ? JSON.parse(course.clicker_announcement) : {};
      var checker_announcement = course.checker_announcement ? JSON.parse(course.checker_announcement) : {};
      if (clicker_announcement.image) {
        document.querySelector('[data-clicker-announcement-image-remove]')?.removeAttribute('hidden');
        document.querySelector('[data-clicker-announcement-image-remove]')?.addEventListener("click", async () => {
          ui.setUnsavedChanges(true);
          await save(null, true);
          fetch(domain + '/announcement', {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              course_id: course.id,
              platform: 'clicker',
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
              ui.setUnsavedChanges(false);
              init();
            })
            .catch((e) => {
              console.error(e);
              ui.view("api-fail");
              if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
              pollingOff();
            });
        });
      } else {
        document.querySelector('[data-clicker-announcement-image-upload]')?.removeAttribute('hidden');
      }
      if (clicker_announcement.title && document.getElementById('clicker-announcement-title')) document.getElementById('clicker-announcement-title').value = clicker_announcement.title;
      if (clicker_announcement.content && document.getElementById('clicker-announcement-content')) document.getElementById('clicker-announcement-content').value = clicker_announcement.content;
      if (clicker_announcement.linkTitle && document.getElementById('clicker-announcement-link-title')) document.getElementById('clicker-announcement-link-title').value = clicker_announcement.linkTitle;
      if (clicker_announcement.link && document.getElementById('clicker-announcement-link')) document.getElementById('clicker-announcement-link').value = clicker_announcement.link;
      if (clicker_announcement.layout && document.getElementById('clicker-announcement-layout')) document.getElementById('clicker-announcement-layout').value = clicker_announcement.layout;
      if (clicker_announcement.expires && document.getElementById('clicker-announcement-expires')) document.getElementById('clicker-announcement-expires').value = clicker_announcement.expires;
      if (checker_announcement.image) {
        document.querySelector('[data-checker-announcement-image-remove]')?.removeAttribute('hidden');
        document.querySelector('[data-checker-announcement-image-remove]')?.addEventListener("click", async () => {
          ui.setUnsavedChanges(true);
          await save(null, true);
          fetch(domain + '/announcement', {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              course_id: course.id,
              platform: 'checker',
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
              ui.setUnsavedChanges(false);
              init();
            })
            .catch((e) => {
              console.error(e);
              ui.view("api-fail");
              if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
              pollingOff();
            });
        });
      } else {
        document.querySelector('[data-checker-announcement-image-upload]')?.removeAttribute('hidden');
      }
      if (checker_announcement.title && document.getElementById('checker-announcement-title')) document.getElementById('checker-announcement-title').value = checker_announcement.title;
      if (checker_announcement.content && document.getElementById('checker-announcement-content')) document.getElementById('checker-announcement-content').value = checker_announcement.content;
      if (checker_announcement.linkTitle && document.getElementById('checker-announcement-link-title')) document.getElementById('checker-announcement-link-title').value = checker_announcement.linkTitle;
      if (checker_announcement.link && document.getElementById('checker-announcement-link')) document.getElementById('checker-announcement-link').value = checker_announcement.link;
      if (checker_announcement.layout && document.getElementById('checker-announcement-layout')) document.getElementById('checker-announcement-layout').value = checker_announcement.layout;
      if (checker_announcement.expires && document.getElementById('checker-announcement-expires')) document.getElementById('checker-announcement-expires').value = checker_announcement.expires;
    }
    var c = segments.filter(s => String(s.course) === String(course?.id));
    if (!course && document.querySelector('[data-syllabus-upload]')) document.querySelector('[data-syllabus-upload]').setAttribute('hidden', '');
    if (course && course.syllabus) {
      if (document.querySelector('[data-syllabus-upload]')) document.querySelector('[data-syllabus-upload]').setAttribute('hidden', '');
      if (document.querySelector('[data-syllabus-remove]')) document.querySelector('[data-syllabus-remove]').parentElement.removeAttribute('hidden');
      if (document.querySelector('[data-syllabus-download]')) document.querySelector('[data-syllabus-download]').addEventListener("click", () => {
        window.open(course.syllabus, '_blank');
      });
      if (document.querySelector('[data-syllabus-remove]')) document.querySelector('[data-syllabus-remove]').addEventListener("click", () => {
        ui.setUnsavedChanges(true);
        fetch(domain + '/syllabus', {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course_id: course.id
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
            ui.setUnsavedChanges(false);
            init();
          })
          .catch((e) => {
            console.error(e);
            ui.view("api-fail");
            if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
            pollingOff();
          });
      });
    } else {
      if (document.querySelector('[data-syllabus-remove]')) document.querySelector('[data-syllabus-remove]').parentElement.setAttribute('hidden', '');
      if (document.querySelector('[data-syllabus-upload]')) document.querySelector('[data-syllabus-upload]').removeAttribute('hidden');
    }
    if (document.querySelector('.segment-reports')) document.querySelector('.segment-reports').innerHTML = '';
    if (c.length > 0) {
      if (document.querySelector('.segments .section')) {
        document.querySelector('.segments .section').innerHTML = '';
        c.sort((a, b) => a.order - b.order).forEach(s => {
          if (document.querySelector('.segments .section')) {
            var segment = document.createElement('div');
            segment.className = "section";
            segment.id = `segment-${s.id}`;
            segment.setAttribute("data-swapy-slot", `segmentReorder-${s.id}`);
            var buttonGrid = document.createElement('div');
            buttonGrid.className = "button-grid inputs";
            buttonGrid.setAttribute("data-swapy-item", `segmentReorder-${s.id}`);
            buttonGrid.innerHTML = `<button square data-select tooltip="Select Segment"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="${s.number}" placeholder="${s.number}" /></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="${s.name}" placeholder="${s.name}" /></div></div><div class="input-group mediuml"><div class="space" id="question-container"><input type="date" id="segment-due-date" value="${s.due || ''}"></div></div><button square data-remove-segment-input tooltip="Remove Segment"><i class="bi bi-trash"></i></button><button square data-archive-segment tooltip="Archive Segment"><i class="bi bi-archive"></i></button><button square data-edit-segment tooltip="Edit Segment"><i class="bi bi-pencil"></i></button><div class="drag" data-swapy-handle><i class="bi bi-grip-vertical"></i></div>`;
            if (window.innerWidth >= 1400) {
              buttonGrid.addEventListener('mouseenter', () => {
                island(buttonGrid, c.sort((a, b) => a.order - b.order), 'segment', {
                  sourceId: String(s.id),
                  id: `# ${s.number}`,
                  title: `${s.name}`,
                  subtitle: s.due ? `Due ${new Date(`${s.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}` : '',
                  lists: [
                    {
                      title: 'Questions',
                      items: JSON.parse(s.question_ids)
                    },
                  ],
                });
              });
              buttonGrid.addEventListener('mouseleave', () => {
                island();
              });
            }
            segment.appendChild(buttonGrid);
            document.querySelector('.segments .section').appendChild(segment);
          }
        });
        var addSegmentButton = document.createElement('button');
        addSegmentButton.setAttribute('data-add-segment-input', '');
        addSegmentButton.innerText = 'Add Segment';
        document.querySelector('.segments .section').appendChild(addSegmentButton);
        if (draggableSegmentReorder) draggableSegmentReorder.destroy();
        draggableSegmentReorder = createSwapy(document.querySelector(".segments .section"), {
          animation: 'none'
        });
      }
      if (document.querySelector('.segment-reports')) {
        c.filter(s => document.getElementById("filter-segment-input")?.value ? (String(s.id) === document.getElementById("filter-segment-input").value) : true).sort((a, b) => a.order - b.order).forEach(segment => {
          document.querySelector('.section:has(> .segment-reports)').setAttribute('hidden', '');
          if (document.getElementById("filter-segment-input").value) {
            document.querySelector('.segment-reports').innerHTML = '';
          } else {
            document.querySelector('.section:has(> .segment-reports)').removeAttribute('hidden');
            var segmentResponses = [];
            var detailedReport = '';
            JSON.parse(segment.question_ids).filter(q => questions.find(q1 => String(q1.id) === String(q.id))?.number.startsWith(document.getElementById("sort-question-input")?.value)).forEach(q => {
              var question = questions.find(q1 => String(q1.id) === String(q.id));
              if (!question) return;
              var questionResponses = responses.filter(seatCode => JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input").value).periods).includes(Number(String(seatCode.seatCode)[0]))).filter(r => String(r.segment) === String(segment.id)).filter(r => r.question_id === question.id).filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value));
              if (document.getElementById('hideIncorrectAttempts').checked) questionResponses = questionResponses.filter((r, index, self) => r.status === 'Correct' || !self.some(other => other.question_id === r.question_id && other.status === 'Correct'));
              if (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') === 'first') {
                questionResponses = questionResponses.filter(r => r.id === Math.min(...questionResponses.filter(r1 => r1.seatCode === r.seatCode && r1.question_id === r.question_id).map(r1 => r1.id)));
              } else if (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') === 'last') {
                questionResponses = questionResponses.filter(r => r.id === Math.max(...questionResponses.filter(r1 => r1.seatCode === r.seatCode && r1.question_id === r.question_id).map(r1 => r1.id)));
              }
              var detailedReport1 = '';
              switch (document.querySelector('#sort-report-responses [aria-selected="true"]').getAttribute('data-value')) {
                case 'seatCode':
                  questionResponses = questionResponses.sort((a, b) => a.seatCode - b.seatCode);
                  break;
                case 'studentName':
                  questionResponses = questionResponses.sort((a, b) => {
                    var nameA = "Unknown";
                    var nameB = "Unknown";
                    if (document.getElementById('useRoster').checked) {
                      var roster = rosters.find(roster => roster.period === Number(String(a.seatCode)[0]));
                      if (roster) {
                        var studentA = JSON.parse(roster.data).find(student => String(student.seatCode) === String(a.seatCode));
                        if (studentA) nameA = `${studentA.last}, ${studentA.first}`;
                        var studentB = JSON.parse(roster.data).find(student => String(student.seatCode) === String(b.seatCode));
                        if (studentB) nameB = `${studentB.last}, ${studentB.first}`;
                      }
                    }
                    return nameA.localeCompare(nameB);
                  });
                  break;
              }
              questionResponses.forEach(r => {
                var name = "Unknown";
                if (document.getElementById('useRoster').checked) {
                  var roster = rosters.find(roster => roster.period === Number(String(r.seatCode)[0]));
                  if (roster) {
                    var student = JSON.parse(roster.data).find(student => String(student.seatCode) === String(r.seatCode));
                    if (student) name = `${student.last}, ${student.first}`;
                  }
                }
                const currentDate = new Date(r.timestamp);
                var timeTaken = "N/A";
                const sameSeatCodeResponses = responses
                  .filter(r => courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value)?.periods).includes(Number(String(r.seatCode)[0])) : false)
                  .filter(r => document.getElementById("filter-segment-input")?.value ? (String(segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')) === document.getElementById("filter-segment-input").value) : true)
                  .filter(r => questions.find(q => String(q.id) === String(r.question_id))?.number.startsWith(document.getElementById("sort-question-input")?.value))
                  .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
                  .sort((a, b) => {
                    if (a.flagged && !b.flagged) return -1;
                    if (!a.flagged && b.flagged) return 1;
                    return b.id - a.id;
                  })
                  .filter(a => a.seatCode === r.seatCode)
                  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                const lastResponseIndex = sameSeatCodeResponses.findIndex(a => new Date(a.timestamp) >= currentDate) - 1;
                const lastResponse = lastResponseIndex >= 0 ? sameSeatCodeResponses[lastResponseIndex] : null;
                let timeDifference;
                if (lastResponse) {
                  timeDifference = calculateTimeDifference(currentDate, lastResponse.timestamp);
                  timeTaken = formatTimeDifference(timeDifference);
                }
                detailedReport1 += `<div class="detailed-report-question">
                  <div class="color">
                    <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
                    <span class="color-name">${document.getElementById('useRoster').checked ? `${name} (${r.seatCode})` : r.seatCode}<p class="showonhover"> (${time.unixToString(r.timestamp)})</p>: ${escapeHTML(r.response)}</span>
                  </div>
                  <div class="color">
                    <span class="color-name">${timeTaken}</span>
                    <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
                  </div>
                </div>`;
                segmentResponses.push(r);
              });
              var total = questionResponses.length || 1;
              var unansweredStudentsCount = 0;
              if (document.getElementById('useRoster').checked && (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') !== 'all') && !document.getElementById('hideUnanswered').checked) {
                var courseRosters = rosters.filter(roster => JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input").value)?.periods).includes(Number(String(roster.period))));
                var totalRosterStudents = [...new Set(courseRosters.flatMap(a => JSON.parse(a.data).map(b => Number(b.seatCode))))];
                if (totalRosterStudents.length) {
                  var answeredStudentsCount = [...new Set(questionResponses.flatMap(a => a.seatCode).filter(x => totalRosterStudents.includes(x)))].length;
                  unansweredStudentsCount = totalRosterStudents.length - answeredStudentsCount;
                  total = questionResponses.length + unansweredStudentsCount;
                }
              }
              detailedReport += `<div class="detailed-report-question"${(questionResponses.length != 0) ? ` report="segment-question-${q.id}"` : ''}>
                <b>Question ${question.number} (${questionResponses.length} Response${(questionResponses.length != 1) ? 's' : ''})</b>
                <div class="barcount-wrapper">
                  ${(questionResponses.filter(r => r.status === 'Correct').length != 0) ? `<div class="barcount correct" style="width: calc(${questionResponses.filter(r => r.status === 'Correct').length / total} * 100%)">${questionResponses.filter(r => r.status === 'Correct').length}</div>` : ''}
                  ${((questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount) != 0) ? `<div class="barcount other" style="width: calc(${(questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount) / total} * 100%)">${questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount}</div>` : ''}
                  ${(questionResponses.filter(r => r.status.includes('Recorded')).length != 0) ? `<div class="barcount waiting" style="width: calc(${questionResponses.filter(r => r.status.includes('Recorded')).length / total} * 100%)">${questionResponses.filter(r => r.status.includes('Recorded')).length}</div>` : ''}
                  ${(questionResponses.filter(r => r.status === 'Incorrect').length != 0) ? `<div class="barcount incorrect" style="width: calc(${questionResponses.filter(r => r.status === 'Incorrect').length / total} * 100%)">${questionResponses.filter(r => r.status === 'Incorrect').length}</div>` : ''}
                </div>
              </div>
              ${(questionResponses.length != 0) ? `<div class="section detailed-report" id="segment-question-${q.id}">
                ${detailedReport1}
              </div>` : ''}`;
            });
            var total = segmentResponses.length || 1;
            var unansweredStudentsCount = 0;
            if (document.getElementById('useRoster').checked && (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') !== 'all') && !document.getElementById('hideUnanswered').checked) {
              var courseRosters = rosters.filter(roster => JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input").value)?.periods).includes(Number(String(roster.period))));
              var totalRosterStudents = [...new Set(courseRosters.flatMap(a => JSON.parse(a.data).map(b => Number(b.seatCode))))];
              if (totalRosterStudents.length) {
                var answeredStudentsCount = [...new Set(segmentResponses.flatMap(a => a.seatCode).filter(x => totalRosterStudents.includes(x)))].length;
                unansweredStudentsCount = totalRosterStudents.length - answeredStudentsCount;
                total = segmentResponses.length + unansweredStudentsCount;
              }
            }
            document.querySelector('.segment-reports').innerHTML += `<div class="segment-report"${(JSON.parse(segment.question_ids) != 0) ? ` report="segment-${segment.id}"` : ''}>
              <b>Segment ${segment.number} (${JSON.parse(segment.question_ids).length} Question${JSON.parse(segment.question_ids).length != 1 ? 's' : ''})</b>
              <div class="barcount-wrapper">
                ${(segmentResponses.filter(r => r.status === 'Correct').length != 0) ? `<div class="barcount correct" style="width: calc(${segmentResponses.filter(r => r.status === 'Correct').length / total} * 100%)">${segmentResponses.filter(r => r.status === 'Correct').length}</div>` : ''}
                ${((segmentResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount) != 0) ? `<div class="barcount other" style="width: calc(${(segmentResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount) / total} * 100%)">${segmentResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount}</div>` : ''}
                ${(segmentResponses.filter(r => r.status.includes('Recorded')).length != 0) ? `<div class="barcount waiting" style="width: calc(${segmentResponses.filter(r => r.status.includes('Recorded')).length / total} * 100%)">${segmentResponses.filter(r => r.status.includes('Recorded')).length}</div>` : ''}
                ${(segmentResponses.filter(r => r.status === 'Incorrect').length != 0) ? `<div class="barcount incorrect" style="width: calc(${segmentResponses.filter(r => r.status === 'Incorrect').length / total} * 100%)">${segmentResponses.filter(r => r.status === 'Incorrect').length}</div>` : ''}
              </div>
            </div>
            ${(JSON.parse(segment.question_ids).length != 0) ? `<div class="section detailed-report" id="segment-${segment.id}">
              ${detailedReport}
            </div>` : ''}`;
          }
        });
      }
    } else {
      if (document.querySelector('.segments .section')) document.querySelector('.segments .section').innerHTML = '<button data-add-segment-input>Add Segment</button>';
    }
    const segmentsArchiveTab = document.querySelector('[data-archive-type="segments"]');
    if (segmentsArchiveTab) {
      const segmentsArchives = segmentsArchiveTab.querySelector('.archives');
      const segmentsArchivesList = segmentsArchives.querySelector('.section');
      if (segments.length > 0) {
        segmentsArchiveTab.querySelector('#no-archive').setAttribute('hidden', '');
        segmentsArchives.removeAttribute('hidden');
      } else {
        segmentsArchiveTab.querySelector('#no-archive').removeAttribute('hidden');
        segmentsArchives.setAttribute('hidden', '');
      }
      segmentsArchivesList.innerHTML = '';
      segments.sort((a, b) => a.order - b.order).forEach(segment => {
        var buttonGrid = document.createElement('div');
        buttonGrid.className = "button-grid inputs";
        buttonGrid.setAttribute('archive-type', 'segment');
        buttonGrid.id = segment.id;
        buttonGrid.innerHTML = `<button square data-select tooltip="Select Item"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button>
        <div class="input-group small">
          <div class="space" id="question-container">
            <input type="text" id="segment-number-input" value="${segment.number}" disabled />
          </div>
        </div>
        <div class="input-group">
          <div class="space" id="question-container">
            <input type="text" id="segment-name-input" value="${segment.name || ''}" disabled />
          </div>
        </div>
        <div class="input-group">
          <div class="space" id="question-container">
            <input type="text" id="segment-question-ids-input" value="${JSON.parse(segment.question_ids).map(q => q.id).join(', ')}" disabled />
          </div>
        </div>
        <div class="input-group small">
          <div class="space" id="question-container">
            <input type="text" id="segment-course-input" value="${segment.course || ''}" disabled />
          </div>
        </div>
        <div class="input-group smedium">
          <div class="space" id="question-container">
            <input type="text" id="segment-due-date-input" value="${segment.due || ''}" disabled />
          </div>
        </div>
        <button square data-restore-item tooltip="Restore Item"><i class="bi bi-arrow-counterclockwise"></i></button>`;
        if (window.innerWidth >= 1400) {
          buttonGrid.addEventListener('mouseenter', () => {
            island(buttonGrid, segments.sort((a, b) => a.order - b.order), 'segment', {
              sourceId: String(segment.id),
              id: `# ${segment.number}`,
              title: `${segment.name}`,
              subtitle: segment.due ? `Due ${new Date(`${segment.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}` : '',
              lists: [
                {
                  title: 'Questions',
                  items: JSON.parse(segment.question_ids)
                },
              ],
            });
          });
          buttonGrid.addEventListener('mouseleave', () => {
            island();
          });
        }
        segmentsArchivesList.appendChild(buttonGrid);
      });
      segmentsArchivesList.querySelectorAll('[data-restore-item]').forEach(item => item.addEventListener('click', unarchiveModal));
    }
    expandedReports.forEach(er => {
      if (document.getElementById(er)) document.getElementById(er).classList.add('active');
    });
    document.querySelectorAll('[data-add-segment-input]').forEach(a => a.addEventListener('click', addSegment));
    document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
    document.querySelectorAll('[data-add-segment-question-input]').forEach(a => a.addEventListener('click', addSegmentQuestion));
    document.querySelectorAll('[data-remove-segment-question-input]').forEach(a => a.addEventListener('click', removeSegmentQuestion));
    // document.querySelectorAll('[data-toggle-segment]').forEach(a => a.addEventListener('click', toggleSegment));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
    // document.querySelectorAll('[sort-segment-questions-increasing]').forEach(a => a.addEventListener('click', sortSegmentQuestionsIncreasing));
    // document.querySelectorAll('[sort-segment-questions-decreasing]').forEach(a => a.addEventListener('click', sortSegmentQuestionsDecreasing));
    document.querySelectorAll('[report]').forEach(a => a.addEventListener('click', toggleDetailedReport));
    document.querySelectorAll('[data-edit-segment]').forEach(a => a.addEventListener('click', editSegment));
    document.querySelectorAll('[data-archive-segment]').forEach(a => a.addEventListener('click', () => {
      if (a.parentElement.parentElement.id) archiveModal('segment', a.parentElement.parentElement.id.split('segment-')[1]);
    }));
    if (!loadedSegmentEditor && !loadedSegmentCreator) ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  // function toggleSegment() {
  //   if (!active) return;
  //   this.parentElement.parentElement.classList.toggle('expanded');
  // }

  function editSegment(event, segment) {
    if (!active) return;
    if (!segment && this && this.parentElement && this.parentElement.parentElement && this.parentElement.parentElement.id) segment = this.parentElement.parentElement.id.split('segment-')[1];
    return window.location.href = segment ? `/admin/editor?segment=${segment}` : '/admin/';
  }

  // Save Course Order
  document.getElementById("save-course-order-button")?.addEventListener("click", () => {
    if (!active) return;
    var updatedCourses = [];
    courses.forEach(course => {
      var coursePeriods = [...document.querySelector(".reorder").children].filter(period => period.querySelector('select').value === String(course.id)).map((c) => { return Number(c.querySelector('input').id.split('period-')[1]) });
      updatedCourses.push({
        id: course.id,
        name: course.name,
        periods: JSON.stringify(coursePeriods)
      })
    });
    ui.setUnsavedChanges(true);
    fetch(domain + '/courses', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        courses: updatedCourses.sort((a, b) => a.id - b.id),
      })
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
      .then(c => {
        ui.setUnsavedChanges(false);
        courses = c;
        if (document.querySelector(".course-reorder .reorder")) {
          document.querySelector(".course-reorder .reorder").innerHTML = "";
          for (let i = 1; i < 10; i++) {
            const elem = document.createElement("div");
            elem.classList = "button-grid inputs";
            elem.style = "flex-wrap: nowrap !important;";
            var periodCourse = c.find(course => JSON.parse(course.periods).includes(i))?.id;
            var coursesSelectorString = "";
            c.sort((a, b) => a.id - b.id).forEach(course => {
              coursesSelectorString += `<option value="${course.id}" ${(periodCourse === course.id) ? 'selected' : ''}>${course.name}</option>`;
            });
            elem.innerHTML = `<input type="text" autocomplete="off" id="period-${i}" class="small" value="Period ${i}" disabled /><select id="periodCourseSelector" value="${(periodCourse === undefined) ? '' : periodCourse}"><option value="" ${(periodCourse === undefined) ? 'selected' : ''}></option>${coursesSelectorString}</select>${rosters.find(r => String(r.period) === String(i)) ? '<button class="fit" style="min-width: 126px !important;" data-view-roster>View Roster</button>' : '<button class="fit" style="min-width: 126px !important;" data-upload-roster>Upload Roster</button>'}`;
            document.querySelector(".course-reorder .reorder").appendChild(elem);
          }
          document.querySelectorAll("[data-view-roster]").forEach(a => a.addEventListener("click", viewRoster));
          document.querySelectorAll("[data-upload-roster]").forEach(a => a.addEventListener("click", uploadRoster));
        }
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
    // Show submit confirmation
    ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
    ui.reloadUnsavedInputs();
  });

  // Save Segment Order
  // document.getElementById("save-segment-order-button")?.addEventListener("click", () => {
  //   if (!active) return;
  //   var updatedSegments = [...document.querySelector(".segment-reorder .reorder").children].map((segment, i) => {
  //     const segmentNumber = segment.querySelector('input').id.split('-')[1];
  //     return {
  //       order: i,
  //       number: segmentNumber,
  //       name: segment.querySelector('input').value,
  //       question_ids: segments.find(s => String(s.number) === String(segmentNumber)).question_ids,
  //       course: Number(document.getElementById("course-period-input").value),
  //       due: segments.find(s => String(s.number) === String(segmentNumber)).due
  //     };
  //   }).sort((a, b) => a.order - b.order);
  //   ui.setUnsavedChanges(true);
  //   fetch(domain + '/segments', {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(updatedSegments)
  //   })
  //     .then(async (r) => {
  //       if (!r.ok) {
  //         try {
  //           var re = await r.json();
  //           if (re.error || re.message) {
  //             ui.toast(re.error || re.message, 5000, "error", "bi bi-exclamation-triangle-fill");
  //             throw new Error(re.error || re.message);
  //           } else {
  //             throw new Error("API error");
  //           }
  //         } catch (e) {
  //           throw new Error(e.message || "API error");
  //         }
  //       }
  //       return await r.json();
  //     })
  //     .then(c => {
  //       ui.setUnsavedChanges(false);
  //       segments = c;
  //       updateSegments();
  //     })
  //     .catch((e) => {
  //       console.error(e);
  //       ui.view("api-fail");
  //       if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
  //       pollingOff();
  //     });
  //   // Show submit confirmation
  //   ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
  //   ui.reloadUnsavedInputs();
  // });

  // Save
  document.querySelectorAll("#save-button").forEach(w => w.addEventListener("click", save));
  document.querySelectorAll("#create-button").forEach(w => w.addEventListener("click", createSegment));

  async function save(event, hideResult) {
    if (!active) return;
    if (!ui.unsavedChanges) {
      if (!hideResult) ui.toast("No changes to save.", 5000, "error", "bi bi-exclamation-triangle-fill");
      return;
    }
    removeAllSelected();
    removeSelecting();
    var updatedInfo = {};
    if (document.getElementById('course-period-input')) {
      updatedInfo = {
        course: {
          id: document.getElementById("course-period-input").value,
          name: document.getElementById("course-input").value,
          clicker_announcement: {
            image: JSON.parse(courses.find(c => String(c.id) === String(document.getElementById("course-period-input").value))?.clicker_announcement || '{}')?.image || null,
            title: document.getElementById('clicker-announcement-title').value || null,
            content: document.getElementById('clicker-announcement-content').value || null,
            linkTitle: document.getElementById('clicker-announcement-link-title').value || null,
            link: document.getElementById('clicker-announcement-link').value || null,
            layout: document.getElementById('clicker-announcement-layout').value || null,
            expires: document.getElementById('clicker-announcement-expires').value || null,
          },
          checker_announcement: {
            image: JSON.parse(courses.find(c => String(c.id) === String(document.getElementById("course-period-input").value))?.checker_announcement || '{}')?.image || null,
            title: document.getElementById('checker-announcement-title').value || null,
            content: document.getElementById('checker-announcement-content').value || null,
            linkTitle: document.getElementById('checker-announcement-link-title').value || null,
            link: document.getElementById('checker-announcement-link').value || null,
            layout: document.getElementById('checker-announcement-layout').value || null,
            expires: document.getElementById('checker-announcement-expires').value || null,
          },
        },
        segments: []
      };
      Array.from(document.querySelectorAll('.segments .section .section'))
        .filter(w => w.id)
        .forEach(segment => {
          updatedInfo.segments.push({
            order: segments.find(s => String(s.id) === String(segment.id.split('-')[1])).order,
            id: segment.id.split('-')[1],
            number: segment.querySelector('#segment-number-input').value,
            name: segment.querySelector('#segment-name-input').value,
            // question_ids: JSON.stringify(Array.from(segment.querySelectorAll('#segment-question-name-input')).filter(q => (q.value.length > 0) && (q.value != ' ') && (q.nextElementSibling.value.length > 0) && (q.nextElementSibling.value != ' ')).map(q => {
            //   return {
            //     name: q.value,
            //     id: q.nextElementSibling.value
            //   };
            // })),
            question_ids: segments.find(s => String(s.id) === String(segment.id.split('-')[1])).question_ids,
            due: segment.querySelector('#segment-due-date').value || null,
          });
        });
    } else if (document.querySelector('.questions.section')) {
      updatedInfo = {
        questions: []
      };
      if (document.getElementById("filter-segment-input").value) updatedInfo.segment = document.getElementById("filter-segment-input").value || null;
      Array.from(document.querySelectorAll('.questions .section .section'))
        .filter(w => w.id)
        .forEach(question => {
          updatedInfo.questions.push({
            id: question.id.split('-')[1],
            number: question.querySelector('#question-number-input').value,
            segment: question.querySelector('#question-segment-input').value,
            question: question.querySelector('#question-text-input').value,
            description: renderedEditors[Number(question.id.split('-')[1])] ? JSON.stringify(renderedEditors[Number(question.id.split('-')[1])].getContents()) : null,
            images: Array.from(question.querySelectorAll('.attachments img')).map(q => {
              return q.src;
            }),
            correctAnswers: Array.from(question.querySelectorAll('#question-correct-answer-input')).map(q => {
              return q.value;
            }),
            incorrectAnswers: Array.from(question.querySelectorAll('.incorrectAnswers .inputs')).map(q => {
              return {
                answer: q.querySelector('#question-incorrect-answer-input').value,
                reason: q.querySelector('#question-incorrect-answer-reason-input').value
              };
            }),
            latex: question.querySelector('[data-toggle-latex] i').classList.contains('bi-calculator-fill')
          });
        });
    } else if (document.querySelector('.ai-manager')) {
      updatedInfo = {
        ai: {
          generator_enabled: document.getElementById('generate-answers').checked,
          checker_enabled: document.getElementById('check-responses').checked,
          generate_answers_prompt: document.getElementById('generate-answers-prompt').value,
          check_responses_prompt: document.getElementById('check-responses-prompt').value
        }
      };
    }
    for (const key in updatedInfo) {
      if (Object.prototype.hasOwnProperty.call(updatedInfo, key)) {
        formData.append(key, (typeof updatedInfo[key] === 'string') ? updatedInfo[key] : JSON.stringify(updatedInfo[key]));
      }
    }
    formData.append('usr', storage.get("usr"));
    formData.append('pwd', storage.get("pwd"));
    ui.setUnsavedChanges(true);
    fetch(domain + '/save', {
      method: "POST",
      body: formData,
    })
      .then(async r => {
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
      })
      .then(() => {
        ui.setUnsavedChanges(false);
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
    document.querySelectorAll("#save-button").forEach(w => w.disabled = true);
    window.scroll(0, 0);
    if (typeof hideResult != 'boolean') ui.modeless(`<i class="bi bi-check-lg"></i>`, "Saved");
    await init();
    setTimeout(() => {
      document.querySelectorAll("#save-button").forEach(w => w.disabled = false);
    }, 2500);
  }

  // function handleDragStart(e) {
  //   if (!active) return;
  //   draggedItem = this.parentNode;
  //   e.dataTransfer.effectAllowed = 'move';
  // }

  // function handleDragOver(e) {
  //   if (!active) return;
  //   e.preventDefault();
  //   e.dataTransfer.dropEffect = 'move';
  // }

  // function handleDropCourse(e) {
  //   if (!active) return;
  //   e.stopPropagation();
  //   const targetItem = this.parentNode;
  //   if (draggedItem !== targetItem) {
  //     let parent = draggedItem.parentNode;
  //     parent.insertBefore(draggedItem, targetItem);
  //   }
  //   const newOrder = [...document.querySelectorAll('.dragCourse')].sort((a, b) => {
  //     return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  //   });
  //   const parent = document.querySelector('.course-reorder .reorder');
  //   newOrder.forEach(item => parent.appendChild(item));
  //   return false;
  // }

  // function handleDropSegment(e) {
  //   if (!active) return;
  //   e.stopPropagation();
  //   const targetItem = this.parentNode;
  //   if (draggedItem !== targetItem) {
  //     let parent = draggedItem.parentNode;
  //     parent.insertBefore(draggedItem, targetItem);
  //   }
  //   const newOrder = [...document.querySelectorAll('.dragSegment')].sort((a, b) => {
  //     return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  //   });
  //   const parent = document.querySelector('.segment-reorder .reorder');
  //   newOrder.forEach(item => parent.appendChild(item));
  //   return false;
  // }

  function addSegment() {
    if (!active) return;
    return window.location.href = '/admin/editor';
    // var group = document.createElement('div');
    // group.className = "section";
    // group.id = 'segment-new';
    // var buttonGrid = document.createElement('div');
    // buttonGrid.className = "button-grid inputs";
    // buttonGrid.innerHTML = `<button square data-select><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-number-input" value="0" /></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="segment-name-input" value="" /></div></div><div class="input-group mediuml"><div class="space" id="question-container"><input type="date" id="segment-due-date"></div></div><button square data-remove-segment-input><i class="bi bi-trash"></i></button><button square data-toggle-segment><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
    // group.appendChild(buttonGrid);
    // var questions = document.createElement('div');
    // questions.classList = "questions";
    // questions.innerHTML = `<div class="button-grid inputs"><div class="input-group small"><label>Name</label><label>ID</label></div><div class="input-group"><input type="text" autocomplete="off" id="segment-question-name-input" value="" /><input type="text" autocomplete="off" id="segment-question-id-input" value="" /></div><div class="input-group fit"><button square data-add-segment-question-input><i class="bi bi-plus"></i></button><button square data-remove-segment-question-input disabled><i class="bi bi-dash"></i></button></div></div>`;
    // group.appendChild(questions);
    // this.parentElement.insertBefore(group, this.parentElement.children[this.parentElement.children.length - 1]);
    // document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.removeEventListener('click', removeSegment));
    // document.querySelectorAll('[data-remove-segment-input]').forEach(a => a.addEventListener('click', removeSegment));
    // document.querySelectorAll('[data-add-segment-question-input]').forEach(a => a.addEventListener('click', addSegmentQuestion));
    // document.querySelectorAll('[data-remove-segment-question-input]').forEach(a => a.addEventListener('click', removeSegmentQuestion));
    // document.querySelectorAll('[data-toggle-segment]').forEach(a => a.addEventListener('click', toggleSegment));
    // document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
  }

  function removeSegment() {
    if (!active) return;
    ui.modal({
      title: 'Delete Segment',
      body: '<p>Are you sure you want to delete this segment? On save this action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Delete',
          class: 'submit-button',
          onclick: () => {
            removeSegmentRemove(this);
          },
          close: true,
        },
      ],
    });
  }

  function removeSegmentRemove(e) {
    if (!active) return;
    e.parentElement.parentElement.remove();
    ui.setUnsavedChanges(true);
  }

  function addSegmentQuestion() {
    if (!active) return;
    var group = document.createElement('div');
    group.className = "input-group";
    group.innerHTML = `<input type="text" autocomplete="off" id="segment-question-name-input" value="" /><input type="number" autocomplete="off" id="segment-question-id-input" value="" />`;
    this.parentElement.parentElement.insertBefore(group, this.parentElement);
    this.parentElement.querySelector('[data-remove-segment-question-input]').disabled = false;
    this.parentElement.querySelector('[data-remove-segment-question-input]').addEventListener('click', removeSegmentQuestion);
    ui.reloadUnsavedInputs();
  }

  function removeSegmentQuestion() {
    if (!active) return;
    this.parentElement.parentElement.children[this.parentElement.parentElement.children.length - 2].remove();
    if (this.parentElement.parentElement.children.length === 3) {
      this.parentElement.querySelector('[data-remove-segment-question-input]').disabled = true;
    }
  }

  function updateQuestions() {
    if (questions.length > 0) {
      if (document.querySelector('.questions .section')) {
        document.querySelector('.questions .section').innerHTML = '';
        var filteredQuestions = questions;
        if (document.getElementById("filter-segment-input")) {
          var selectedSegment = segments.find(segment => String(segment.id) === document.getElementById("filter-segment-input").value);
          if (selectedSegment) filteredQuestions = filteredQuestions.filter(q => JSON.parse(selectedSegment.question_ids).find(qId => String(qId.id) === String(q.id)));
        }
        renderedEditors = {};
        filteredQuestions.forEach(q => {
          var question = document.createElement('div');
          question.className = "section";
          question.id = `question-${q.id}`;
          var buttonGrid = document.createElement('div');
          buttonGrid.className = "button-grid inputs";
          var allSegmentsQuestionIsIn = segments.filter(e => JSON.parse(e.question_ids).find(qId => String(qId.id) === String(q.id)));
          var segmentsString = "";
          segments.forEach(s => {
            segmentsString += `<option value="${s.id}"${(allSegmentsQuestionIsIn[0] && (allSegmentsQuestionIsIn[0].id === s.id)) ? ' selected' : ''}>${s.number}</option>`;
          });
          buttonGrid.innerHTML = `<button square data-select tooltip="Select Question"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="${q.id}" disabled /></div></div><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="${q.number}" placeholder="${q.number}" /></div></div><div class="input-group small"><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="${q.question}" placeholder="${q.question}" /></div></div><button square data-toggle-latex tooltip="Toggle LaTeX Title"><i class="bi bi-${q.latex ? 'calculator-fill' : 'cursor-text'}"></i></button><button square data-remove-question-input tooltip="Remove Question"><i class="bi bi-trash"></i></button><button square data-archive-question-input tooltip="Archive Question"><i class="bi bi-archive"></i></button><button square data-toggle-question tooltip="Expand Question"><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
          if (window.innerWidth >= 1400) {
            buttonGrid.addEventListener('mouseenter', () => {
              var question = q;
              island(buttonGrid, filteredQuestions, 'question', {
                sourceId: String(question.id),
                id: `ID ${question.id}`,
                title: `Question ${question.number}`,
                subtitle: `${question.question}`,
                subtitleLatex: question.latex,
                description: question.description,
                attachments: question.images,
                lists: [
                  {
                    title: 'Correct Answers',
                    items: answers.find(a => a.id === question.id).correct_answers
                  },
                  {
                    title: 'Incorrect Answers',
                    items: answers.find(a => a.id === question.id).incorrect_answers
                  },
                ],
              }, answers);
            });
            buttonGrid.addEventListener('mouseleave', () => {
              island();
            });
          }
          question.appendChild(buttonGrid);
          var questionMathRendering = document.createElement('div');
          questionMathRendering.classList = `renderedMath${q.latex ? ' show' : ''}`;
          questionMathRendering.innerHTML = convertLatexToMarkup(q.question);
          renderMathInElement(questionMathRendering);
          question.appendChild(questionMathRendering);
          buttonGrid.querySelector("#question-text-input").addEventListener('input', (e) => {
            questionMathRendering.innerHTML = convertLatexToMarkup(e.target.value);
            renderMathInElement(questionMathRendering);
          });
          var textareaContainer = document.createElement('div');
          textareaContainer.classList = "description";
          var toolbar = document.createElement('div');
          toolbar.innerHTML = `<div id="toolbar-container">
            <span class="ql-formats">
              <select class="ql-font" tooltip="Font"></select>
              <select class="ql-size" tooltip="Text Size"></select>
            </span>
            <span class="ql-formats">
              <button class="ql-bold" tooltip="Bold"></button>
              <button class="ql-italic" tooltip="Italic"></button>
              <button class="ql-underline" tooltip="Underline"></button>
              <button class="ql-strike" tooltip="Strikethrough"></button>
              <button class="ql-faz-emoji" tooltip="Emoji"></button>
            </span>
            <span class="ql-formats">
              <select class="ql-color" tooltip="Text Color"></select>
              <select class="ql-background" tooltip="Highlight"></select>
            </span>
            <span class="ql-formats">
              <button class="ql-script" value="sub" tooltip="Subscript"></button>
              <button class="ql-script" value="super" tooltip="Superscript"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-header" value="1" tooltip="Heading"></button>
              <button class="ql-header" value="2" tooltip="Subheading"></button>
              <button class="ql-blockquote" tooltip="Blockquote"></button>
              <button class="ql-code-block" tooltip="Code Block"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-list" value="ordered" tooltip="Number List"></button>
              <button class="ql-list" value="bullet" tooltip="Bullet List"></button>
              <button class="ql-indent" value="-1" tooltip="Remove Indent"></button>
              <button class="ql-indent" value="+1" tooltip="Indent"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-direction" value="rtl" tooltip="Text Direction"></button>
              <select class="ql-align" tooltip="Alignment"></select>
            </span>
            <span class="ql-formats">
              <button class="ql-link" tooltip="Link"></button>
              <button class="ql-image" tooltip="Image"></button>
              <button class="ql-video" tooltip="Video"></button>
              <button class="ql-formula" tooltip="LaTeX"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-clean" tooltip="Clear Formatting"></button>
              <button data-clear-rich-content tooltip="Clear Description"><i class="bi bi-x-lg"></i></button>
            </span>
            <span class="ql-formats">
              <button data-export-rich-content tooltip="Export To Clipboard"><i class="bi bi-clipboard-fill"></i></button>
              <button data-import-rich-content tooltip="Import From Clipboard"><i class="bi bi-clipboard-plus-fill"></i></button>
            </span>
            <span class="ql-formats">
              <button data-undo-rich-content tooltip="Undo"><i class="bi bi-arrow-counterclockwise"></i></button>
              <button data-redo-rich-content tooltip="Redo"><i class="bi bi-arrow-clockwise"></i></button>
            </span>
          </div>`;
          textareaContainer.appendChild(toolbar);
          var textarea = document.createElement('div');
          textarea.classList.add('textarea');
          textarea.setAttribute('content', q.description || '');
          textareaContainer.appendChild(textarea);
          question.appendChild(textareaContainer);
          var images = document.createElement('div');
          images.classList = "attachments";
          JSON.parse(q.images).forEach(q => {
            var image = document.createElement('div');
            image.classList = "image";
            image.innerHTML = `<img data-src="${q}" />`;
            image.addEventListener('click', removeImage);
            images.appendChild(image);
          });
          var drop = document.createElement('div');
          drop.classList = "drop";
          drop.innerHTML = "+";
          drop.id = q.id;
          drop.addEventListener('click', renderPond);
          images.appendChild(drop);
          question.appendChild(images);
          var autofillAIAnswersContainer = document.createElement('div');
          autofillAIAnswersContainer.classList = "answers";
          var autofillAIAnswers = document.createElement('button');
          autofillAIAnswers.setAttribute('data-autofill-answers', '');
          autofillAIAnswers.innerHTML = '<i class="bi bi-openai"></i> Autofill Answers';
          autofillAIAnswersContainer.appendChild(autofillAIAnswers);
          question.appendChild(autofillAIAnswersContainer);
          var correctAnswers = document.createElement('div');
          correctAnswers.classList = "answers";
          var correctAnswersString = "";
          var questionAnswers = answers.find(a => a.id === q.id);
          questionAnswers.correct_answers.forEach(a => {
            correctAnswersString += `<div class="button-grid inputs"><input type="text" autocomplete="off" id="question-correct-answer-input" value="${a}" placeholder="${a}" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button></div>`;
          });
          correctAnswers.innerHTML = `<b>Correct Answers</b><div class="section correctAnswers">${correctAnswersString}<button data-add-correct-answer-input>Add Correct Answer</button></div>`;
          question.appendChild(correctAnswers);
          var incorrectAnswers = document.createElement('div');
          incorrectAnswers.classList = "answers";
          var incorrectAnswersString = "";
          questionAnswers.incorrect_answers.forEach(a => {
            incorrectAnswersString += `<div class="button-grid inputs"><input type="text" autocomplete="off" id="question-incorrect-answer-input" value="${a.answer}" placeholder="${a.answer || 'Answer'}" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="${a.reason}" placeholder="${a.reason || 'Reason'}" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button></div>`;
          });
          incorrectAnswers.innerHTML = `<b>Incorrect Answers</b><div class="section incorrectAnswers">${incorrectAnswersString}<button data-add-incorrect-answer-input>Add Incorrect Answer</button></div>`;
          question.appendChild(incorrectAnswers);
          document.querySelector('.questions .section').appendChild(question);
        });
        var addQuestionButton = document.createElement('button');
        addQuestionButton.setAttribute('data-add-question-input', '');
        addQuestionButton.innerText = "Add Question";
        document.querySelector('.questions .section').appendChild(addQuestionButton);
      }
    } else {
      if (document.querySelector('.questions .section')) document.querySelector('.questions .section').innerHTML = '<button data-add-question-input>Add Question</button>';
    }
    const questionsArchiveTab = document.querySelector('[data-archive-type="questions"]');
    if (questionsArchiveTab) {
      const questionsArchives = questionsArchiveTab.querySelector('.archives');
      const questionsArchivesList = questionsArchives.querySelector('.section');
      if (questions.length > 0) {
        questionsArchiveTab.querySelector('#no-archive').setAttribute('hidden', '');
        questionsArchives.removeAttribute('hidden');
      } else {
        questionsArchiveTab.querySelector('#no-archive').removeAttribute('hidden');
        questionsArchives.setAttribute('hidden', '');
      }
      questionsArchivesList.innerHTML = '';
      questions.sort((a, b) => a.order - b.order).forEach(question => {
        var buttonGrid = document.createElement('div');
        buttonGrid.className = "button-grid inputs";
        buttonGrid.setAttribute('archive-type', 'question');
        buttonGrid.id = question.id;
        buttonGrid.innerHTML = `<button square data-select tooltip="Select Item"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button>
        <div class="input-group rsmall">
          <div class="space" id="question-container">
            <input type="text" id="question-id-input" value="${question.id}" disabled />
          </div>
        </div>
        <div class="input-group small">
          <div class="space" id="question-container">
            <input type="text" id="question-number-input" value="${question.number}" disabled />
          </div>
        </div>
        <div class="input-group">
          <div class="space" id="question-container">
            <input type="text" id="question-question-input" value="${question.question || ''}" disabled />
          </div>
        </div>
        <div class="input-group">
          <div class="space" id="question-container">
            <input type="text" id="question-images-input" value="${JSON.parse(question.images).join(', ')}" disabled />
          </div>
        </div>
        <div class="input-group rsmall">
          <div class="space" id="question-container">
            <input type="text" id="question-latex-input" value="${question.latex || ''}" disabled />
          </div>
        </div>
        <button square data-restore-item tooltip="Restore Item"><i class="bi bi-arrow-counterclockwise"></i></button>`;
        if (window.innerWidth >= 1400) {
          buttonGrid.addEventListener('mouseenter', () => {
            island(buttonGrid, filteredQuestions, 'question', {
              sourceId: String(question.id),
              id: `ID ${question.id}`,
              title: `Question ${question.number}`,
              subtitle: `${question.question}`,
              subtitleLatex: question.latex,
              description: question.description,
              attachments: question.images,
              lists: [
                {
                  title: 'Correct Answers',
                  items: answers.find(a => a.id === question.id)?.correct_answers
                },
                {
                  title: 'Incorrect Answers',
                  items: answers.find(a => a.id === question.id)?.incorrect_answers
                },
              ],
            }, answers);
          });
          buttonGrid.addEventListener('mouseleave', () => {
            island();
          });
        }
        questionsArchivesList.appendChild(buttonGrid);
      });
      questionsArchivesList.querySelectorAll('[data-restore-item]').forEach(item => item.addEventListener('click', unarchiveModal));
    }
    document.querySelectorAll('[data-add-question-input]').forEach(a => a.addEventListener('click', addQuestion));
    document.querySelectorAll('[data-remove-question-input]').forEach(a => a.addEventListener('click', removeQuestion));
    document.querySelectorAll('[data-toggle-question]').forEach(a => a.addEventListener('click', toggleQuestion));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
    document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
    document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
    document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
    document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
    document.querySelectorAll('[data-toggle-latex]').forEach(a => a.addEventListener('click', toggleQuestionLatex));
    document.querySelectorAll('[data-archive-question-input]').forEach(a => a.addEventListener('click', () => {
      if (a.parentElement.parentElement.id) archiveModal('question', a.parentElement.parentElement.id.split('question-')[1]);
    }));
    document.querySelectorAll('[data-clear-rich-content]').forEach(a => a.addEventListener('click', () => {
      if (!a.parentElement.parentElement.parentElement.parentElement.parentElement.id) return;
      renderedEditors[Number(a.parentElement.parentElement.parentElement.parentElement.parentElement.id.split('question-')[1])].setContents();
    }));
    document.querySelectorAll('[data-undo-rich-content]').forEach(a => a.addEventListener('click', () => {
      if (!a.parentElement.parentElement.parentElement.parentElement.parentElement.id) return;
      renderedEditors[Number(a.parentElement.parentElement.parentElement.parentElement.parentElement.id.split('question-')[1])].history.undo();
    }));
    document.querySelectorAll('[data-redo-rich-content]').forEach(a => a.addEventListener('click', () => {
      if (!a.parentElement.parentElement.parentElement.parentElement.parentElement.id) return;
      renderedEditors[Number(a.parentElement.parentElement.parentElement.parentElement.parentElement.id.split('question-')[1])].history.redo();
    }));
    document.querySelectorAll('[data-export-rich-content]').forEach(a => a.addEventListener('click', () => {
      if (!a.parentElement.parentElement.parentElement.parentElement.parentElement.id) return;
      navigator.clipboard.writeText(JSON.stringify(renderedEditors[Number(a.parentElement.parentElement.parentElement.parentElement.parentElement.id.split('question-')[1])].getContents())).then(() => {
        ui.toast("Content copied to clipboard.", 3000, "success", "bi bi-clipboard-check-fill");
      }).catch((err) => {
        console.error('Failed to copy content: ', err);
        ui.toast("Failed to copy content to clipboard.", 5000, "error", "bi bi-exclamation-triangle-fill");
      });
    }));
    document.querySelectorAll('[data-import-rich-content]').forEach(a => a.addEventListener('click', () => {
      if (!a.parentElement.parentElement.parentElement.parentElement.parentElement.id) return;
      navigator.clipboard.readText().then((text) => {
        try {
          const content = JSON.parse(text);
          if (!text || !text.includes("ops") || !content) return ui.toast("Invalid clipboard content.", 5000, "error", "bi bi-exclamation-triangle-fill");
          renderedEditors[Number(a.parentElement.parentElement.parentElement.parentElement.parentElement.id.split('question-')[1])].setContents(content);
          ui.toast("Content imported from clipboard.", 3000, "success", "bi bi-clipboard-check-fill");
        } catch (err) {
          console.error('Failed to parse content: ', err);
          ui.toast("Failed to parse content from clipboard.", 5000, "error", "bi bi-exclamation-triangle-fill");
        }
      }).catch((err) => {
        console.error('Failed to read clipboard: ', err);
        ui.toast("Failed to read content from clipboard.", 5000, "error", "bi bi-exclamation-triangle-fill");
      });
    }));
    document.querySelectorAll('[data-autofill-answers]').forEach(a => a.addEventListener('click', autofillAnswers));
    if (!loadedSegmentEditor && !loadedSegmentCreator) ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  function addCorrectAnswer() {
    if (!active) return;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-correct-answer-input" value="" placeholder="Answer" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button>`;
    this.parentElement.insertBefore(input, this);
    document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
    document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
    ui.reloadUnsavedInputs();
  }

  function addIncorrectAnswer() {
    if (!active) return;
    var input = document.createElement('div');
    input.className = "button-grid inputs";
    input.innerHTML = `<input type="text" autocomplete="off" id="question-incorrect-answer-input" value="" placeholder="Answer" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="" placeholder="Reason" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button>`;
    this.parentElement.insertBefore(input, this);
    document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
    document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
    ui.reloadUnsavedInputs();
  }

  function removeCorrectAnswer() {
    if (!active) return;
    this.parentElement.remove();
    ui.setUnsavedChanges(true);
  }

  function removeIncorrectAnswer() {
    if (!active) return;
    this.parentElement.remove();
    ui.setUnsavedChanges(true);
  }

  function toggleQuestionLatex() {
    if (!active) return;
    this.disabled = true;
    const icon = this.querySelector('i');
    const question_id = this.parentElement.querySelector('#question-id-input').value;
    var isLatex = false;
    if (!icon.classList.contains('bi-cursor-text')) isLatex = true;
    ui.setUnsavedChanges(true);
    fetch(domain + `/question/${isLatex ? 'not_' : ''}latex`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        question_id
      })
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
        ui.setUnsavedChanges(false);
        if (icon.classList.contains('bi-cursor-text')) {
          icon.classList.remove('bi-cursor-text');
          icon.classList.add('bi-calculator-fill');
          ui.toast("Question name marked as LaTeX.", 3000, "success", "bi bi-calculator-fill");
        } else {
          icon.classList.remove('bi-calculator-fill');
          icon.classList.add('bi-cursor-text');
          ui.toast("Question name marked as plain text.", 3000, "success", "bi bi-cursor-text");
        }
        if (isLatex) {
          this.parentElement.parentElement.querySelector(".renderedMath").classList.remove('show');
        } else {
          this.parentElement.parentElement.querySelector(".renderedMath").innerHTML = convertLatexToMarkup(this.parentElement.querySelector("#question-text-input").value);
          renderMathInElement(this.parentElement.parentElement.querySelector(".renderedMath"));
          this.parentElement.parentElement.querySelector(".renderedMath").classList.add('show');
        }
        this.disabled = false;
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function toggleQuestion() {
    if (!active) return;
    if (this.parentElement.parentElement.classList.contains('expanded')) {
      hideAllQuestions();
    } else {
      hideAllQuestions();
      this.parentElement.parentElement.classList.add('expanded');
      document.querySelector('[data-add-question-input]').style.display = "none";
      document.querySelectorAll('#save-button').forEach(w => w.style.display = "none");
      if (!this.parentElement.parentElement.classList.contains('rendered')) {
        var textarea = this.parentElement.parentElement.querySelector('.description .textarea');
        var textareaContent = textarea.getAttribute('content');
        var toolbar = this.parentElement.parentElement.querySelector('.description #toolbar-container');
        var quill = new Quill(textarea, {
          modules: {
            syntax: true,
            toolbar,
            fazEmoji: {
              collection: 'fluent-emoji',
            },
          },
          placeholder: 'Add some written content to your question...',
          theme: 'snow'
        });
        if (JSON.parse(textareaContent)) quill.setContents(JSON.parse(textareaContent));
        quill.on('text-change', (delta) => {
          ui.setUnsavedChanges(true);
          var pastedLatex = delta.ops.find(op => Object.keys(op).includes('insert'))?.insert;
          if (pastedLatex && (typeof pastedLatex === 'string')) {
            const latexMatches = [...pastedLatex.matchAll(/(\$\$(.+?)\$\$)|(?<!\\)\$(.+?)(?<!\\)\$/gs)];
            latexMatches.forEach(match => {
              const fullMatch = match[0];
              const innerLatex = match[2] || match[3];
              const index = pastedLatex.indexOf(fullMatch);
              quill.deleteText(quill.getSelection(true)?.index + index, fullMatch.length);
              quill.insertEmbed(quill.getSelection(true)?.index + index, 'formula', innerLatex);
              pastedLatex = pastedLatex.replace(fullMatch, ' ');
            });
            pastedLatex = pastedLatex.replace(/(?<!\\)\$/g, '');
          }
        });
        renderedEditors[this.parentElement.parentElement.querySelector('#question-id-input').value] = quill;
        this.parentElement.parentElement.querySelectorAll('img[data-src]:not([src])').forEach(img => img.src = img.getAttribute('data-src'));
      }
    }
  }

  function hideAllQuestions() {
    if (!active) return;
    document.querySelectorAll('.expanded').forEach(q => q.classList.remove('expanded'));
    document.querySelector('[data-add-question-input]').style.display = "block";
    document.querySelectorAll('#save-button').forEach(w => w.style.display = "block");
  }

  function addQuestion() {
    if (!active) return;
    var group = document.createElement('div');
    group.className = "section";
    group.id = 'question-new';
    var buttonGrid = document.createElement('div');
    buttonGrid.className = "button-grid inputs";
    var segmentsString = "";
    segments.forEach(s => segmentsString += `<option value="${s.id}"${(document.location.search.split('?segment=')[1] && (document.location.search.split('?segment=')[1] === String(s.id))) ? ' selected' : ''}>${s.number}</option>`);
    buttonGrid.innerHTML = `<button square data-select tooltip="Select Question"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-id-input" value="" disabled /></div></div><div class="input-group small"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-number-input" value="" /></div></div><div class="input-group small"><div class="space" id="question-container"><select id="question-segment-input">${segmentsString}</select></div></div><div class="input-group"><div class="space" id="question-container"><input type="text" autocomplete="off" id="question-text-input" value="" /></div></div><button square data-toggle-latex disabled tooltip="Toggle LaTeX Title"><i class="bi bi-cursor-text"></i></button><button square data-remove-question-input tooltip="Remove Question"><i class="bi bi-trash"></i></button><button square data-toggle-question tooltip="Expand Question"><i class="bi bi-caret-down-fill"></i><i class="bi bi-caret-up-fill"></i></button>`;
    group.appendChild(buttonGrid);
    this.parentElement.insertBefore(group, this.parentElement.children[this.parentElement.children.length - 1]);
    document.querySelectorAll('[data-add-question-input]').forEach(a => a.addEventListener('click', addQuestion));
    document.querySelectorAll('[data-remove-question-input]').forEach(a => a.addEventListener('click', removeQuestion));
    document.querySelectorAll('[data-toggle-question]').forEach(a => a.addEventListener('click', toggleQuestion));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
    buttonGrid.querySelector("#question-number-input").focus();
    ui.reloadUnsavedInputs();
  }

  function removeQuestion() {
    if (!active) return;
    this.parentElement.parentElement.remove();
    hideAllQuestions();
  }

  async function renderPond() {
    if (!active) return;
    await save(null, true);
    document.querySelector(`#question-${this.id} [data-toggle-question]`).click();
    const url = '/admin/upload?question=' + this.id;
    const width = 600;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
    const newWindow = window.open(url, '_blank', windowFeatures);
    let uploadSuccessful = false;
    window.addEventListener('message', (event) => {
      if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      if (event.data === 'uploadSuccess') uploadSuccessful = true;
    }, false);
    const checkWindowClosed = setInterval(function () {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindowClosed);
        if (uploadSuccessful) {
          ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
        } else {
          ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, "Upload Cancelled");
        }
        init();
      }
    }, 1000);
  }

  async function removeImage(event) {
    if (!active) return;
    const element = event.target;
    const rect = element.getBoundingClientRect();
    const clickYRelativeToElement = event.clientY - rect.top;
    const distanceFromBottom = rect.height - clickYRelativeToElement;
    if (distanceFromBottom <= 26) {
      await save(null, true);
      ui.setUnsavedChanges(true);
      await fetch(domain + '/upload', {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usr: storage.get("usr"),
          pwd: storage.get("pwd"),
          question_id: event.target.parentElement.parentElement.querySelector('#question-id-input').value,
          file_url: event.target.querySelector('img').src
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
          ui.setUnsavedChanges(false);
          ui.modeless(`<i class="bi bi-file-earmark-x"></i>`, "Removed");
          init();
        })
        .catch((e) => {
          console.error(e);
          ui.view("api-fail");
          if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
          pollingOff();
        });
    } else {
      window.open(event.target.src);
    }
  }

  async function updateResponses() {
    expandedReports = [];
    document.querySelectorAll('.detailed-report.active').forEach(dr => expandedReports.push(dr.id));
    if (document.querySelector('.awaitingResponses .section')) document.querySelector('.awaitingResponses .section').innerHTML = '';
    if (document.querySelector('.trendingResponses .section')) document.querySelector('.trendingResponses .section').innerHTML = '';
    if (document.querySelector('.responses .section')) document.querySelector('.responses .section').innerHTML = '';
    if (document.querySelector('.seat-code-reports')) document.querySelector('.seat-code-reports').innerHTML = '';
    var trendingResponses = [];
    var timedResponses = [];
    var responses1 = responses
      .filter(r => courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value)?.periods).includes(Number(String(r.seatCode)[0])) : false)
      .filter(r => document.getElementById("filter-segment-input")?.value ? (String(segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')) === document.getElementById("filter-segment-input").value) : true)
      .filter(r => questions.find(q => String(q.id) === String(r.question_id))?.number.startsWith(document.getElementById("sort-question-input")?.value))
      .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
      .sort((a, b) => {
        if (a.flagged && !b.flagged) return -1;
        if (!a.flagged && b.flagged) return 1;
        return b.id - a.id;
      });
    var seatCodes = [];
    pagination.awaitingResponses.total = responses1.filter(r => ((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')).length;
    pagination.responses.total = responses1.filter(r => !((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.responses .section')).length;
    if (document.querySelector('.awaitingResponses #current-page')) document.querySelector('.awaitingResponses #current-page').innerText = `Page ${pagination.awaitingResponses.page + 1} of ${Math.ceil(pagination.awaitingResponses.total / pagination.awaitingResponses.perPage)}`;
    if (document.querySelector('.responses #current-page')) document.querySelector('.responses #current-page').innerText = `Page ${pagination.responses.page + 1} of ${Math.ceil(pagination.responses.total / pagination.responses.perPage)}`;
    responses1.filter(r => (((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')) ? ((responses1.filter(response => ((response.status === 'Invalid Format') || (response.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')).indexOf(r) >= pagination.awaitingResponses.page * pagination.awaitingResponses.perPage) && (responses1.filter(response => ((response.status === 'Invalid Format') || (response.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')).indexOf(r) < (pagination.awaitingResponses.page * pagination.awaitingResponses.perPage) + pagination.awaitingResponses.perPage)) : (document.querySelector('.responses .section') ? ((responses1.filter(response => !((response.status === 'Invalid Format') || (response.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')).indexOf(r) >= pagination.responses.page * pagination.responses.perPage) && (responses1.filter(response => !((response.status === 'Invalid Format') || (response.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')).indexOf(r) < (pagination.responses.page * pagination.responses.perPage) + pagination.responses.perPage)) : false)).forEach(r => {
      if (document.querySelector('.responses .section') || document.querySelector('.awaitingResponses .section')) {
        var responseString = r.response;
        var isMatrix = null;
        if (responseString.includes('[[')) {
          try {
            isMatrix = responseString;
            responseString = JSON.stringify(JSON.parse(r.response).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']');
          } catch {
            isMatrix = null;
            console.log(`Invalid matrix: ${r.response}`);
          }
        } else if (responseString.includes('[')) {
          try {
            var parsedResponse = JSON.parse(r.response);
            responseString = parsedResponse.join(', ');
          } catch {
            console.log(`Invalid JSON: ${r.response}`);
          }
        }
        var correctResponsesString = `Accepted: ${answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.join(', ')}`;
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
        buttonGrid.innerHTML = `<button square data-select tooltip="Select Item"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button><input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.id}" disabled hidden />${(String(r.flagged) === '1') ? `<button square data-unflag-response tooltip="Unflag Response"><i class="bi bi-flag-fill"></i></button>` : `<button square data-flag-response tooltip="Flag Response"><i class="bi bi-flag"></i></button>`}<input type="text" autocomplete="off" class="small" id="response-segment-input" value="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).number || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.number || '-')}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => String(q.id) === String(r.question_id))?.number}" mockDisabled data-question="${questions.find(q => String(q.id) === String(r.question_id))?.number}" /><input type="text" autocomplete="off" class="small" id="response-question-id-input" value="${questions.find(q => String(q.id) === String(r.question_id)).id}" disabled hidden /><input type="text" autocomplete="off" class="small${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-seat-code-input" value="${r.seatCode}" disabled data-seat-code /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTaken}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${timeTakenToRevise}" disabled data-time-taken${(typeof timeDifference != 'undefined') ? ` time="${timeDifference}"` : ''} /><!--<input type="text" autocomplete="off" class="small" id="response-time-taken-input" value="${result}" disabled data-time-taken />--><textarea autocomplete="off" rows="1" id="response-response-input" value="${escapeHTML(responseString)}" ${isMatrix ? 'mockDisabled' : 'disabled'}>${escapeHTML(responseString)}</textarea>${(r.status === 'Incorrect') ? `<button square data-edit-reason tooltip="Edit Reason"><i class="bi bi-reply${(r.reason) ? '-fill' : ''}"></i></button>` : ''}<input type="text" autocomplete="off" class="smedium${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? ' hideonhover' : ''}" id="response-timestamp-input" value="${date.getMonth() + 1}/${date.getDate()} ${hours % 12 || 12}:${minutes < 10 ? '0' + minutes : minutes} ${hours >= 12 ? 'PM' : 'AM'}" disabled />${(((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section') && (answers.find(a => a.id === questions.find(q => String(q.id) === String(r.question_id)).id).correct_answers.length > 0)) ? `<textarea autocomplete="off" rows="1" class="showonhover" id="response-correct-responses-input" value="${correctResponsesString}" disabled>${correctResponsesString}</textarea>` : ''}<button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
        if (window.innerWidth >= 1400) {
          buttonGrid.addEventListener('mouseenter', () => {
            var question = questions.find(q => String(q.id) === String(r.question_id));
            island(buttonGrid, buttonGrid.parentElement.children, 'response', {
              sourceId: String([...buttonGrid.parentElement.children].indexOf(buttonGrid)),
              id: `ID ${question.id}`,
              title: `Question ${question.number}`,
              subtitle: `${question.question}`,
              subtitleLatex: question.latex,
              description: question.description,
              attachments: question.images,
              lists: [
                {
                  title: 'Correct Answers',
                  items: answers.find(a => a.id === question.id).correct_answers
                },
                {
                  title: 'Incorrect Answers',
                  items: answers.find(a => a.id === question.id).incorrect_answers
                },
              ],
              activeItem: responseString,
            }, questions, answers);
          });
          buttonGrid.addEventListener('mouseleave', () => {
            island();
          });
        }
        if (document.querySelector('.responses .section')) {
          document.querySelector('.responses .section').appendChild(buttonGrid);
          document.querySelector('.responses .section .button-grid:last-child #response-segment-input').addEventListener('click', (e) => {
            if (e.target.getAttribute('data-segment')) {
              document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
              updateResponses();
            }
          });
          document.querySelector('.responses .section .button-grid:last-child #response-question-input').addEventListener('click', (e) => {
            if (e.target.getAttribute('data-question')) {
              document.getElementById("sort-question-input").value = e.target.getAttribute('data-question');
              updateResponses();
            }
          });
          if (isMatrix) document.querySelector('.responses .section .button-grid:last-child #response-response-input').addEventListener('click', () => ui.expandMatrix(isMatrix));
        }
        if (((r.status === 'Invalid Format') || (r.status === 'Unknown, Recorded')) && document.querySelector('.awaitingResponses .section')) {
          document.querySelector('.awaitingResponses .section').appendChild(buttonGrid);
          document.querySelector('.awaitingResponses .section .button-grid:last-child #response-segment-input').addEventListener('click', (e) => {
            if (e.target.getAttribute('data-segment')) {
              document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
              updateResponses();
            }
          });
          document.querySelector('.awaitingResponses .section .button-grid:last-child #response-question-input').addEventListener('click', (e) => {
            if (e.target.getAttribute('data-question')) {
              document.getElementById("sort-question-input").value = e.target.getAttribute('data-question');
              updateResponses();
            }
          });
          if (isMatrix) document.querySelector('.awaitingResponses .section .button-grid:last-child #response-response-input').addEventListener('click', () => ui.expandMatrix(isMatrix));
        }
      }
      var trend = trendingResponses.find(t => (t.segment === r.segment) && (t.question_id === r.question_id) && (t.response === responseString) && (t.status === r.status));
      if (trend) {
        trend.count++;
      } else {
        trendingResponses.push({
          single_response: r.id,
          segment: r.segment,
          question_id: r.question_id,
          response: r.response,
          status: r.status,
          count: 1
        });
      }
      if (document.querySelector('.seat-code-reports')) {
        if (seatCodes.find(seatCode => seatCode.code === r.seatCode)) {
          const seatCode = seatCodes.find(seatCode => seatCode.code === r.seatCode);
          if (r.status === 'Correct') {
            seatCode.correct++;
          } else if (r.status === 'Incorrect') {
            seatCode.incorrect++;
          } else if (r.status.includes('Recorded')) {
            seatCode.waiting++;
          } else {
            seatCode.other++;
          }
          seatCode.total++;
          seatCode.responses.push(r);
        } else {
          seatCodes.push({
            code: r.seatCode,
            correct: (r.status === 'Correct') ? 1 : 0,
            incorrect: (r.status === 'Incorrect') ? 1 : 0,
            other: ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded')) ? 1 : 0,
            waiting: r.status.includes('Recorded') ? 1 : 0,
            total: 1,
            responses: [r],
          });
        }
      }
    });
    if (document.querySelector('.seat-code-reports')) {
      var sortedSeatCodes = seatCodes.filter(seatCode => JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).periods).includes(Number(String(seatCode.code)[0])));
      if (document.getElementById('useRoster').checked) {
        var currentCourseRosters = rosters.filter(roster => JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input").value)?.periods).includes(Number(String(roster.period))));
        if (currentCourseRosters.length) document.querySelector('.seat-code-reports').appendChild(document.createElement('div'));
        currentCourseRosters.forEach(currentCourseRoster => {
          var total = [...new Set(JSON.parse(currentCourseRoster.data).flatMap(a => Number(a.seatCode)))];
          var registered = [...new Set(sortedSeatCodes.flatMap(a => a.code).filter(x => total.includes(x)))];
          var courseRosterProgress = document.createElement('div');
          courseRosterProgress.classList = (currentCourseRosters.length > 1) ? 'seat-code-report' : 'barcount-wrapper fill';
          courseRosterProgress.innerHTML = `${(currentCourseRosters.length > 1) ? `<b>Period ${currentCourseRoster.period}</b><div class="barcount-wrapper fill">` : ''}
              ${registered.length ? `<div class="barcount correct" style="width: calc(${registered.length / total.length} * 100%)">${registered.length} Registered Student${(registered.length > 1) ? 's' : ''}</div>` : ''}
              ${(total.length - registered.length) ? `<div class="barcount other" style="width: calc(${(total.length - registered.length) / total.length} * 100%)">${total.length - registered.length} Unregistered Student${((total.length - registered.length) > 1) ? 's' : ''}</div>` : ''}
          ${(currentCourseRosters.length > 1) ? `</div>` : ''}`;
          document.querySelector('.seat-code-reports').appendChild(courseRosterProgress);
          if (window.innerWidth >= 1400) {
            courseRosterProgress.addEventListener('mouseenter', () => {
              island(courseRosterProgress, currentCourseRosters, 'roster', {
                sourceId: String(currentCourseRoster.period),
                title: `Period ${currentCourseRoster.period}`,
                subtitle: `${registered.length}/${total.length} Registered Students`,
                lists: [
                  {
                    title: 'Unregistered Students',
                    items: total.filter(a => !registered.includes(a)).map(a => { var student = JSON.parse(currentCourseRoster.data).find(b => String(b.seatCode) === String(a)); return `${student.last}, ${student.first} (${a})`; })
                  },
                  {
                    title: 'Registered Students',
                    items: total.filter(a => registered.includes(a)).map(a => { var student = JSON.parse(currentCourseRoster.data).find(b => String(b.seatCode) === String(a)); return `${student.last}, ${student.first} (${a})`; })
                  },
                ],
              }, sortedSeatCodes);
            });
            courseRosterProgress.addEventListener('mouseleave', () => {
              island();
            });
          }
        });
        if (currentCourseRosters.length) document.querySelector('.seat-code-reports').appendChild(document.createElement('div'));
      }
      switch (document.querySelector('#sort-report-responses [aria-selected="true"]').getAttribute('data-value')) {
        case 'seatCode':
          sortedSeatCodes = sortedSeatCodes.sort((a, b) => Number(a.code) - Number(b.code));
          break;
        case 'studentName':
          sortedSeatCodes = sortedSeatCodes.sort((a, b) => {
            var nameA = "Unknown";
            var nameB = "Unknown";
            if (document.getElementById('useRoster').checked) {
              var roster = rosters.find(roster => roster.period === Number(String(a.code)[0]));
              if (roster) {
                var studentA = JSON.parse(roster.data).find(student => String(student.seatCode) === String(a.code));
                if (studentA) nameA = `${studentA.last}, ${studentA.first}`;
                var studentB = JSON.parse(roster.data).find(student => String(student.seatCode) === String(b.code));
                if (studentB) nameB = `${studentB.last}, ${studentB.first}`;
              }
            }
            return nameA.localeCompare(nameB);
          });
          break;
      }
      sortedSeatCodes.forEach(seatCode => {
        var detailedReport = '';
        var seatCodeResponses = seatCode.responses.sort((a, b) => a.timestamp - b.timestamp);
        if (document.getElementById('hideIncorrectAttempts').checked) seatCodeResponses = seatCodeResponses.filter((r, index, self) => r.status === 'Correct' || !self.some(other => other.question_id === r.question_id && other.status === 'Correct'));
        if (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') === 'first') {
          seatCodeResponses = seatCodeResponses.filter(r => r.id === Math.min(...seatCodeResponses.filter(r1 => r1.seatCode === r.seatCode && r1.question_id === r.question_id).map(r1 => r1.id)));
        } else if (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') === 'last') {
          seatCodeResponses = seatCodeResponses.filter(r => r.id === Math.max(...seatCodeResponses.filter(r1 => r1.seatCode === r.seatCode && r1.question_id === r.question_id).map(r1 => r1.id)));
        }
        seatCodeResponses.forEach(r => {
          const currentDate = new Date(r.timestamp);
          var timeTaken = "N/A";
          const sameSeatCodeResponses = responses
            .filter(r => courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value)?.periods).includes(Number(String(r.seatCode)[0])) : false)
            .filter(r => document.getElementById("filter-segment-input")?.value ? (String(segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')) === document.getElementById("filter-segment-input").value) : true)
            .filter(r => questions.find(q => String(q.id) === String(r.question_id))?.number.startsWith(document.getElementById("sort-question-input")?.value))
            .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
            .sort((a, b) => {
              if (a.flagged && !b.flagged) return -1;
              if (!a.flagged && b.flagged) return 1;
              return b.id - a.id;
            })
            .filter(a => a.seatCode === r.seatCode)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const lastResponseIndex = sameSeatCodeResponses.findIndex(a => new Date(a.timestamp) >= currentDate) - 1;
          const lastResponse = lastResponseIndex >= 0 ? sameSeatCodeResponses[lastResponseIndex] : null;
          let timeDifference;
          if (lastResponse) {
            timeDifference = calculateTimeDifference(currentDate, lastResponse.timestamp);
            timeTaken = formatTimeDifference(timeDifference);
          }
          detailedReport += questions.find(q => String(q.id) === String(r.question_id))?.number ? `<div class="detailed-report-question">
            <div class="color">
              <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
              <span class="color-name">Segment ${segments.find(s => String(s.id) === String(r.segment))?.number || r.segment} #${questions.find(q => String(q.id) === String(r.question_id))?.number}<p class="showonhover"> (${time.unixToString(r.timestamp)})</p>: ${escapeHTML(r.response)}</span>
            </div>
            <div class="color">
              <span class="color-name">${timeTaken}</span>
              <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
            </div>
          </div>` : '';
        });
        var name = "Unknown";
        if (document.getElementById('useRoster').checked) {
          var roster = rosters.find(roster => roster.period === Number(String(seatCode.code)[0]));
          if (roster) {
            var student = JSON.parse(roster.data).find(student => String(student.seatCode) === String(seatCode.code));
            if (student) name = `${student.last}, ${student.first}`;
          }
        }
        var seatCodeReport = document.createElement('div');
        seatCodeReport.classList = 'seat-code-report';
        seatCodeReport.setAttribute('report', `seat-code-${seatCode.code}`);
        seatCodeReport.innerHTML = `<b>${document.getElementById('useRoster').checked ? `${name} (${seatCode.code})` : seatCode.code} (${seatCodeResponses.length} Response${(seatCodeResponses.length != 1) ? 's' : ''})</b>
        <div class="barcount-wrapper">
          ${(seatCodeResponses.filter(r => r.status === 'Correct').length != 0) ? `<div class="barcount correct" style="width: calc(${seatCodeResponses.filter(r => r.status === 'Correct').length / (seatCodeResponses.length || 1)} * 100%)">${seatCodeResponses.filter(r => r.status === 'Correct').length}</div>` : ''}
          ${(seatCodeResponses.filter(r => (r.status != 'Correct') && (r.status != 'Incorrect') && !r.status.includes('Recorded')).length != 0) ? `<div class="barcount other" style="width: calc(${seatCodeResponses.filter(r => (r.status != 'Correct') && (r.status != 'Incorrect') && !r.status.includes('Recorded')).length / (seatCodeResponses.length || 1)} * 100%)">${seatCodeResponses.filter(r => (r.status != 'Correct') && (r.status != 'Incorrect') && !r.status.includes('Recorded')).length}</div>` : ''}
          ${(seatCodeResponses.filter(r => r.status.includes('Recorded')).length != 0) ? `<div class="barcount waiting" style="width: calc(${seatCodeResponses.filter(r => r.status.includes('Recorded')).length / (seatCodeResponses.length || 1)} * 100%)">${seatCodeResponses.filter(r => r.status.includes('Recorded')).length}</div>` : ''}
          ${(seatCodeResponses.filter(r => r.status === 'Incorrect').length != 0) ? `<div class="barcount incorrect" style="width: calc(${seatCodeResponses.filter(r => r.status === 'Incorrect').length / (seatCodeResponses.length || 1)} * 100%)">${seatCodeResponses.filter(r => r.status === 'Incorrect').length}</div>` : ''}
        </div>`;
        document.querySelector('.seat-code-reports').appendChild(seatCodeReport);
        var seatCodeDetailedReport = document.createElement('div');
        seatCodeDetailedReport.classList = 'seat-code-report';
        seatCodeDetailedReport.setAttribute('report', `seat-code-${seatCode.code}`);
        seatCodeDetailedReport.innerHTML = `<div class="section detailed-report" id="seat-code-${seatCode.code}">
          ${detailedReport}
        </div>`;
        document.querySelector('.seat-code-reports').appendChild(seatCodeDetailedReport);
      });
    }
    const stdDev = calculateStandardDeviation(timedResponses);
    // console.log("Standard Deviation:", stdDev);
    document.querySelectorAll('[data-time-taken]').forEach(d => {
      if (d.hasAttribute('time') && (Number(d.getAttribute('time')) > stdDev)) d.classList.add('disabled');
    });
    trendingResponses.filter(t => t.count > 1).forEach(r => {
      var responseString = r.response;
      var isMatrix = null;
      if (responseString.includes('[[')) {
        try {
          isMatrix = responseString;
          responseString = JSON.stringify(JSON.parse(r.response).map(innerArray => innerArray.map(numString => String(numString)))).replaceAll('["', '[').replaceAll('","', ', ').replaceAll('"]', ']');
        } catch {
          isMatrix = null;
          console.log(`Invalid matrix: ${r.response}`);
        }
      } else if (responseString.includes('[')) {
        try {
          var parsedResponse = JSON.parse(r.response);
          responseString = parsedResponse.join(', ');
        } catch {
          console.log(`Invalid JSON: ${r.response}`);
        }
      }
      var buttonGrid = document.createElement('div');
      buttonGrid.className = "button-grid inputs";
      buttonGrid.innerHTML = `<input type="text" autocomplete="off" class="small" id="response-id-input" value="${r.single_response}" disabled hidden /><input type="text" autocomplete="off" class="small" id="response-segment-input" value="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).number || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.number || '-')}" mockDisabled data-segment="${segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')}" /><input type="text" autocomplete="off" class="small" id="response-question-input" value="${questions.find(q => String(q.id) === String(r.question_id))?.number}" mockDisabled data-question="${questions.find(q => String(q.id) === String(r.question_id))?.number}" /><input type="text" autocomplete="off" class="small" id="response-question-id-input" value="${questions.find(q => String(q.id) === String(r.question_id)).id}" disabled hidden /><textarea autocomplete="off" rows="1" id="response-response-input" value="${escapeHTML(responseString)}" ${isMatrix ? 'mockDisabled' : 'disabled'}>${escapeHTML(responseString)}</textarea><input type="text" autocomplete="off" class="small" id="response-count-input" value="${r.count}" disabled /><button square id="mark-correct-button"${(r.status === 'Correct') ? ' disabled' : ''} tooltip="Mark Correct"><i class="bi bi-check-circle${(r.status === 'Correct') ? '-fill' : ''}"></i></button><button square id="mark-incorrect-button"${(r.status === 'Incorrect') ? ' disabled' : ''} tooltip="Mark Incorrect"><i class="bi bi-x-circle${(r.status === 'Incorrect') ? '-fill' : ''}"></i></button>`;
      if (window.innerWidth >= 1400) {
        buttonGrid.addEventListener('mouseenter', () => {
          var question = questions.find(q => String(q.id) === String(r.question_id));
          island(buttonGrid, buttonGrid.parentElement.children, 'response', {
            sourceId: String([...buttonGrid.parentElement.children].indexOf(buttonGrid)),
            id: `ID ${question.id}`,
            title: `Question ${question.number}`,
            subtitle: `${question.question}`,
            subtitleLatex: question.latex,
            description: question.description,
            attachments: question.images,
            lists: [
              {
                title: 'Correct Answers',
                items: answers.find(a => a.id === question.id).correct_answers
              },
              {
                title: 'Incorrect Answers',
                items: answers.find(a => a.id === question.id).incorrect_answers
              },
            ],
            activeItem: responseString,
          }, questions, answers);
        });
        buttonGrid.addEventListener('mouseleave', () => {
          island();
        });
      }
      document.querySelector('.trendingResponses .section').appendChild(buttonGrid);
      document.querySelector('.trendingResponses .section .button-grid:last-child #response-segment-input').addEventListener('click', (e) => {
        if (e.target.getAttribute('data-segment')) {
          document.getElementById("filter-segment-input").value = e.target.getAttribute('data-segment');
          updateResponses();
        }
      });
      document.querySelector('.trendingResponses .section .button-grid:last-child #response-question-input').addEventListener('click', (e) => {
        if (e.target.getAttribute('data-question')) {
          document.getElementById("sort-question-input").value = e.target.getAttribute('data-question');
          updateResponses();
        }
      });
      if (isMatrix) document.qquerySelector('.trendingResponses .section .button-grid:last-child #response-response-input').addEventListener('click', () => ui.expandMatrix(isMatrix));
    });
    const responsesArchiveTab = document.querySelector('[data-archive-type="responses"]');
    if (responsesArchiveTab) {
      const responsesArchives = responsesArchiveTab.querySelector('.archives');
      const responsesArchivesList = responsesArchives.querySelector('.section');
      if (responses.length > 0) {
        responsesArchiveTab.querySelector('#no-archive').setAttribute('hidden', '');
        responsesArchives.removeAttribute('hidden');
      } else {
        responsesArchiveTab.querySelector('#no-archive').removeAttribute('hidden');
        responsesArchives.setAttribute('hidden', '');
      }
      responsesArchivesList.innerHTML = '';
      responses.sort((a, b) => a.order - b.order).forEach(response => {
        var buttonGrid = document.createElement('div');
        buttonGrid.className = "button-grid inputs";
        buttonGrid.setAttribute('archive-type', 'response');
        buttonGrid.id = response.id;
        buttonGrid.innerHTML = `<button square data-select tooltip="Select Item"><i class="bi bi-circle"></i><i class="bi bi-circle-fill"></i></button>
        <div class="input-group rsmall">
          <div class="space" id="response-container">
            <input type="text" id="response-id-input" value="${response.id}" disabled />
          </div>
        </div>
        <div class="input-group rsmall">
          <div class="space" id="response-container">
            <input type="text" id="response-seat-code-input" value="${response.seatCode}" disabled />
          </div>
        </div>
        <div class="input-group small">
          <div class="space" id="response-container">
            <input type="text" id="response-segment-question-input" value="${response.segment} / ${response.question_id}" disabled />
          </div>
        </div>
        <div class="input-group">
          <div class="space" id="response-container">
            <textarea rows="1" id="response-response-input" value="${escapeHTML(response.response) || ''}" disabled>${escapeHTML(response.response) || ''}</textarea>
          </div>
        </div>
        <div class="input-group vsmedium">
          <div class="space" id="response-container">
            <input type="text" id="response-status-input" value="${response.status || ''}" disabled />
          </div>
        </div>
        <div class="input-group rsmall">
          <div class="space" id="response-container">
            <input type="text" id="response-flagged-input" value="${response.flagged || ''}" disabled />
          </div>
        </div>
        <div class="input-group medium">
          <div class="space" id="response-container">
            <input type="text" id="response-timestamp-input" value="${response.timestamp ? time.unixToString(response.timestamp) : ''}" disabled />
          </div>
        </div>
        <button square data-restore-item tooltip="Restore Item"><i class="bi bi-arrow-counterclockwise"></i></button>`;
        responsesArchivesList.appendChild(buttonGrid);
      });
      responsesArchivesList.querySelectorAll('[data-restore-item]').forEach(item => item.addEventListener('click', unarchiveModal));
    }
    expandedReports.forEach(er => {
      if (document.getElementById(er)) document.getElementById(er).classList.add('active');
    });
    document.querySelectorAll('#mark-correct-button').forEach(a => a.addEventListener('click', markCorrect));
    document.querySelectorAll('#mark-incorrect-button').forEach(a => a.addEventListener('click', markIncorrect));
    document.querySelectorAll('[data-flag-response]').forEach(a => a.addEventListener('click', flagResponse));
    document.querySelectorAll('[data-unflag-response]').forEach(a => a.addEventListener('click', unflagResponse));
    document.querySelectorAll('[data-edit-reason]').forEach(a => a.addEventListener('click', editReason));
    document.querySelectorAll('[report]').forEach(a => a.addEventListener('click', toggleDetailedReport));
    document.querySelectorAll('[data-select]').forEach(a => a.addEventListener('click', toggleSelected));
    if (!loadedSegmentEditor && !loadedSegmentCreator) ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
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
    ui.setUnsavedChanges(true);
    fetch(domain + '/flag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        question_id: this.parentElement.querySelector('#response-id-input').value,
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
        ui.setUnsavedChanges(false);
        ui.toast("Flagged response for review.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function unflagResponse() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/unflag', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        question_id: this.parentElement.querySelector('#response-id-input').value,
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
        ui.setUnsavedChanges(false);
        ui.toast("Unflagged response.", 3000, "success", "bi bi-flag-fill");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function markCorrect() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/mark_correct', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        question_id: this.parentElement.querySelector('#response-question-id-input').value,
        single_response: this.parentElement.querySelector('#response-id-input').value,
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        noReloadCourse = true;
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
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
        defaultValue: (Object.keys(lastMarkedQuestion).length && (String(lastMarkedQuestion.question_id) === this.parentElement.querySelector('#response-question-id-input').value)) ? lastMarkedQuestion.reason : '',
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
    ui.setUnsavedChanges(true);
    fetch(domain + '/mark_incorrect', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        question_id: e.parentElement.querySelector('#response-question-id-input').value,
        single_response: e.parentElement.querySelector('#response-id-input').value,
        reason: reason
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully updated status.", 3000, "success", "bi bi-check-lg");
        lastMarkedQuestion = {
          question_id: e.parentElement.querySelector('#response-question-id-input').value,
          single_response: e.parentElement.querySelector('#response-id-input').value,
          reason: reason
        };
        noReloadCourse = true;
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function editReason() {
    if (!active) return;
    ui.modal({
      title: 'Edit Reason',
      body: '<p>Edit your reason that this response is incorrect.</p>',
      input: {
        type: 'text',
        placeholder: responses.find(r => String(r.id) === this.parentElement.querySelector('#response-id-input').value).reason || '',
        defaultValue: responses.find(r => String(r.id) === this.parentElement.querySelector('#response-id-input').value).reason || '',
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

  function toggleSpeedMode() {
    if (!active) return;
    if (!speed) {
      ui.view("speed");
      document.getElementById("speed-mode-starting-question")?.focus();
      document.getElementById("speed-mode-starting-question")?.setSelectionRange(0, document.getElementById("speed-mode-starting-question")?.value.length);
      return;
    }
    speed = false;
    document.querySelector('[data-speed] .bi-lightning-charge').style.display = "block";
    document.querySelector('[data-speed] .bi-lightning-charge-fill').style.display = "none";
  }

  function updateSpeedModeSegments() {
    document.getElementById("speed-mode-segments").innerHTML = '';
    segments.forEach(segment => {
      var option = document.createElement('option');
      option.value = segment.id;
      option.innerHTML = segment.name;
      if (document.location.search.split('?segment=')[1] && (document.location.search.split('?segment=')[1] === String(segment.id))) option.selected = true;
      document.getElementById("speed-mode-segments").appendChild(option);
    });
  }

  function updateSpeedModeStartingQuestion() {
    const lastQuestionId = (questions.length > 0) ? questions.sort((a, b) => a.id - b.id)[questions.length - 1]?.id : -1;
    document.getElementById("speed-mode-starting-question-id").value = ((lastQuestionId !== undefined && lastQuestionId !== null) ? lastQuestionId : -1) + 1;
    document.getElementById("speed-mode-starting-question-id").min = ((lastQuestionId !== undefined && lastQuestionId !== null) ? lastQuestionId : -1) + 1;
    document.getElementById("speed-mode-starting-question").value = String(questions.sort((a, b) => a.id - b.id)[questions.length - 1]?.number || questions.sort((a, b) => a.id - b.id)[questions.length - 1]?.id || 0).replace(/(\d+)([a-z]*)$/, (match, num, suffix) => {
      return !suffix ? (parseInt(num, 10) + 1).toString() : ((suffix === 'z') ? ((parseInt(num, 10) + 1) + 'a') : (num + String.fromCharCode(suffix.charCodeAt(0) + 1)));
    });
  }

  function enableSpeedMode() {
    ui.view();
    speed = true;
    document.querySelector('[data-speed] .bi-lightning-charge').style.display = "none";
    document.querySelector('[data-speed] .bi-lightning-charge-fill').style.display = "block";
    var segmentId = 0;
    var startingQuestionId = null;
    var startingQuestion = null;
    if (!document.getElementById("speed-mode-segments") && !document.getElementById("speed-mode-starting-question-id")) return;
    if (document.getElementById("speed-mode-segments")) segmentId = document.getElementById("speed-mode-segments").value;
    if (document.getElementById("speed-mode-starting-question-id")) {
      startingQuestionId = document.getElementById("speed-mode-starting-question-id").value;
      startingQuestion = document.getElementById("speed-mode-starting-question").value;
    }
    renderSpeedPond(segmentId, startingQuestionId, startingQuestion);
  }

  function disableSpeedMode() {
    ui.view();
    speed = false;
    document.querySelector('[data-speed] .bi-lightning-charge').style.display = "block";
    document.querySelector('[data-speed] .bi-lightning-charge-fill').style.display = "none";
    ui.modeless(`<i class="bi bi-check2-circle"></i>`, "Speed Mode Ended");
  }

  async function renderSpeedPond(segment = 0, startingQuestionId, startingQuestion) {
    if (!active) return;
    const url = `/admin/upload?segment=${segment}${(startingQuestionId && startingQuestion) ? `&startingQuestionId=${startingQuestionId}&startingQuestion=${startingQuestion}` : ''}`;
    const width = 600;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
    const newWindow = window.open(url, '_blank', windowFeatures);
    let uploadSuccessful = false;
    window.addEventListener('message', (event) => {
      if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      if (event.data === 'uploadSuccess') uploadSuccessful = true;
    }, false);
    const checkWindowClosed = setInterval(async function () {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindowClosed);
        if (uploadSuccessful) {
          ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
          if (startingQuestionId && startingQuestion) {
            renderSpeedPond(segment, Number(startingQuestionId) + 1, startingQuestion.replace(/(\d+)([a-z]*)$/, (match, num, suffix) => {
              return !suffix ? (parseInt(num, 10) + 1).toString() : ((suffix === 'z') ? ((parseInt(num, 10) + 1) + 'a') : (num + String.fromCharCode(suffix.charCodeAt(0) + 1)));
            }));
          } else {
            renderSpeedPond(segment);
          }
          await init();
          if ((segment === 0) && startingQuestionId) addExistingQuestion(startingQuestionId);
        } else {
          init();
        }
        disableSpeedMode();
      }
    }, 1000);
  }

  async function renderSyllabusPond() {
    if (!active) return;
    await save(null, true);
    const url = '/admin/upload?syllabus=' + document.getElementById("course-period-input").value;
    const width = 600;
    const height = 150;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
    const newWindow = window.open(url, '_blank', windowFeatures);
    let uploadSuccessful = false;
    window.addEventListener('message', (event) => {
      if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      if (event.data === 'uploadSuccess') uploadSuccessful = true;
    }, false);
    const checkWindowClosed = setInterval(function () {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindowClosed);
        if (uploadSuccessful) {
          ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
        } else {
          ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, "Upload Cancelled");
        }
        init();
      }
    }, 1000);
  }

  async function renderAnnouncementPond(platform) {
    if (!active) return;
    if (!platform) return;
    await save(null, true);
    const url = '/admin/upload?course=' + document.getElementById("course-period-input").value + '&platform=' + platform;
    const width = 600;
    const height = 150;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
    const newWindow = window.open(url, '_blank', windowFeatures);
    let uploadSuccessful = false;
    window.addEventListener('message', (event) => {
      if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      if (event.data === 'uploadSuccess') uploadSuccessful = true;
    }, false);
    const checkWindowClosed = setInterval(function () {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindowClosed);
        if (uploadSuccessful) {
          ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
        } else {
          ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, "Upload Cancelled");
        }
        init();
      }
    }, 1000);
  }

  function sortSegmentsDue() {
    if (!active) return;
    document.getElementById('sort-segments-types').value = 'due';
    return ui.view("sort-segments");
  }

  function sortSegmentsIncreasing() {
    if (!active) return;
    document.getElementById('sort-segments-types').value = 'az';
    return ui.view("sort-segments");
  }

  function sortSegmentsDecreasing() {
    if (!active) return;
    document.getElementById('sort-segments-types').value = 'za';
    return ui.view("sort-segments");
  }

  async function sortSegments(event, sortAs) {
    if (!active) return;
    await settingsPush('sort-segments', sortAs || document.getElementById('sort-segments-types').value);
    await save(null, true);
    var updatedSegments = [...segments];
    switch (sortAs || document.getElementById('sort-segments-types').value) {
      case 'az':
        updatedSegments.sort((a, b) => {
          const nameA = String(a.number);
          const nameB = String(b.number);
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        break;
      case 'za':
        updatedSegments.sort((a, b) => {
          const nameA = String(a.number);
          const nameB = String(b.number);
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        updatedSegments.reverse();
        break;
      default:
        updatedSegments.sort((a, b) => {
          const dueA = a.due ? new Date(a.due) : null;
          const dueB = b.due ? new Date(b.due) : null;
          if (!dueA && dueB) return 1;
          if (dueA && !dueB) return -1;
          if (!dueA && !dueB) return 0;
          if (dueA < dueB) return -1;
          if (dueA > dueB) return 1;
          return 0;
        });
        break;
    }
    for (let i = 0; i < updatedSegments.length; i++) {
      updatedSegments[i].order = i;
    }
    ui.setUnsavedChanges(true);
    if (sortAs) return updatedSegments;
    fetch(domain + '/segments', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        segments: updatedSegments,
      })
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
      .then(c => {
        ui.setUnsavedChanges(false);
        segments = c;
        updateSegments();
        ui.view();
        ui.toast("Successfully sorted segments.", 3000, "success", "bi bi-sort-down");
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  document.querySelectorAll('[sort-segment-questions-increasing]').forEach(a => a.addEventListener('click', sortSegmentQuestionsIncreasing));
  document.querySelectorAll('[sort-segment-questions-decreasing]').forEach(a => a.addEventListener('click', sortSegmentQuestionsDecreasing));
  document.querySelectorAll('[sort-segment-questions-number-increasing]').forEach(a => a.addEventListener('click', sortSegmentQuestionsNumberIncreasing));
  document.querySelectorAll('[sort-segment-questions-number-decreasing]').forEach(a => a.addEventListener('click', sortSegmentQuestionsNumberDecreasing));

  function sortSegmentQuestionsIncreasing() {
    if (!active) return;
    sortSegmentQuestions('19');
  }

  function sortSegmentQuestionsDecreasing() {
    if (!active) return;
    sortSegmentQuestions('91');
  }

  function sortSegmentQuestionsNumberIncreasing() {
    if (!active) return;
    sortSegmentQuestions('az');
  }

  function sortSegmentQuestionsNumberDecreasing() {
    if (!active) return;
    sortSegmentQuestions('za');
  }

  function sortSegmentQuestions(type) {
    if (!active) return;
    var updatedQuestions = [...document.getElementById("question-list").children].filter(q => q.classList.contains('question'));
    switch (type) {
      case '19':
        updatedQuestions.sort((a, b) => Number(a.id.split('questionList-')[1]) - Number(b.id.split('questionList-')[1]));
        break;
      case '91':
        updatedQuestions.sort((a, b) => Number(b.id.split('questionList-')[1]) - Number(a.id.split('questionList-')[1]));
        break;
      case 'az':
        updatedQuestions.sort((a, b) => {
          const nameA = a.querySelector('.small input').value;
          const nameB = b.querySelector('.small input').value;
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        break;
      case 'za':
        updatedQuestions.sort((a, b) => {
          const nameA = a.querySelector('.small input').value;
          const nameB = b.querySelector('.small input').value;
          const numA = parseInt(nameA.match(/\d+/) ? nameA.match(/\d+/)[0] : '0');
          const numB = parseInt(nameB.match(/\d+/) ? nameB.match(/\d+/)[0] : '0');
          const alphaA = (nameA.match(/[a-zA-Z]+/) || [''])[0];
          const alphaB = (nameB.match(/[a-zA-Z]+/) || [''])[0];
          if (numA !== numB) return numA - numB;
          if (alphaA < alphaB) return -1;
          if (alphaA > alphaB) return 1;
          return 0;
        });
        updatedQuestions.reverse();
        break;
      default:
        break;
    }
    var updatedQuestionsString = `<div class="button-grid inputs">
      <div class="input-group">
        <label>Question</label>
      </div>
      <div class="input-group small">
        <label>As</label>
      </div>
      <div square hidden-spacer></div>
    </div>`;
    for (let i = 0; i < updatedQuestions.length; i++) {
      updatedQuestions[i].querySelectorAll('input').forEach(input => {
        input.setAttribute('value', input.value);
      });
      updatedQuestionsString += updatedQuestions[i].outerHTML;
    }
    document.getElementById("question-list").innerHTML = updatedQuestionsString;
    document.querySelectorAll('#remove-existing-question-button').forEach(a => a.addEventListener('click', removeExistingQuestion));
    document.getElementById("add-existing-question-button").disabled = (document.getElementById("add-question-input").children.length === 0) ? true : false;
    if (draggableQuestionList) draggableQuestionList.destroy();
    draggableQuestionList = createSwapy(document.getElementById("question-list"), {
      animation: 'none'
    });
    ui.setUnsavedChanges(true);
    ui.reloadUnsavedInputs();
  }

  function toggleDetailedReport() {
    if (!active || !this.getAttribute('report') || !document.getElementById(this.getAttribute('report'))) return;
    document.getElementById(this.getAttribute('report')).classList.toggle('active');
    syncExpandAllReportsButton();
  }

  function syncExpandAllReportsButton() {
    if (!active) return;
    expandedReports = [];
    document.querySelectorAll('.detailed-report.active').forEach(dr => expandedReports.push(dr.id));
    var openReports = document.querySelectorAll('.detailed-report.active');
    if (openReports.length > 0) {
      document.querySelector('[data-expand-reports] .bi-chevron-bar-expand').style.display = "none";
      document.querySelector('[data-expand-reports] .bi-chevron-bar-contract').style.display = "block";
    } else {
      document.querySelector('[data-expand-reports] .bi-chevron-bar-expand').style.display = "block";
      document.querySelector('[data-expand-reports] .bi-chevron-bar-contract').style.display = "none";
    }
  }

  function toggleAllReports() {
    if (!active) return;
    var reports = document.querySelectorAll('.detailed-report');
    var openReports = document.querySelectorAll('.detailed-report.active');
    reports.forEach(report => {
      (openReports.length > 0) ? report.classList.remove('active') : report.classList.add('active');
    });
    syncExpandAllReportsButton();
  }

  function updateQuestionReports() {
    expandedReports = [];
    document.querySelectorAll('.detailed-report.active').forEach(dr => expandedReports.push(dr.id));
    if (!document.querySelector('.question-reports') || (questions.length === 0)) return;
    document.querySelector('.question-reports').innerHTML = '';
    const course = courses.find(c => document.getElementById("course-period-input") ? (String(c.id) === document.getElementById("course-period-input").value) : null);
    var courseQuestions = [];
    segments.filter(s => String(s.course) === String(course?.id)).filter(s => document.getElementById("filter-segment-input")?.value ? (String(s.id) === document.getElementById("filter-segment-input").value) : true).forEach(segment => {
      JSON.parse(segment.question_ids).filter(q => questions.find(q1 => String(q1.id) === String(q.id))?.number.startsWith(document.getElementById("sort-question-input")?.value)).forEach(questionId => {
        const question = questions.find(q => String(q.id) === String(questionId.id));
        if (question) courseQuestions.push(question);
      });
    });
    courseQuestions.filter(q => q.number.startsWith(document.getElementById("sort-question-input")?.value)).sort((a, b) => document.getElementById("filter-segment-input")?.value ? 0 : (a.id - b.id)).forEach(question => {
      var questionResponses = responses.filter(r => r.question_id === question.id).filter(r => JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).periods).includes(Number(String(r.seatCode)[0]))).filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value));
      if (document.getElementById('hideIncorrectAttempts').checked) questionResponses = questionResponses.filter((r, index, self) => r.status === 'Correct' || !self.some(other => other.question_id === r.question_id && other.status === 'Correct'));
      if (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') === 'first') {
        questionResponses = questionResponses.filter(r => r.id === Math.min(...questionResponses.filter(r1 => r1.seatCode === r.seatCode && r1.question_id === r.question_id).map(r1 => r1.id)));
      } else if (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') === 'last') {
        questionResponses = questionResponses.filter(r => r.id === Math.max(...questionResponses.filter(r1 => r1.seatCode === r.seatCode && r1.question_id === r.question_id).map(r1 => r1.id)));
      }
      var detailedReport = '';
      switch (document.querySelector('#sort-report-responses [aria-selected="true"]').getAttribute('data-value')) {
        case 'seatCode':
          questionResponses = questionResponses.sort((a, b) => a.seatCode - b.seatCode);
          break;
        case 'studentName':
          questionResponses = questionResponses.sort((a, b) => {
            var nameA = "Unknown";
            var nameB = "Unknown";
            if (document.getElementById('useRoster').checked) {
              var roster = rosters.find(roster => roster.period === Number(String(a.seatCode)[0]));
              if (roster) {
                var studentA = JSON.parse(roster.data).find(student => String(student.seatCode) === String(a.seatCode));
                if (studentA) nameA = `${studentA.last}, ${studentA.first}`;
                var studentB = JSON.parse(roster.data).find(student => String(student.seatCode) === String(b.seatCode));
                if (studentB) nameB = `${studentB.last}, ${studentB.first}`;
              }
            }
            return nameA.localeCompare(nameB);
          });
          break;
      }
      questionResponses.forEach(r => {
        var name = "Unknown";
        if (document.getElementById('useRoster').checked) {
          var roster = rosters.find(roster => roster.period === Number(String(r.seatCode)[0]));
          if (roster) {
            var student = JSON.parse(roster.data).find(student => String(student.seatCode) === String(r.seatCode));
            if (student) name = `${student.last}, ${student.first}`;
          }
        }
        const currentDate = new Date(r.timestamp);
        var timeTaken = "N/A";
        const sameSeatCodeResponses = responses
          .filter(r => courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value)?.periods).includes(Number(String(r.seatCode)[0])) : false)
          .filter(r => document.getElementById("filter-segment-input")?.value ? (String(segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)) ? (segments.find(s => (String(s.id) === String(r.segment)) && (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : true)).id || r.segment) : (segments.find(s => (courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value) ? (String(s.course) === String(courses.find(course => String(course.id) === document.getElementById("course-period-input")?.value).id)) : false) && JSON.parse(s.question_ids || [])?.find(q => String(q.id) === String(r.question_id)))?.id || '-')) === document.getElementById("filter-segment-input").value) : true)
          .filter(r => questions.find(q => String(q.id) === String(r.question_id))?.number.startsWith(document.getElementById("sort-question-input")?.value))
          .filter(r => String(r.seatCode).startsWith(document.getElementById("sort-seat-input")?.value))
          .sort((a, b) => {
            if (a.flagged && !b.flagged) return -1;
            if (!a.flagged && b.flagged) return 1;
            return b.id - a.id;
          })
          .filter(a => a.seatCode === r.seatCode)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const lastResponseIndex = sameSeatCodeResponses.findIndex(a => new Date(a.timestamp) >= currentDate) - 1;
        const lastResponse = lastResponseIndex >= 0 ? sameSeatCodeResponses[lastResponseIndex] : null;
        let timeDifference;
        if (lastResponse) {
          timeDifference = calculateTimeDifference(currentDate, lastResponse.timestamp);
          timeTaken = formatTimeDifference(timeDifference);
        }
        detailedReport += `<div class="detailed-report-question">
          <div class="color">
            <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
            <span class="color-name">${document.getElementById('useRoster').checked ? `${name} (${r.seatCode})` : r.seatCode}<p class="showonhover"> (${time.unixToString(r.timestamp)})</p>: ${escapeHTML(r.response)}</span>
          </div>
          <div class="color">
            <span class="color-name">${timeTaken}</span>
            <span class="color-box ${(r.status === 'Correct') ? 'correct' : (r.status === 'Incorrect') ? 'incorrect' : r.status.includes('Recorded') ? 'waiting' : 'other'}"></span>
          </div>
        </div>`
      });
      var total = questionResponses.length || 1;
      var unansweredStudentsCount = 0;
      if (document.getElementById('useRoster').checked && (document.querySelector('#filter-report-responses [aria-selected="true"]').getAttribute('data-value') !== 'all') && !document.getElementById('hideUnanswered').checked) {
        var courseRosters = rosters.filter(roster => JSON.parse(courses.find(course => String(course.id) === document.getElementById("course-period-input").value)?.periods).includes(Number(String(roster.period))));
        var totalRosterStudents = [...new Set(courseRosters.flatMap(a => JSON.parse(a.data).map(b => Number(b.seatCode))))];
        if (totalRosterStudents.length) {
          var answeredStudentsCount = [...new Set(questionResponses.flatMap(a => a.seatCode).filter(x => totalRosterStudents.includes(x)))].length;
          unansweredStudentsCount = totalRosterStudents.length - answeredStudentsCount;
          total = questionResponses.length + unansweredStudentsCount;
        }
      }
      document.querySelector('.question-reports').innerHTML += `<div class="detailed-report-question"${(questionResponses.length != 0) ? ` report="question-${question.id}"` : ''}>
        <b>Question ${question.number} (${questionResponses.length} Response${(questionResponses.length != 1) ? 's' : ''})</b>
        <div class="barcount-wrapper">
          ${(questionResponses.filter(r => r.status === 'Correct').length != 0) ? `<div class="barcount correct" style="width: calc(${questionResponses.filter(r => r.status === 'Correct').length / total} * 100%)">${questionResponses.filter(r => r.status === 'Correct').length}</div>` : ''}
          ${((questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount) != 0) ? `<div class="barcount other" style="width: calc(${(questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount) / total} * 100%)">${questionResponses.filter(r => ((r.status !== 'Correct') && (r.status !== 'Incorrect') && !r.status.includes('Recorded'))).length + unansweredStudentsCount}</div>` : ''}
          ${(questionResponses.filter(r => r.status.includes('Recorded')).length != 0) ? `<div class="barcount waiting" style="width: calc(${questionResponses.filter(r => r.status.includes('Recorded')).length / total} * 100%)">${questionResponses.filter(r => r.status.includes('Recorded')).length}</div>` : ''}
          ${(questionResponses.filter(r => r.status === 'Incorrect').length != 0) ? `<div class="barcount incorrect" style="width: calc(${questionResponses.filter(r => r.status === 'Incorrect').length / total} * 100%)">${questionResponses.filter(r => r.status === 'Incorrect').length}</div>` : ''}
        </div>
      </div>
      ${(questionResponses.length != 0) ? `<div class="section detailed-report" id="question-${question.id}">
        ${detailedReport}
      </div>` : ''}`;
    });
    expandedReports.forEach(er => {
      if (document.getElementById(er)) document.getElementById(er).classList.add('active');
    });
    document.querySelectorAll('[report]').forEach(a => a.addEventListener('click', toggleDetailedReport));
    if (!loadedSegmentEditor && !loadedSegmentCreator) ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  function addExistingQuestion(question) {
    if (!active) return;
    var div = document.createElement('div');
    var inner = document.createElement('div');
    div.classList = "button-grid inputs question";
    inner.classList = "button-grid";
    if (typeof question === 'string') var addingQuestion = questions.find(q => String(q.id) === String(question));
    if (loadedSegment && (typeof question === 'string') && JSON.parse(loadedSegment.question_ids).find(q => String(q.id) === String(question))) {
      if (!addingQuestion) return;
      document.getElementById("add-question-input").value = addingQuestion.id;
      div.id = `questionList-${addingQuestion.id}`;
      div.setAttribute("data-swapy-slot", `questionList-${addingQuestion.id}`);
      inner.setAttribute("data-swapy-item", `questionList-${addingQuestion.id}`);
      inner.innerHTML = `<div class="drag" data-swapy-handle><i class="bi bi-grip-vertical"></i></div>
      <div class="input-group">
        <div class="space" id="question-container">
          <input type="text" id="${addingQuestion.id}" value="ID ${addingQuestion.id} #${addingQuestion.number} - ${addingQuestion.question}" disabled>
        </div>
      </div>
      <div class="input-group small">
        <div class="space" id="question-container">
          <input type="text" value="${JSON.parse(loadedSegment.question_ids).find(q => String(q.id) === String(question)).name}">
        </div>
      </div>
      <button class="space" id="remove-existing-question-button" square tooltip="Remove Question"><i class="bi bi-trash"></i></button>`;
      if (window.innerWidth >= 1400) {
        inner.addEventListener('mouseenter', () => {
          var question = addingQuestion;
          island(inner, null, 'question', {
            sourceId: String(question.id),
            id: `ID ${question.id}`,
            title: `Question ${question.number}`,
            subtitle: `${question.question}`,
            subtitleLatex: question.latex,
            description: question.description,
            attachments: question.images,
            lists: [
              {
                title: 'Correct Answers',
                items: answers.find(a => a.id === question.id).correct_answers
              },
              {
                title: 'Incorrect Answers',
                items: answers.find(a => a.id === question.id).incorrect_answers
              },
            ],
          }, answers);
        });
        inner.addEventListener('mouseleave', () => {
          island();
        });
      }
    } else if (loadedSegmentCreator && (typeof question === 'string')) {
      if (!addingQuestion) return;
      document.getElementById("add-question-input").value = addingQuestion.id;
      div.id = `questionList-${addingQuestion.id}`;
      div.setAttribute("data-swapy-slot", `questionList-${addingQuestion.id}`);
      inner.setAttribute("data-swapy-item", `questionList-${addingQuestion.id}`);
      inner.innerHTML = `<div class="drag" data-swapy-handle><i class="bi bi-grip-vertical"></i></div>
      <div class="input-group">
        <div class="space" id="question-container">
          <input type="text" id="${addingQuestion.id}" value="ID ${addingQuestion.id} #${addingQuestion.number} - ${addingQuestion.question}" disabled>
        </div>
      </div>
      <div class="input-group small">
        <div class="space" id="question-container">
          <input type="text" value="${addingQuestion.number}">
        </div>
      </div>
      <button class="space" id="remove-existing-question-button" square tooltip="Remove Question"><i class="bi bi-trash"></i></button>`;
      if (window.innerWidth >= 1400) {
        inner.addEventListener('mouseenter', () => {
          var question = addingQuestion;
          island(inner, null, 'question', {
            sourceId: String(question.id),
            id: `ID ${question.id}`,
            title: `Question ${question.number}`,
            subtitle: `${question.question}`,
            subtitleLatex: question.latex,
            description: question.description,
            attachments: question.images,
            lists: [
              {
                title: 'Correct Answers',
                items: answers.find(a => a.id === question.id).correct_answers
              },
              {
                title: 'Incorrect Answers',
                items: answers.find(a => a.id === question.id).incorrect_answers
              },
            ],
          }, answers);
        });
        inner.addEventListener('mouseleave', () => {
          island();
        });
      }
    } else if (this) {
      if (!document.getElementById("add-question-input").selectedOptions[0]) return;
      var questionId = document.getElementById("add-question-input").value;
      div.id = `questionList-${questionId}`;
      div.setAttribute("data-swapy-slot", `questionList-${questionId}`);
      inner.setAttribute("data-swapy-item", `questionList-${questionId}`);
      inner.innerHTML = `<div class="drag" data-swapy-handle><i class="bi bi-grip-vertical"></i></div>
      <div class="input-group">
        <div class="space" id="question-container">
          <input type="text" id="${questionId}" value="${document.getElementById("add-question-input").selectedOptions[0].innerHTML}" disabled>
        </div>
      </div>
      <div class="input-group small">
        <div class="space" id="question-container">
          <input type="text" value="${document.getElementById("add-question-input").selectedOptions[0].innerHTML.split('#')[1].split(' ')[0]}">
        </div>
      </div>
      <button class="space" id="remove-existing-question-button" square tooltip="Remove Question"><i class="bi bi-trash"></i></button>`;
      if (window.innerWidth >= 1400) {
        inner.addEventListener('mouseenter', () => {
          var question = questions.find(q => String(q.id) === String(questionId));
          island(inner, null, 'question', {
            sourceId: String(question.id),
            id: `ID ${question.id}`,
            title: `Question ${question.number}`,
            subtitle: `${question.question}`,
            subtitleLatex: question.latex,
            description: question.description,
            attachments: question.images,
            lists: [
              {
                title: 'Correct Answers',
                items: answers.find(a => a.id === question.id).correct_answers
              },
              {
                title: 'Incorrect Answers',
                items: answers.find(a => a.id === question.id).incorrect_answers
              },
            ],
          }, answers);
        });
        inner.addEventListener('mouseleave', () => {
          island();
        });
      }
      document.getElementById("add-question-input").removeChild(document.getElementById("add-question-input").selectedOptions[0]);
    } else {
      var newQuestion = document.getElementById("add-question-input").children[document.getElementById("add-question-input").children.length - 1];
      div.id = `questionList-${newQuestion.value}`;
      div.setAttribute("data-swapy-slot", `questionList-${newQuestion.value}`);
      inner.setAttribute("data-swapy-item", `questionList-${newQuestion.value}`);
      inner.innerHTML = `<div class="drag" data-swapy-handle><i class="bi bi-grip-vertical"></i></div>
      <div class="input-group">
        <div class="space" id="question-container">
          <input type="text" id="${newQuestion.value}" value="${newQuestion.innerHTML}" disabled>
        </div>
      </div>
      <div class="input-group small">
        <div class="space" id="question-container">
          <input type="text" value="${newQuestion.innerHTML.split('#')[1].split(' ')[0]}">
        </div>
      </div>
      <button class="space" id="remove-existing-question-button" square tooltip="Remove Question"><i class="bi bi-trash"></i></button>`;
      document.getElementById("add-question-input").removeChild(document.getElementById("add-question-input").children[document.getElementById("add-question-input").children.length - 1]);
    }
    div.appendChild(inner);
    document.getElementById("question-list").appendChild(div);
    document.querySelectorAll('#remove-existing-question-button').forEach(a => a.addEventListener('click', removeExistingQuestion));
    document.getElementById("add-existing-question-button").disabled = (document.getElementById("add-question-input").children.length === 0) ? true : false;
    if (draggableQuestionList) draggableQuestionList.destroy();
    draggableQuestionList = createSwapy(document.getElementById("question-list"), {
      animation: 'none'
    });
    ui.setUnsavedChanges(true);
    ui.reloadUnsavedInputs();
  }

  function removeExistingQuestion() {
    if (!active) return;
    const option = document.createElement("option");
    option.value = this.parentElement.querySelector('input').id;
    option.innerHTML = this.parentElement.querySelector('input').value;
    document.getElementById("add-question-input").appendChild(option);
    this.parentElement.parentElement.remove();
    let select = document.getElementById("add-question-input");
    let options = Array.from(select.options);
    options.sort((a, b) => a.value.localeCompare(b.value));
    select.innerHTML = "";
    options.forEach(option => select.add(option));
    document.getElementById("add-existing-question-button").disabled = (document.getElementById("add-question-input").children.length === 0) ? true : false;
    ui.setUnsavedChanges(true);
    ui.reloadUnsavedInputs();
  }

  function createSegment() {
    if (!active) return;
    const course = document.getElementById("course-period-input");
    const number = document.getElementById("segment-number-input");
    const name = document.getElementById("segment-name-input");
    const due = document.getElementById("segment-due-date-input").value || null;
    course.classList.remove("attention");
    number.classList.remove("attention");
    name.classList.remove("attention");
    if (!course.value) {
      course.classList.add("attention");
      return course.focus();
    } else if (!number.value) {
      number.classList.add("attention");
      return number.focus();
    } else if (!name.value) {
      name.classList.add("attention");
      return name.focus();
    }
    document.querySelector("#create-button").disabled = true;
    const question_ids = JSON.stringify(Array.from(document.querySelectorAll('.question')).filter(q => (q.querySelectorAll('input')[1].value.length > 0) && (q.querySelectorAll('input')[1].value != ' ')).map(q => {
      return {
        name: q.querySelectorAll('input')[1].value,
        id: q.querySelectorAll('input')[0].id
      };
    }));
    ui.toast(loadedSegmentEditor ? "Updating segment..." : "Creating segment...", 3000, "info", loadedSegmentEditor ? "bi bi-floppy-fill" : "bi bi-plus-circle-fill");
    ui.setUnsavedChanges(true);
    fetch(domain + '/segment', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        segment: {
          course: course.value,
          number: number.value,
          name: name.value,
          due,
          question_ids,
          editing_segment: loadedSegmentEditor ? new URLSearchParams(window.location.search).get('segment') : null,
        },
      })
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
        ui.setUnsavedChanges(false);
        ui.toast(loadedSegmentEditor ? "Segment updated successfully." : "Segment created successfully.", 3000, "success", "bi bi-check-circle-fill");
        editSegment(null, loadedSegmentEditor ? loadedSegment.id : null);
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function loadSegmentEditor() {
    if (loadedSegmentEditor) return;
    var segment = new URLSearchParams(window.location.search).get('segment');
    if (!segment) {
      loadedSegmentCreator = true;
      document.querySelector('[data-delete-segment]')?.remove();
      document.querySelector('[data-archive-segment]')?.remove();
      document.querySelector('[edit-segment-questions]')?.remove();
      ui.setUnsavedChanges(false);
      ui.reloadUnsavedInputs();
      return;
    }
    loadedSegment = segments.find(s => String(s.id) === String(segment));
    if (!loadedSegment) {
      loadedSegmentCreator = true;
      ui.toast(`Segment ${String(segment)} not found.`, 3000, "error", "bi bi-exclamation-triangle-fill");
      document.querySelector('[data-delete-segment]')?.remove();
      document.querySelector('[data-archive-segment]')?.remove();
      document.querySelector('[edit-segment-questions]')?.remove();
      ui.setUnsavedChanges(false);
      ui.reloadUnsavedInputs();
      return;
    }
    loadedSegmentEditor = true;
    active = true;
    document.getElementById("course-period-input").value = loadedSegment.course;
    document.getElementById("segment-number-input").value = loadedSegment.number;
    document.getElementById("segment-name-input").value = loadedSegment.name;
    document.getElementById("segment-due-date-input").value = loadedSegment.due;
    JSON.parse(loadedSegment.question_ids).forEach(q => addExistingQuestion(q.id));
    document.getElementById("create-button").innerText = "Save";
    document.querySelector('[data-delete-segment]')?.addEventListener('click', deleteSegmentConfirm);
    document.querySelector('[edit-segment-questions]')?.addEventListener('click', () => {
      if (ui.unsavedChanges) return ui.toast("You have unsaved changes. Please save or discard them before editing questions.", 3000, "error", "bi bi-exclamation-triangle-fill");
      const url = `/admin/questions?segment=${loadedSegment.id}`;
      const width = window.outerWidth;
      const height = window.outerHeight;
      const left = window.screenLeft;
      const top = window.screenTop;
      const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
      const newWindow = window.open(url, '_blank', windowFeatures);
      window.addEventListener('message', (event) => {
        if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      }, false);
      const checkWindowClosed = setInterval(async function () {
        if (newWindow && newWindow.closed) {
          clearInterval(checkWindowClosed);
          window.location.reload();
        }
      }, 1000);
    });
    ui.setUnsavedChanges(false);
    ui.reloadUnsavedInputs();
  }

  function deleteSegmentConfirm() {
    ui.modal({
      title: 'Delete Segment',
      body: '<p>Are you sure you want to delete this segment? This action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Delete',
          class: 'submit-button',
          onclick: () => {
            deleteSegment();
          },
          close: true,
        },
      ],
    });
  }

  function deleteSegment() {
    ui.setUnsavedChanges(true);
    fetch(domain + '/segment', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        segment: loadedSegment.id,
      })
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
        ui.setUnsavedChanges(false);
        ui.toast("Segment deleted successfully.", 3000, "success", "bi bi-trash-fill");
        window.location.href = '/admin/';
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function newCourseModal(inputValues) {
    if (!active) return;
    ui.modal({
      title: 'New Course',
      body: '<p>Create a new course to add segments to.</p>',
      inputs: [{
        type: 'text',
        placeholder: 'Name',
        defaultValue: inputValues[0] || '',
      },
      {
        type: 'number',
        placeholder: 'Assign to a period?',
        defaultValue: inputValues[1] || '',
        min: 1,
        max: 9,
      }],
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: (inputValues) => {
            newCourse(inputValues, this);
          },
          close: true,
        },
      ],
    });
  }

  function newCourse(inputValues) {
    if (!active) return;
    if (!inputValues[0]) {
      ui.toast("Please enter a course name.", 3000, "error", "bi bi-exclamation-triangle-fill");
      return newCourseModal(inputValues);
    }
    if (inputValues[1]) inputValues[1] = Number(inputValues[1]);
    if (inputValues[1] && ((inputValues[1] < 1) || (inputValues[1] > 9) || !Number.isInteger(inputValues[1]))) {
      ui.toast("This period is not possible.", 3000, "error", "bi bi-exclamation-triangle-fill");
      return newCourseModal(inputValues);
    }
    if (inputValues[1] && courses.find(course => JSON.parse(course.periods).includes(Number(inputValues[1])))) {
      ui.toast(`This period has been taken by course ${courses.find(course => JSON.parse(course.periods).includes(Number(inputValues[1]))).name}.`, 3000, "error", "bi bi-exclamation-triangle-fill");
      return newCourseModal(inputValues);
    }
    ui.toast("Creating course...", 3000, "info", "bi bi-plus-circle-fill");
    ui.setUnsavedChanges(true);
    fetch(domain + '/course', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        course: {
          name: inputValues[0],
          period: inputValues[1],
        },
      })
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
        ui.setUnsavedChanges(false);
        ui.toast("Course created successfully.", 3000, "success", "bi bi-check-circle-fill");
        return window.location.href = '/admin/';
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function removeAllSegmentsDueDates() {
    if (!active) return;
    const course = courses.find(c => document.getElementById("course-period-input") ? (String(c.id) === document.getElementById("course-period-input").value) : null);
    if (!course) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/due_dates', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        course_id: course.id
      })
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
        ui.setUnsavedChanges(false);
        ui.toast("Segments due dates removed successfully.", 3000, "success", "bi bi-calendar-minus");
        return window.location.href = '/admin/';
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function clearResponsesConfirm1() {
    if (!active) return;
    ui.modal({
      title: 'Clear Responses?',
      body: '<p>This will clear all responses (excluding marked answers) from this course. This action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: () => {
            clearResponsesConfirm2();
          },
          close: true,
        },
      ],
    });
  }

  function clearResponsesConfirm2() {
    if (!active) return;
    ui.modal({
      title: 'Clear Responses?',
      body: '<p>Are you sure? This will clear all responses (excluding marked answers) from this course. This action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: () => {
            clearResponsesConfirm3();
          },
          close: true,
        },
      ],
    });
  }

  function clearResponsesConfirm3() {
    if (!active) return;
    ui.modal({
      title: 'Clear Responses?',
      body: '<p>Are you completely sure? This will clear all responses (excluding marked answers) from this course. This action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: () => {
            clearResponses();
          },
          close: true,
        },
      ],
    });
  }

  function clearResponses() {
    if (!active) return;
    const course = courses.find(c => document.getElementById("course-period-input") ? (String(c.id) === document.getElementById("course-period-input").value) : null);
    if (!course) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/responses', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        course_id: course.id
      })
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
        ui.setUnsavedChanges(false);
        ui.toast("Course responses cleared successfully.", 3000, "success", "bi bi-check-circle-fill");
        return window.location.href = '/admin/responses';
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  async function getSettings(key) {
    if (!active) return;
    return key ? settings[key] : settings;
  }

  async function settingsPush(key, value) {
    if (!active) return;
    await fetch(domain + '/settings', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        key: key,
        value: value
      })
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
      .then(r => {
        return key ? (r[key] || null) : r;
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function updateExportReportCourses() {
    document.getElementById("export-report-course").innerHTML = '<option value="">All Courses</option>';
    courses.forEach(course => {
      var option = document.createElement('option');
      option.value = course.id;
      option.innerHTML = course.name;
      document.getElementById("export-report-course").appendChild(option);
    });
  }

  async function exportReport() {
    if (!active) return;
    this.disabled = true;
    document.getElementById("export-report-course").disabled = true;
    document.getElementById("export-report-period").disabled = true;
    document.getElementById("export-report-start-date").disabled = true;
    document.getElementById("export-report-end-date").disabled = true;
    ui.toast("Generating report...", 3000, "info", "bi bi-download");
    var exportReportOptions = {};
    if (document.getElementById("export-report-course").value) exportReportOptions['course_id'] = document.getElementById("export-report-course").value;
    if (document.getElementById("export-report-period").value) exportReportOptions['period'] = document.getElementById("export-report-period").value;
    if (document.getElementById("export-report-start-date").value) exportReportOptions['start'] = document.getElementById("export-report-start-date").value;
    if (document.getElementById("export-report-end-date").value) exportReportOptions['end'] = document.getElementById("export-report-end-date").value;
    ui.setUnsavedChanges(true);
    await fetch(domain + '/report', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(exportReportOptions)
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
      .then(r => {
        if (!r || !r.filename) {
          ui.toast("Error generating report.", 3000, "error", "bi bi-exclamation-triangle-fill");
          this.disabled = false;
          document.getElementById("export-report-course").disabled = false;
          document.getElementById("export-report-period").disabled = false;
          document.getElementById("export-report-start-date").disabled = false;
          document.getElementById("export-report-end-date").disabled = false;
          ui.setUnsavedChanges(true);
          return;
        }
        ui.setUnsavedChanges(false);
        ui.toast("Report generated successfully.", 3000, "success", "bi bi-check-circle-fill");
        ui.toast(`Downloading ${r.filename.split('/')[r.filename.split('/').length - 1]}...`, 3000, "info", "bi bi-download");
        const link = document.createElement('a');
        link.href = r.filename;
        link.download = r.filename.split('/')[r.filename.split('/').length - 1];
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.disabled = false;
        document.getElementById("export-report-course").disabled = false;
        document.getElementById("export-report-period").disabled = false;
        document.getElementById("export-report-start-date").disabled = false;
        document.getElementById("export-report-end-date").disabled = false;
        ui.toast("Report downloaded successfully.", 3000, "success", "bi bi-check-circle-fill");
        ui.view();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function editUserModal() {
    if (!active) return;
    const user = this.parentElement.parentElement.id;
    const role = this.parentElement.parentElement.querySelector('.role').innerText;
    const partialAccessCourses = JSON.parse(this.parentElement.parentElement.querySelector('.partialAccessCourses').innerText);
    const fullAccessCourses = JSON.parse(this.parentElement.parentElement.querySelector('.fullAccessCourses').innerText);
    const anonymousResponses = this.parentElement.parentElement.querySelector('.anonymousResponses').innerHTML.includes('check');
    ui.modal({
      title: 'Edit User',
      body: `<p>Edit <code>${role}</code> user <code>${user}</code>. This action is not reversible.${(user === storage.get("usr")) ? '<br><br>Changing your own password will result in system logoff.' : ''}</p>`,
      inputs: [
        {
          label: 'Role',
          type: 'select',
          options: [
            {
              value: 'admin',
              text: 'Admin'
            },
            {
              value: 'ta',
              text: 'TA'
            }
          ],
          defaultValue: role,
          required: true,
        },
        {
          label: 'New Password',
          type: 'password',
        },
        {
          label: 'Partial Access Courses',
          type: 'select',
          options: courses.map(course => ({
            value: String(course.id),
            text: course.name,
            selected: partialAccessCourses ? partialAccessCourses.includes(course.id) : false,
          })),
          multiple: true,
        },
        {
          label: 'Full Access Courses',
          type: 'select',
          options: courses.map(course => ({
            value: String(course.id),
            text: course.name,
            selected: fullAccessCourses ? fullAccessCourses.includes(course.id) : false,
          })),
          multiple: true,
        },
        {
          label: 'Anonymized Responses',
          type: 'select',
          options: [
            {
              value: 0,
              text: 'Off',
              selected: !anonymousResponses,
            },
            {
              value: 1,
              text: 'On',
              selected: anonymousResponses,
            },
          ]
        },
        {
          label: 'Admin Password',
          type: 'password',
          required: true,
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: (inputValues) => {
            editUser(inputValues, user);
          },
          close: true,
        },
      ],
    });
  }

  function editUser(inputValues, user) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/user', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        username: user,
        password: inputValues[1],
        role: inputValues[0],
        partialAccessCourses: inputValues[2] || [],
        fullAccessCourses: inputValues[3] || [],
        anonymousResponses: inputValues[4],
        admin_password: inputValues[5],
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully edited user.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function addUserModal() {
    if (!active) return;
    ui.modal({
      title: 'Add User',
      body: `<p>Grant a new user access to the administration-side.</p>`,
      inputs: [
        {
          label: 'Role',
          type: 'select',
          options: [
            {
              value: 'admin',
              text: 'Admin'
            },
            {
              value: 'ta',
              text: 'TA'
            }
          ],
          defaultValue: 'ta',
          required: true,
        },
        {
          label: 'Username / Seat Code',
          type: 'text',
          required: true,
        },
        {
          label: 'Password',
          type: 'password',
          required: true,
        },
        {
          label: 'Partial Access Courses',
          type: 'select',
          options: courses.map(course => ({
            value: String(course.id),
            text: course.name
          })),
          multiple: true,
        },
        {
          label: 'Full Access Courses',
          type: 'select',
          options: courses.map(course => ({
            value: String(course.id),
            text: course.name
          })),
          multiple: true,
        },
        {
          label: 'Anonymized Responses',
          type: 'select',
          options: [
            {
              value: 0,
              text: 'Off',
            },
            {
              value: 1,
              text: 'On',
            },
          ]
        },
        {
          label: 'Admin Password',
          type: 'password',
          required: true,
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: (inputValues) => {
            addUser(inputValues);
          },
          close: true,
        },
      ],
    });
  }

  function addUser(inputValues) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/users', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        username: inputValues[1],
        password: inputValues[2],
        role: inputValues[0],
        partialAccessCourses: inputValues[3] || [],
        fullAccessCourses: inputValues[4] || [],
        anonymousResponses: inputValues[5],
        admin_password: inputValues[6],
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully added user.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function deleteUserModal() {
    if (!active) return;
    const user = this.parentElement.parentElement.id;
    const role = this.parentElement.parentElement.querySelector('.role').innerText;
    ui.modal({
      title: 'Delete User',
      body: `<p>Are you sure you would like to delete the <code>${role}</code> user <code>${user}</code>? This action is not reversible.${(user === storage.get("usr")) ? '<br><br>Deleting your own user will result in system logoff.' : ''}${(role === 'admin') ? '<br><br>Warning: You are deleting an admin user. Proceed with caution.' : ''}</p>`,
      inputs: [
        {
          label: 'Admin Password',
          type: 'password',
          required: true,
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: (inputValues) => {
            deleteUser(inputValues, user);
          },
          close: true,
        },
      ],
    });
  }

  function deleteUser(inputValues, user) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/users', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        username: user,
        admin_password: inputValues[0],
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully deleted user.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function updateLogs() {
    document.querySelector('.logs').innerHTML = '<div class="row header"><span hidden>Action</span><span>Details</span><span class="smedium">Timestamp</span></div>';
    var filteredLogs = logs.filter(l => l.user.startsWith(document.getElementById("filter-logs-by-username-input").value)).filter(l => document.getElementById("filter-logs-by-action-input").value ? l.action.endsWith(document.getElementById("filter-logs-by-action-input").value) : true).filter(l => document.querySelector('#filter-logs-by-type [aria-selected="true"]').getAttribute('data-value') ? l.action.toLowerCase().startsWith(document.querySelector('#filter-logs-by-type [aria-selected="true"]').getAttribute('data-value')) : true);
    if (filteredLogs.length > 0) {
      document.getElementById('no-logs').setAttribute('hidden', '');
      document.querySelector('.logs').removeAttribute('hidden');
    } else {
      document.getElementById('no-logs').removeAttribute('hidden');
      document.querySelector('.logs').setAttribute('hidden', '');
    }
    filteredLogs.forEach(log => {
      document.querySelector('.logs').innerHTML += `<div class="enhanced-item${log.undid ? ' disabled' : ''}" id="${log.id}">
        <span class="action" hidden>${log.action}</span>
        <span class="details">${escapeHTML(log.details)}</span>
        <span class="timestamp fit">${time.unixToString(log.timestamp)}</span>
        <span class="actions fit showonhover">
          <button class="icon" data-undo-action tooltip="Undo Action">
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>
          <button class="icon" data-clear-log tooltip="Clear Entry">
            <i class="bi bi-trash"></i>
          </button>
        </span>
      </div>`;
    });
    document.querySelectorAll('[data-undo-action]').forEach(button => button.addEventListener('click', undoActionModal));
    document.querySelectorAll('[data-clear-log]').forEach(button => button.addEventListener('click', clearLogModal));
  }

  function clearLogsModal() {
    if (!active) return;
    ui.modal({
      title: 'Clear Logs',
      body: '<p>Are you sure you would like to clear all logs from the database? This action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Clear',
          class: 'submit-button',
          onclick: () => {
            clearLogs();
          },
          close: true,
        },
      ],
    });
  }

  function clearLogs() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/logs', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully cleared logs.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function clearLogModal() {
    if (!active) return;
    const id = this.parentElement.parentElement.id;
    const details = this.parentElement.parentElement.querySelector('.details').innerText;
    const timestamp = this.parentElement.parentElement.querySelector('.timestamp').innerText;
    ui.modal({
      title: 'Clear Log',
      body: `<p>Are you sure you would like to clear this log from the database? This action is not reversible.<br><br>Details: ${details}<br>Timestamp: ${timestamp}</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Clear',
          class: 'submit-button',
          onclick: () => {
            clearLog(id);
          },
          close: true,
        },
      ],
    });
  }

  function clearLog(id) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/logs', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        id,
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully cleared log.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function undoActionModal() {
    if (!active) return;
    const id = this.parentElement.parentElement.id;
    const details = this.parentElement.parentElement.querySelector('.details').innerText;
    const timestamp = this.parentElement.parentElement.querySelector('.timestamp').innerText;
    const action = this.parentElement.parentElement.querySelector('.action').innerText;
    ui.modal({
      title: 'Undo Action',
      body: `<p>Are you sure you would like to undo this action? This action is not reversible.<br><br>Action: ${action}<br>Details: ${details}<br>Timestamp: ${timestamp}</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Undo',
          class: 'submit-button',
          onclick: () => {
            undoAction(id);
          },
          close: true,
        },
      ],
    });
  }

  function undoAction(id) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/log', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        id,
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully undid action.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function removePasswordsModal() {
    if (!active) return;
    ui.modal({
      title: 'Remove Passwords',
      body: '<p>Are you sure you would like to remove passwords from all seat codes? All seat codes will lose their saved settings. This action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Remove',
          class: 'submit-button',
          onclick: () => {
            removePasswords();
          },
          close: true,
        },
      ],
    });
  }

  function removePasswords() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/passwords', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully removed passwords.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function removePasswordModal() {
    if (!active) return;
    const seatCode = this.parentElement.parentElement.id;
    ui.modal({
      title: 'Remove Password',
      body: `<p>Are you sure you would like to remove the password from seat code <code>${seatCode}</code>? This seat code will lose all their saved settings. This action is not reversible.</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Remove',
          class: 'submit-button',
          onclick: () => {
            removePassword(seatCode);
          },
          close: true,
        },
      ],
    });
  }

  function removePassword(seatCode) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/passwords', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        seatCode,
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully removed password.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function resetPasswordModal() {
    if (!active) return;
    const seatCode = this.parentElement.parentElement.id;
    ui.modal({
      title: 'Reset Password',
      body: `<p>Are you sure you would like to reset this password's associated password? The seat code will be prompted to set a new password on next app load. This action is not reversible.</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Reset',
          class: 'submit-button',
          onclick: () => {
            resetPassword(seatCode);
          },
          close: true,
        },
      ],
    });
  }

  function resetPassword(seatCode) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/password', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        seatCode,
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully reset password.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function createBackupModal() {
    if (!active) return;
    if ([...document.querySelectorAll('.backups .modified')].find(b => b.innerText === time.unixToString(new Date()))) return ui.toast("Wait 1 minute before requesting another backup.", 5000, "error", "bi bi-exclamation-triangle-fill");
    ui.modal({
      title: 'Create Backup',
      body: '<p>Create a downloadable ZIP file backup of server contents. The backup will include all site pages, scripts, stylesheets, other assets, frontend files, frontend beta files, API files, necessary scripts, uploaded files (question images and syllabus), recently exported reports and backups, databases, templates, and server management files. Files containing hashed user passwords will not be included in the backup. Contact your hosting provider to access these private files, or log in to your hosting panel.</p>',
      inputs: [
        {
          label: 'Include Previous Backups',
          type: 'select',
          options: [
            {
              value: 'true',
              text: 'Yes'
            },
            {
              value: 'false',
              text: 'No'
            }
          ],
          defaultValue: 'false',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Create',
          class: 'submit-button',
          onclick: (inputValue) => {
            createBackup(inputValue);
          },
          close: true,
        },
      ],
    });
  }

  function createBackup(inputValue) {
    if (!active) return;
    ui.toast("Generating backup...", 3000, "info", "bi bi-download");
    ui.setUnsavedChanges(true);
    fetch(domain + '/backup', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        include_previous_backups: inputValue || false,
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
      .then(r => {
        ui.setUnsavedChanges(false);
        if (!r || !r.filename) {
          ui.toast("Error generating backup.", 3000, "error", "bi bi-exclamation-triangle-fill");
          return;
        }
        ui.toast("Backup generated successfully.", 3000, "success", "bi bi-check-circle-fill");
        ui.view();
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function downloadBackupModal() {
    if (!active) return;
    const filename = this.parentElement.parentElement.id;
    const file_name = this.parentElement.parentElement.querySelector('.file_name').innerText;
    const type = this.parentElement.parentElement.querySelector('.type').innerText;
    const modified = this.parentElement.parentElement.querySelector('.modified').innerText;
    const size = this.parentElement.parentElement.querySelector('.size').innerText;
    ui.modal({
      title: 'Download Backup',
      body: `<p>Downloading this <code>${type}</code> backup will take up ${size} of disk space on your hard drive.<br><br>Name: ${file_name}<br>Type: ${type}<br>Modified: ${modified}<br>Size: ${size}</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Download',
          class: 'submit-button',
          onclick: () => {
            this.disabled = true;
            ui.toast(`Downloading ${file_name}.${type.toLowerCase()}...`, 3000, "info", "bi bi-download");
            const link = document.createElement('a');
            link.href = filename;
            link.download = filename.split('/')[filename.split('/').length - 1];
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.disabled = false;
            ui.toast("Backup downloaded successfully.", 3000, "success", "bi bi-check-circle-fill");
          },
          close: true,
        },
      ],
    });
  }

  function deleteBackupsModal() {
    if (!active) return;
    ui.modal({
      title: 'Delete All Backups',
      body: '<p>Are you sure you would like to delete all backups? This action is not reversible.</p>',
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Delete',
          class: 'submit-button',
          onclick: () => {
            deleteBackups();
          },
          close: true,
        },
      ],
    });
  }

  function deleteBackups() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/backups', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully deleted all backups.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function deleteBackupModal() {
    if (!active) return;
    const file_name = this.parentElement.parentElement.querySelector('.file_name').innerText;
    const type = this.parentElement.parentElement.querySelector('.type').innerText;
    const modified = this.parentElement.parentElement.querySelector('.modified').innerText;
    const size = this.parentElement.parentElement.querySelector('.size').innerText;
    ui.modal({
      title: 'Delete Backup',
      body: `<p>Are you sure you would like to delete backup? This action is not reversible.<br><br>Name: ${file_name}<br>Type: ${type}<br>Modified: ${modified}<br>Size: ${size}</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Delete',
          class: 'submit-button',
          onclick: () => {
            deleteBackup(file_name, type);
          },
          close: true,
        },
      ],
    });
  }

  function deleteBackup(file_name, type) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/backup', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        file_name: `${file_name}.${type.toLowerCase()}`,
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully deleted backup.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  function archiveType(mode) {
    const current = document.querySelector(`[data-archive-type="${archiveTypeSelected}"]`);
    const fromHeight = current?.getBoundingClientRect().height;
    if (archiveTypeSelected == mode) return;
    document.querySelectorAll("[data-archive-type]").forEach((item) => {
      if (item.getAttribute("data-archive-type") == mode) {
        item.style.removeProperty("display");
      } else {
        item.style.display = "none";
      }
    });
    const container = document.getElementById("answer-container");
    const target = document.querySelector(`[data-archive-type="${mode}"]`);
    const toHeight = target.getBoundingClientRect().height;
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
    archiveTypeSelected = mode;
  }

  function archiveModal(itemType, itemId = null) {
    if (!active) return;
    var itemName = null;
    switch (itemType) {
      case 'course':
        if (!itemId) itemId = document.getElementById("course-period-input") ? courses.find(c => (String(c.id) === document.getElementById("course-period-input").value))?.id : null;
        itemName = document.getElementById("course-period-input") ? courses.find(c => (String(c.id) === document.getElementById("course-period-input").value))?.name : null;
        break;
      case 'segment':
        if (!itemId) itemId = loadedSegment ? loadedSegment.id : null;
        itemName = loadedSegment ? loadedSegment.name : null;
        break;
      case 'question':
        itemName = questions.find(q => String(q.id) === itemId)?.number;
        break;
      default:
        return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
    }
    if ((typeof itemId === 'object') || (typeof itemId === 'undefined')) return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
    ui.modal({
      title: 'Archive Item',
      body: `<p>Archiving this ${itemType} will hide it from student view and admin-side management, and will only be accessible from the Archive page. After archiving this ${itemType}, editing it will be disabled.</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Archive',
          class: 'submit-button',
          onclick: () => {
            archive(itemType, String(itemId), itemName);
          },
          close: true,
        },
      ],
    });
  }

  function archiveMultipleModal() {
    if (!active) return;
    var archivingList = [];
    var archivingListString = "";
    document.querySelectorAll('.selected').forEach(e => {
      if (!e.id) return;
      var itemType = e.id.split('-')[0];
      var itemId = e.id.split('-')[1];
      var itemName = null;
      switch (itemType) {
        case 'segment':
          itemName = segments.find(s => String(s.id) === itemId).name;
          break;
        case 'question':
          itemName = questions.find(q => String(q.id) === itemId).number;
          break;
        case 'response':
          itemName = responses.find(r => String(r.id) === itemId).id;
          break;
        default:
          return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
      }
      if ((typeof itemId === 'object') || (typeof itemId === 'undefined')) return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
      archivingList.push({
        type: itemType,
        id: itemId,
        name: itemName,
      });
      archivingListString += `<br>${itemType[0].toUpperCase()}${itemType.slice(1)}: ${itemName || itemId}`;
    });
    if (archivingList.length === 0) return ui.toast("No items selected.", 5000, "error", "bi bi-exclamation-triangle-fill");
    ui.modal({
      title: 'Archive Selected',
      body: `<p>Archiving these ${archivingList[0].type}s will hide them from student view and admin-side management, and will only be accessible from the Archive page. After archiving these ${archivingList[0].type}s, editing them will be disabled.<br>${archivingListString}</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Archive Selected',
          class: 'submit-button',
          onclick: async () => {
            for (var i = 0; i < archivingList.length; i++) {
              await archive(archivingList[i].type, String(archivingList[i].id), archivingList[i].name);
            }
          },
          close: true,
        },
      ],
    });
  }

  async function archive(itemType, itemId, itemName = null) {
    if (!active || !itemType || !itemId) return;
    ui.toast(`Archiving ${itemType} ${itemName || itemId}...`, 3000, "info", "bi bi-archive");
    ui.setUnsavedChanges(true);
    await fetch(domain + '/archive', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        item_type: itemType,
        item_id: itemId,
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
        ui.setUnsavedChanges(false);
        ui.toast(`Successfully archived ${itemType} ${itemName || itemId}.`, 3000, "success", "bi bi-check-lg");
        if (loadedSegmentEditor) return window.location.href = '/admin/';
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function unarchiveModal() {
    if (!active) return;
    if (!this || !this.parentElement) return;
    var itemType = this.parentElement.getAttribute('archive-type');
    var itemId = this.parentElement.id;
    if (!itemType || !itemId) return;
    var itemName = null;
    switch (itemType) {
      case 'course':
        itemName = courses.find(c => String(c.id) === itemId)?.name;
        break;
      case 'segment':
        itemName = segments.find(s => String(s.id) === itemId)?.name;
        break;
      case 'question':
        itemName = questions.find(q => String(q.id) === itemId)?.number;
        break;
      case 'response':
        itemName = itemId;
        break;
      default:
        return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
    }
    if ((typeof itemId === 'object') || (typeof itemId === 'undefined')) return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
    ui.modal({
      title: 'Unarchive Item',
      body: `<p>Unarchiving this ${itemType} will restore it to how it was before archiving, given that all dependents still have the ${itemType} linked.</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Unarchive',
          class: 'submit-button',
          onclick: () => {
            unarchive(itemType, String(itemId), itemName);
          },
          close: true,
        },
      ],
    });
  }

  function unarchiveMultipleModal() {
    if (!active) return;
    var unarchivingList = [];
    var unarchivingListString = "";
    document.querySelectorAll('.selected').forEach(e => {
      if (!e.getAttribute('archive-type') || !e.id) return;
      var itemType = e.getAttribute('archive-type');
      var itemId = e.id;
      var itemName = null;
      switch (itemType) {
        case 'course':
          itemName = courses.find(c => String(c.id) === itemId)?.name;
          break;
        case 'segment':
          itemName = segments.find(s => String(s.id) === itemId)?.name;
          break;
        case 'question':
          itemName = questions.find(q => String(q.id) === itemId)?.number;
          break;
        case 'response':
          itemName = itemId;
          break;
        default:
          return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
      }
      if ((typeof itemId === 'object') || (typeof itemId === 'undefined')) return ui.toast("Item to archive not found.", 5000, "error", "bi bi-exclamation-triangle-fill");
      unarchivingList.push({
        type: itemType,
        id: itemId,
        name: itemName,
      });
      unarchivingListString += `<br>${itemType[0].toUpperCase()}${itemType.slice(1)}: ${itemName || itemId}`;
    });
    if (unarchivingList.length === 0) return ui.toast("No items selected.", 5000, "error", "bi bi-exclamation-triangle-fill");
    ui.modal({
      title: 'Unarchive Selected',
      body: `<p>Unarchiving these items will restore them to how they were before archiving, given that all dependents still have the item linked.<br>${unarchivingListString}</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Unarchive Selected',
          class: 'submit-button',
          onclick: async () => {
            for (var i = 0; i < unarchivingList.length; i++) {
              await unarchive(unarchivingList[i].type, String(unarchivingList[i].id), unarchivingList[i].name);
            }
          },
          close: true,
        },
      ],
    });
  }

  async function unarchive(itemType, itemId, itemName = null) {
    if (!active || !itemType || !itemId) return;
    ui.toast(`Unarchiving ${itemType} ${itemName || itemId}...`, 3000, "info", "bi bi-archive");
    ui.setUnsavedChanges(true);
    await fetch(domain + '/unarchive', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        item_type: itemType,
        item_id: itemId,
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
        ui.setUnsavedChanges(false);
        ui.toast(`Successfully unarchived ${itemType} ${itemName || itemId}.`, 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function viewRoster() {
    if (!this || !this.parentElement || !this.parentElement.querySelector('input').id) return;
    const roster = rosters.find(roster => String(roster.period) === this.parentElement.querySelector('input').id.split('period-')[1]);
    var rosterDataString = '';
    JSON.parse(roster.data).forEach(row => {
      rosterDataString += `<br>${row.seatCode}: ${row.last}, ${row.first}`;
    });
    ui.modal({
      title: `Period ${roster.period} Roster`,
      body: `<p>${JSON.parse(roster.data).length} students<br>Last updated ${time.unixToString(roster.last_updated)}<br>${rosterDataString}</p>`,
      buttons: [
        {
          text: 'Download',
          class: 'submit-button',
          onclick: async () => {
            this.disabled = true;
            ui.toast(`Downloading ${roster.url.split('/')[roster.url.split('/').length - 1]}...`, 3000, "info", "bi bi-download");
            const link = document.createElement('a');
            link.href = roster.url;
            link.download = roster.url.split('/')[roster.url.split('/').length - 1];
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.disabled = false;
            ui.toast("Roster downloaded successfully.", 3000, "success", "bi bi-check-circle-fill");
          },
          close: true,
        },
        {
          text: 'Remove',
          class: 'submit-button',
          onclick: async () => {
            removeRoster(roster.period);
          },
          close: true,
        },
        {
          text: 'Replace',
          class: 'submit-button',
          onclick: async () => {
            renderRosterPond(roster.period);
          },
          close: true,
        },
      ],
    });
  }

  function uploadRoster() {
    if (!this || !this.parentElement || !this.parentElement.querySelector('input').id) return;
    renderRosterPond(this.parentElement.querySelector('input').id.split('period-')[1]);
  }

  async function renderRosterPond(period) {
    if (!active) return;
    if (!period) return;
    const url = '/admin/upload?period=' + period;
    const width = 600;
    const height = 150;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const windowFeatures = `width=${width},height=${height},resizable=no,scrollbars=no,status=yes,left=${left},top=${top}`;
    const newWindow = window.open(url, '_blank', windowFeatures);
    let uploadSuccessful = false;
    window.addEventListener('message', (event) => {
      if (event.origin !== (window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''))) return;
      if (event.data === 'uploadSuccess') uploadSuccessful = true;
    }, false);
    const checkWindowClosed = setInterval(function () {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindowClosed);
        if (uploadSuccessful) {
          ui.modeless(`<i class="bi bi-cloud-upload"></i>`, "Uploaded");
        } else {
          ui.modeless(`<i class="bi bi-exclamation-triangle"></i>`, "Upload Cancelled");
        }
        init();
      }
    }, 1000);
  }

  function removeRoster(period) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/roster', {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        period,
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
        ui.setUnsavedChanges(false);
        ui.toast("Successfully removed roster.", 3000, "success", "bi bi-check-lg");
        init();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
        pollingOff();
      });
  }

  document.getElementById("download-roster-template-button")?.addEventListener("click", () => {
    const templateUrl = `${domain}/uploads/rosters/template.csv`;
    ui.toast(`Downloading ${templateUrl.split('/')[templateUrl.split('/').length - 1]}...`, 3000, "info", "bi bi-download");
    const link = document.createElement('a');
    link.href = templateUrl;
    link.download = templateUrl.split('/')[templateUrl.split('/').length - 1];
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ui.toast("Roster template downloaded successfully.", 3000, "success", "bi bi-check-circle-fill");
  });

  function selectBetween() {
    if (!active) return;
    ui.setUnsavedChanges(true);
    if (document.querySelectorAll('.selected').length < 2) return ui.toast("At least 2 bounds required.", 5000, "error", "bi bi-exclamation-triangle-fill");
    const selected = document.querySelectorAll('.selected');
    const first = selected[0];
    const last = selected[selected.length - 1];
    const selectElements = [...first.parentElement.children].filter(child => child.querySelector('[data-select]'));
    let inBounds = false;
    selectElements.forEach((el) => {
      if (el === first || el === last) {
        inBounds = !inBounds;
      } else if (inBounds) {
        el.classList.add('selected');
      }
    });
  }

  function rotatePeriodConfirm() {
    if (!active) return;
    ui.view();
    const rotatePeriodN = Number(document.getElementById('rotate-period-input').value);
    ui.modal({
      title: `Rotate ${rotatePeriodN ? 'period' : 'all periods'}?`,
      body: `<p>This will archive all responses from this period, as well as remove all TA users and saved seat code settings and passwords for ${rotatePeriodN ? 'this period' : 'all periods'}. This action is not reversible.</p>`,
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: () => {
            rotatePeriodN ? rotatePeriod(rotatePeriodN) : rotatePeriodConfirm2();
          },
          close: true,
        },
      ],
    });
  }

  function rotatePeriodConfirm2() {
    if (!active) return;
    ui.view();
    ui.modal({
      title: "Rotate all periods?",
      body: "<p>Are you sure? This will archive all responses from this period, as well as remove all TA users and saved seat code settings and passwords for all periods. This action is not reversible.</p>",
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: () => {
            rotatePeriodConfirm3();
          },
          close: true,
        },
      ],
    });
  }

  function rotatePeriodConfirm3() {
    if (!active) return;
    ui.view();
    ui.modal({
      title: "Rotate all periods?",
      body: "<p>Are you completely sure? This will archive all responses from this period, as well as remove all TA users and saved seat code settings and passwords for all periods. This action is not reversible.</p>",
      buttons: [
        {
          text: 'Cancel',
          class: 'cancel-button',
          close: true,
        },
        {
          text: 'Continue',
          class: 'submit-button',
          onclick: () => {
            rotatePeriod();
          },
          close: true,
        },
      ],
    });
  }

  function rotatePeriod(period = 0) {
    if (!active) return;
    ui.setUnsavedChanges(true);
    fetch(domain + '/rotate', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        period: period
      })
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
        ui.setUnsavedChanges(false);
        ui.toast(period ? `Period ${period} rotated successfully.` : "All periods rotated successfully.", 3000, "success", "bi bi-check-circle-fill");
        return window.location.reload();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  function updateExportResponsesCourses() {
    document.getElementById("export-responses-course").innerHTML = '<option value="">All Courses</option>';
    courses.forEach(course => {
      var option = document.createElement('option');
      option.value = course.id;
      option.innerHTML = course.name;
      document.getElementById("export-responses-course").appendChild(option);
    });
  }

  async function exportResponses() {
    if (!active) return;
    this.disabled = true;
    document.getElementById("export-responses-course").disabled = true;
    document.getElementById("export-responses-period").disabled = true;
    document.getElementById("export-responses-start-date").disabled = true;
    document.getElementById("export-responses-end-date").disabled = true;
    document.getElementById("export-responses-include-archived").disabled = true;
    ui.toast("Generating dump...", 3000, "info", "bi bi-download");
    var exportResponsesOptions = {};
    if (document.getElementById("export-responses-course").value) exportResponsesOptions['course_id'] = document.getElementById("export-responses-course").value;
    if (document.getElementById("export-responses-period").value) exportResponsesOptions['period'] = document.getElementById("export-responses-period").value;
    if (document.getElementById("export-responses-start-date").value) exportResponsesOptions['start'] = document.getElementById("export-responses-start-date").value;
    if (document.getElementById("export-responses-end-date").value) exportResponsesOptions['end'] = document.getElementById("export-responses-end-date").value;
    if (document.getElementById("export-responses-include-archived").value) exportResponsesOptions['include_archived'] = document.getElementById("export-responses-include-archived").value;
    ui.setUnsavedChanges(true);
    await fetch(domain + '/dump', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usr: storage.get("usr"),
        pwd: storage.get("pwd"),
        ...exportResponsesOptions
      })
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
      .then(r => {
        if (!r || !r.filename) {
          ui.toast("Error generating dump.", 3000, "error", "bi bi-exclamation-triangle-fill");
          this.disabled = false;
          document.getElementById("export-responses-course").disabled = false;
          document.getElementById("export-responses-period").disabled = false;
          document.getElementById("export-responses-start-date").disabled = false;
          document.getElementById("export-responses-end-date").disabled = false;
          document.getElementById("export-responses-include-archived").disabled = false;
          ui.setUnsavedChanges(true);
          return;
        }
        ui.setUnsavedChanges(false);
        ui.toast("Dump generated successfully.", 3000, "success", "bi bi-check-circle-fill");
        ui.toast(`Downloading ${r.filename.split('/')[r.filename.split('/').length - 1]}...`, 3000, "info", "bi bi-download");
        const link = document.createElement('a');
        link.href = r.filename;
        link.download = r.filename.split('/')[r.filename.split('/').length - 1];
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.disabled = false;
        document.getElementById("export-responses-course").disabled = false;
        document.getElementById("export-responses-period").disabled = false;
        document.getElementById("export-responses-start-date").disabled = false;
        document.getElementById("export-responses-end-date").disabled = false;
        document.getElementById("export-responses-include-archived").disabled = false;
        ui.toast("Dump downloaded successfully.", 3000, "success", "bi bi-check-circle-fill");
        ui.view();
      })
      .catch((e) => {
        console.error(e);
        if (!e.message || (e.message && !e.message.includes("."))) ui.view("api-fail");
        if ((e.error === "Access denied.") || (e.message === "Access denied.")) return auth.admin(init);
      });
  }

  async function autofillAnswers() {
    if (!active) return;
    const questionId = this.parentElement.parentElement.querySelector('#question-id-input')?.value;
    const questionTitle = this.parentElement.parentElement.querySelector('#question-text-input')?.value;
    const questionDescription = renderedEditors[Number(questionId)].getText().replaceAll('\\n', ' ').replaceAll('  ', ' ').trim() || null;
    const questionImages = [...new Set(JSON.parse(questions.find(q => String(q.id) === questionId).images))];
    console.log(questionTitle, questionDescription, questionImages);
    ui.setUnsavedChanges(true);
    if (questionImages.length || questionDescription) {
      ui.startLoader();
      await fetch(domain + '/ai/q', {
        method: 'POST',
        body: JSON.stringify({
          usr: storage.get("usr"),
          pwd: storage.get("pwd"),
          OpenAI_API_Key: "sk-proj-18b3a02f4fb35e8a8421948667fbacf7_2ac9b775227456bb9d53d370cc299da7937deb6b_184751e482b7_f157c538a800",
          title: questionTitle,
          description: questionDescription,
          images: questionImages,
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          ui.stopLoader();
          const output = data.o;
          if (data.error || !data.o) {
            this.classList.add('error');
            setTimeout(() => {
              this.classList.remove('error');
            }, 2000);
            ui.toast(data.error, 5000, "error", "bi bi-exclamation-triangle-fill");
          } else {
            const aiCorrectAnswers = output.correct || [];
            const aiIncorrectAnswers = output.incorrect || [];
            [...this.parentElement.parentElement.querySelectorAll('.correctAnswers .button-grid')].filter(e => e.querySelector('#question-correct-answer-input').value === '').forEach(e => e.remove());
            [...this.parentElement.parentElement.querySelectorAll('.incorrectAnswers .button-grid')].filter(e => (e.querySelector('#question-incorrect-answer-input').value === '') && (e.querySelector('#question-incorrect-answer-reason-input').value === '')).forEach(e => e.remove());
            aiCorrectAnswers.forEach(answer => {
              if (!answer || [...this.parentElement.parentElement.querySelectorAll('.correctAnswers .button-grid')].find(e => e.querySelector('#question-correct-answer-input').value.toLowerCase() === answer.toLowerCase())) return;
              var input = document.createElement('div');
              input.className = "button-grid inputs";
              input.innerHTML = `<input type="text" autocomplete="off" id="question-correct-answer-input" value="${escapeHTML(answer)}" placeholder="Answer" /><button data-remove-correct-answer-input square><i class="bi bi-dash"></i></button>`;
              this.parentElement.parentElement.querySelector('.correctAnswers').insertBefore(input, this.parentElement.parentElement.querySelector('.correctAnswers').children[this.parentElement.parentElement.querySelector('.correctAnswers').children.length - 1]);
            });
            aiIncorrectAnswers.forEach(answer => {
              if (!answer.answer || !answer.reason || [...this.parentElement.parentElement.querySelectorAll('.incorrectAnswers .button-grid')].find(e => e.querySelector('#question-incorrect-answer-input').value.toLowerCase() === answer.answer.toLowerCase())) return;
              var input = document.createElement('div');
              input.className = "button-grid inputs";
              input.innerHTML = `<input type="text" autocomplete="off" id="question-incorrect-answer-input" value="${escapeHTML(answer.answer)}" placeholder="Answer" /><input type="text" autocomplete="off" id="question-incorrect-answer-reason-input" value="${escapeHTML(answer.reason)}" placeholder="Reason" /><button data-remove-incorrect-answer-input square><i class="bi bi-dash"></i></button>`;
              this.parentElement.parentElement.querySelector('.incorrectAnswers').insertBefore(input, this.parentElement.parentElement.querySelector('.incorrectAnswers').children[this.parentElement.parentElement.querySelector('.incorrectAnswers').children.length - 1]);
            });
            document.querySelectorAll('[data-add-correct-answer-input]').forEach(a => a.addEventListener('click', addCorrectAnswer));
            document.querySelectorAll('[data-remove-correct-answer-input]').forEach(a => a.addEventListener('click', removeCorrectAnswer));
            document.querySelectorAll('[data-add-incorrect-answer-input]').forEach(a => a.addEventListener('click', addIncorrectAnswer));
            document.querySelectorAll('[data-remove-incorrect-answer-input]').forEach(a => a.addEventListener('click', removeIncorrectAnswer));
            this.classList.add('success');
            setTimeout(() => {
              this.classList.remove('success');
            }, 2000);
            ui.toast("Successfully autofilled answers.", 5000, "success", "bi bi-openai");
          }
        })
        .catch(error => {
          this.classList.add('error');
          setTimeout(() => {
            this.classList.remove('error');
          }, 2000);
          ui.toast(error, 5000, "error", "bi bi-exclamation-triangle-fill");
        });
    } else {
      ui.toast("Image(s) or description required.", 5000, "error", "bi bi-exclamation-triangle-fill");
      this.classList.add('error');
      setTimeout(() => {
        this.classList.remove('error');
      }, 2000);
      return;
    }
    ui.reloadUnsavedInputs();
  }

  function updateAISettings() {
    if (!aiInfo.has_api_key) {
      document.querySelectorAll('.ai-manager label').forEach(label => label.remove());
      document.querySelectorAll('.ai-manager textarea').forEach(textarea => textarea.remove());
      document.querySelectorAll('.ai-manager button').forEach(button => button.remove());
      document.querySelector('.ai-manager .ai-activation').outerHTML = `<div class="ai-activation error">
        <h4>AI is not activated.</h4>
        <p>Log in to the web hosting portal to enter your API key to enable AI use. Enter the API key as app environment secret <code>OPENAI_API_KEY</code>.</p>
        <a href="https://da.dangoweb.com:2222/"><button>Control Panel</button></a>
      </div>`;
      return;
    }
    if (!aiInfo.generator_enabled && !aiInfo.checker_enabled) {
      document.querySelector('.ai-manager .ai-activation').outerHTML = `<div class="ai-activation error">
        <h4>AI is not activated.</h4>
        <p>Enable full AI coverage for answer generation and automatic response marking.</p>
      </div>`;
    } else if (!aiInfo.generator_enabled || !aiInfo.checker_enabled) {
      document.querySelector('.ai-manager .ai-activation').outerHTML = `<div class="ai-activation warning">
        <h4>AI is only partially activated.</h4>
        <p>Enable full AI coverage for answer generation and automatic response marking.</p>
      </div>`;
    } else {
      document.querySelector('.ai-manager .ai-activation').outerHTML = `<div class="ai-activation success">
        <h4>AI is activated!</h4>
        <p>AI is activated and being used to generate answers and mark responses.</p>
        <div class="info">
          <p>API Key: ${aiInfo.has_api_key ? 'Exists' : 'Not found'}</p>
          <p>Model: ${aiInfo.model}</p>
        </div>
      </div>`;
    }
    document.getElementById('generate-answers').checked = aiInfo.generator_enabled;
    document.getElementById('check-responses').checked = aiInfo.checker_enabled;
    document.getElementById('generate-answers-prompt').placeholder = aiInfo.generate_answers_prompt;
    document.getElementById('generate-answers-prompt').value = aiInfo.generate_answers_prompt;
    document.getElementById('generate-answers-prompt-ending').placeholder = aiInfo.generate_answers_prompt_ending;
    document.getElementById('generate-answers-prompt-ending').value = aiInfo.generate_answers_prompt_ending;
    document.getElementById('check-responses-prompt').placeholder = aiInfo.check_responses_prompt;
    document.getElementById('check-responses-prompt').value = aiInfo.check_responses_prompt;
    document.getElementById('check-responses-prompt-ending').placeholder = aiInfo.check_responses_prompt_ending;
    document.getElementById('check-responses-prompt-ending').value = aiInfo.check_responses_prompt_ending;
  }

  async function clearAnnouncement(platform) {
    if (!active) return;
    if (!platform) return;
    ui.setUnsavedChanges(true);
    document.querySelectorAll(`#${platform}-announcement :is(input, select, textarea)`).forEach(input => input.value = "");
    if (document.querySelector(`#${platform}-announcement [data-${platform}-announcement-image-remove]:not([hidden])`)) {
      document.querySelector(`#${platform}-announcement [data-${platform}-announcement-image-remove]:not([hidden])`).click();
    } else {
      await save(null);
      ui.setUnsavedChanges(false);
    }
  }

  function previousPage(paginationSection) {
    const group = Array.from(paginationSection.parentElement.parentElement.classList).find(a => Object.keys(pagination).includes(a));
    if (!group) return;
    pagination[group].page = pagination[group].page - 1;
    updateResponses();
    paginationSection.getElementById('current-page').innerText = `Page ${pagination[group].page + 1} of ${Math.ceil(pagination[group].total / pagination[group].perPage)}`;
    paginationSection.getElementById('next-page').disabled = false;
    paginationSection.getElementById('previous-page').disabled = (pagination[group].page - 1 < 0) ? true : false;
  }

  function nextPage(paginationSection) {
    const group = Array.from(paginationSection.parentElement.parentElement.classList).find(a => Object.keys(pagination).includes(a));
    if (!group) return;
    pagination[group].page = pagination[group].page + 1;
    updateResponses();
    paginationSection.getElementById('current-page').innerText = `Page ${pagination[group].page + 1} of ${Math.ceil(pagination[group].total / pagination[group].perPage)}`;
    paginationSection.getElementById('next-page').disabled = (pagination[group].page + 1 >= Math.ceil(pagination[group].total / pagination[group].perPage)) ? true : false;
  }
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ admin.js: ${error.message}`);
  };
  throw error;
};