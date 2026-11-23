const $ = (s) => document.querySelector(s);

function setStatus(level, msg) {
  $('#dot').dataset.level = level;
  $('#status').textContent = msg;
}

chrome.runtime.sendMessage({ kind: 'status' }, (r) => {
  if (r && r.ok) setStatus(r.status.level, r.status.msg);
});

$('#reconnect').addEventListener('click', () => {
  chrome.runtime.sendMessage({ kind: 'reconnect' }, () => {
    setTimeout(() => location.reload(), 600);
  });
});

$('#dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://127.0.0.1:6471' });
});

fetch('http://127.0.0.1:6471/api/skills')
  .then((r) => r.json())
  .then((skills) => {
    const ul = $('#skills');
    ul.innerHTML = '';
    for (const s of skills) {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = s.title;
      const span = document.createElement('span');
      span.textContent = s.summary;
      li.appendChild(strong);
      li.appendChild(span);
      ul.appendChild(li);
    }
    if (!skills.length) ul.innerHTML = '<li class="muted">No skills loaded.</li>';
  })
  .catch(() => {
    $('#skills').innerHTML = '<li class="muted">Bridge offline — start it to load skills.</li>';
  });
