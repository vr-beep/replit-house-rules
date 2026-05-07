(function () {
  if (document.getElementById('hr-button')) return;

  const cssUrl = chrome.runtime.getURL('panel.css');
  const panelUrl = chrome.runtime.getURL('panel.html');

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  document.head.appendChild(link);

  const button = document.createElement('button');
  button.id = 'hr-button';
  button.className = 'hr-button';
  button.setAttribute('aria-label', 'House Rules');
  button.setAttribute('title', 'House Rules');
  button.innerHTML =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>' +
    '<path d="M9 22V12h6v10" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';

  const panelWrapper = document.createElement('div');
  panelWrapper.id = 'hr-panel-wrapper';
  panelWrapper.className = 'hr-panel-wrapper';

  const iframe = document.createElement('iframe');
  iframe.src = panelUrl;
  iframe.setAttribute('title', 'House Rules Panel');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  panelWrapper.appendChild(iframe);

  document.body.appendChild(panelWrapper);
  document.body.appendChild(button);

  button.addEventListener('click', function () {
    const isOpen = panelWrapper.classList.contains('hr-open');
    if (isOpen) {
      panelWrapper.classList.remove('hr-open');
      button.setAttribute('aria-expanded', 'false');
    } else {
      panelWrapper.classList.add('hr-open');
      button.setAttribute('aria-expanded', 'true');
    }
  });
})();
