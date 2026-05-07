(function () {
  if (document.getElementById('hr-button')) return;

  var cssUrl = chrome.runtime.getURL('panel.css');
  var panelUrl = chrome.runtime.getURL('panel.html');

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  document.head.appendChild(link);

  var button = document.createElement('button');
  button.id = 'hr-button';
  button.className = 'hr-button';
  button.setAttribute('aria-label', 'House Rules');
  button.setAttribute('title', 'House Rules');
  button.innerHTML =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>' +
    '<path d="M9 22V12h6v10" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';

  var panelWrapper = document.createElement('div');
  panelWrapper.id = 'hr-panel-wrapper';
  panelWrapper.className = 'hr-panel-wrapper';

  var iframe = document.createElement('iframe');
  iframe.src = panelUrl;
  iframe.setAttribute('title', 'House Rules Panel');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  panelWrapper.appendChild(iframe);

  iframe.addEventListener('load', function () {
    iframe.contentWindow.postMessage({ type: 'init', projectKey: window.location.pathname }, '*');
  });

  document.body.appendChild(panelWrapper);
  document.body.appendChild(button);

  button.addEventListener('click', function () {
    var isOpen = panelWrapper.classList.contains('hr-open');
    if (isOpen) {
      panelWrapper.classList.remove('hr-open');
      button.setAttribute('aria-expanded', 'false');
    } else {
      panelWrapper.classList.add('hr-open');
      button.setAttribute('aria-expanded', 'true');
    }
  });

  // ── Step 3: Intercept agent prompt submissions ──────────────────────────────

  var DEFAULT_RULES =
    "Don't add fallbacks or workarounds without asking me first.\n" +
    "Don't invent APIs, libraries, or functions that don't exist — verify before using.\n" +
    "Ask before refactoring files I didn't explicitly tell you to touch.\n" +
    "Don't add new dependencies without confirming with me.";

  var BLOCK_START = '===== HOUSE RULES (auto-prepended) =====';
  var BLOCK_END   = '===== END HOUSE RULES =====';

  // currentRules: null means not yet loaded from storage
  var currentRules = null;

  function buildBlock(rules) {
    return BLOCK_START + '\n' + rules + '\n' + BLOCK_END;
  }

  function loadRules(cb) {
    var key = window.location.pathname;
    chrome.storage.local.get([key], function (result) {
      currentRules = (result[key] !== undefined) ? result[key] : DEFAULT_RULES;
      if (cb) cb(currentRules);
    });
  }

  // Pre-load once at injection time
  loadRules(null);

  // Stay in sync when the panel saves new rules without a page reload
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    var key = window.location.pathname;
    if (key in changes) {
      var newVal = changes[key].newValue;
      currentRules = (newVal !== undefined) ? newVal : DEFAULT_RULES;
    }
  });

  // Native value setter so React/Replit's state picks up the change
  var textareaNativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

  function readText(el) {
    return (el.tagName === 'TEXTAREA') ? el.value : (el.innerText || el.textContent || '');
  }

  function writeText(el, value) {
    if (el.tagName === 'TEXTAREA') {
      textareaNativeSetter.call(el, value);
    } else {
      // contenteditable: write as plain text
      el.textContent = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function maybePrepend(input) {
    // If rules haven't loaded yet, load then retry
    if (currentRules === null) {
      loadRules(function () { maybePrepend(input); });
      return;
    }

    var rules = currentRules;

    // Empty/whitespace rules → do nothing
    if (!rules || !rules.trim()) return;

    var block = buildBlock(rules);
    var current = readText(input);

    // Idempotency: already starts with the block → skip
    if (current.indexOf(block) === 0) return;

    writeText(input, block + '\n\n' + current);
  }

  // WeakSets prevent double-binding across MutationObserver callbacks
  var boundInputs  = new WeakSet();
  var boundButtons = new WeakSet();

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function findPromptInput() {
    // Prefer a visible textarea; fall back to contenteditable
    var textareas = document.querySelectorAll('textarea');
    for (var i = 0; i < textareas.length; i++) {
      if (isVisible(textareas[i])) return textareas[i];
    }
    var editables = document.querySelectorAll('[contenteditable="true"]');
    for (var j = 0; j < editables.length; j++) {
      if (isVisible(editables[j])) return editables[j];
    }
    return null;
  }

  function findSendButton() {
    // Look for a button whose aria-label or title suggests "send"
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var label = (btn.getAttribute('aria-label') || '').toLowerCase();
      var title = (btn.getAttribute('title') || '').toLowerCase();
      if (label.indexOf('send') !== -1 || title.indexOf('send') !== -1) return btn;
    }
    // Fallback: a submit-type button
    return document.querySelector('button[type="submit"]');
  }

  function bindInput(input) {
    if (boundInputs.has(input)) return;
    boundInputs.add(input);

    // Intercept Enter (without Shift) in the capture phase
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        maybePrepend(input);
      }
    }, true);
  }

  function bindButton(btn, input) {
    if (boundButtons.has(btn)) return;
    boundButtons.add(btn);

    // Intercept click on the send button in the capture phase
    btn.addEventListener('click', function () {
      maybePrepend(input);
    }, true);
  }

  function bindAll() {
    var input = findPromptInput();
    if (!input) return;
    bindInput(input);

    var btn = findSendButton();
    if (btn) bindButton(btn, input);
  }

  // Bind on initial load
  bindAll();

  // Re-bind whenever the Agent UI mounts, unmounts, or SPA-navigates
  var observer = new MutationObserver(function () {
    bindAll();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
