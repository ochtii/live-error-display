// Live Error Display app logic (extracted from inline script)
let currentSession = null;
let eventSource = null;
let errors = [];

function setStatus(state, text) {
	const dot = document.getElementById('statusDot');
	const t = document.getElementById('statusText');
	if (!dot || !t) return;
	t.textContent = text;
	dot.classList.remove('ok', 'err');
	if (state === 'ok') dot.classList.add('ok');
	if (state === 'err') dot.classList.add('err');
}

function updateSessionUI() {
	const box = document.getElementById('currentSessionBox');
	const forms = document.getElementById('sessionForms');
	if (!box || !forms) return;
	if (currentSession) {
		const nameEl = document.getElementById('currentSessionName');
		const tokenEl = document.getElementById('currentSessionToken');
		if (nameEl) nameEl.textContent = currentSession.name;
		if (tokenEl) tokenEl.textContent = currentSession.token;
		box.classList.remove('hidden');
		forms.style.display = 'none';
	} else {
		box.classList.add('hidden');
		forms.style.display = '';
	}
}

function updateErrorsUI() {
	const list = document.getElementById('errors');
	const none = document.getElementById('noErrors');
	const count = document.getElementById('errorCount');
	if (!list || !none || !count) return;
	list.innerHTML = '';
	count.textContent = `(${errors.length})`;
	if (errors.length === 0) {
		none.style.display = '';
		return;
	}
	none.style.display = 'none';
	errors.slice(0, 50).forEach(e => {
		const item = document.createElement('div');
		item.className = 'error-item';
		item.innerHTML = `
			<div class="error-head">
				<span>${(e.level || 'ERROR')}</span>
				<span class="error-meta">${new Date(e.timestamp).toLocaleString()}</span>
			</div>
			<div>${(e.message || JSON.stringify(e))}</div>
			${e.source ? `<div class="error-meta">Quelle: ${e.source}</div>` : ''}
		`;
		list.appendChild(item);
	});
}

async function createSession() {
	const nameInput = document.getElementById('sessionName');
	const passwordInput = document.getElementById('sessionPassword');
	const name = (nameInput?.value || '').trim();
	const password = passwordInput?.value || '';
	if (!name) { alert('Bitte Session Name angeben'); return; }
	try {
		setStatus('ok', 'Erstelle Session…');
		const res = await fetch('/api/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, password: password || undefined })
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler');
		currentSession = { token: data.token, name };
		updateSessionUI();
		setStatus('ok', 'Session aktiv');
	} catch (err) {
		console.error(err);
		setStatus('err', 'Session-Fehler: ' + err.message);
	}
}

function restoreSession() {
	const token = (document.getElementById('restoreToken')?.value || '').trim();
	if (!token) { alert('Bitte Token eingeben'); return; }
	currentSession = { token, name: 'Wiederhergestellt' };
	updateSessionUI();
	setStatus('ok', 'Session wiederhergestellt');
}

function endSession() {
	if (eventSource) { eventSource.close(); eventSource = null; }
	currentSession = null;
	errors = [];
	updateSessionUI();
	updateErrorsUI();
	setStatus('', 'Bereit');
}

function connectSSE() {
	if (eventSource) { eventSource.close(); }
	try {
		eventSource = new EventSource('/events');
		setStatus('', 'Verbinde…');
		eventSource.onopen = () => setStatus('ok', 'Live verbunden');
		eventSource.onmessage = (ev) => {
			try {
				const e = JSON.parse(ev.data);
				errors.unshift(e);
			} catch {
				errors.unshift({ level: 'INFO', message: ev.data, timestamp: Date.now() });
			}
			if (errors.length > 200) errors.length = 200;
			updateErrorsUI();
		};
		eventSource.onerror = () => setStatus('err', 'SSE getrennt');
	} catch (err) {
		console.error(err);
		setStatus('err', 'SSE Fehler: ' + err.message);
	}
}

function clearErrors() { errors = []; updateErrorsUI(); }

(async function init() {
	try {
		const res = await fetch('/api/health');
		if (res.ok) setStatus('ok', 'Server verbunden'); else setStatus('err', 'Server-Fehler');
	} catch {
		setStatus('err', 'Server nicht erreichbar');
	}
	updateSessionUI();
	updateErrorsUI();
})();
