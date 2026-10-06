document.querySelector('#retry').addEventListener('click', async () => {
  const button = document.querySelector('#retry');
  button.disabled = true;
  document.querySelector('#status').textContent = 'Conectando…';
  try { await window.santaConnection.retry(); }
  finally { button.disabled = false; document.querySelector('#status').textContent = ''; }
});
