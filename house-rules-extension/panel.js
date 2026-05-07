document.addEventListener('DOMContentLoaded', function () {
  var textarea = document.getElementById('hr-rules');
  var saveBtn = document.getElementById('hr-save');
  var status = document.getElementById('hr-status');
  var lastSaved = textarea.value;
  var projectKey = null;

  function setStatus(msg) {
    status.textContent = msg;
  }

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'init') return;
    projectKey = event.data.projectKey;

    chrome.storage.local.get([projectKey], function (result) {
      if (result[projectKey] !== undefined) {
        textarea.value = result[projectKey];
        lastSaved = textarea.value;
      }
    });
  });

  textarea.addEventListener('input', function () {
    if (textarea.value !== lastSaved) {
      setStatus('Unsaved changes');
    } else {
      setStatus('');
    }
  });

  saveBtn.addEventListener('click', function () {
    if (!projectKey) return;
    var data = {};
    data[projectKey] = textarea.value;
    chrome.storage.local.set(data, function () {
      lastSaved = textarea.value;
      setStatus('Saved');
    });
  });
});
