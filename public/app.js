const form = document.getElementById('contact-form');
if (form) {
  const requested = new URLSearchParams(location.search).get('service');
  const select = document.getElementById('service');
  if ([...select.options].some(option => option.value === requested)) select.value = requested;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('form-status');
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    pending = true; button.disabled = true; button.textContent = 'Sending…'; status.textContent = '';
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Your message could not be sent. Please email us directly.');
      status.textContent = 'Thank you! Your message has been submitted to Mark and John.';
      form.reset();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'We could not confirm your submission. Please email us directly before retrying.' : error.message;
    } finally { pending = false; button.disabled = false; button.textContent = 'Send message'; }
  });
}
