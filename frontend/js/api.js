const API_URL = '/api/';

async function apiFetch(endpoint, options = {}) {
    const url = API_URL + endpoint;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = localStorage.getItem('admin_token');
    if (token && options.auth !== false) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    try {
        const res = await fetch(url, { ...options, headers });

        // Leggi sempre il body prima di lanciare errori
        const text = await res.text();
        let body = {};
        if (text) {
            try { body = JSON.parse(text); } catch {}
        }

        // 401/403: solo per endpoint autenticati gestisci sessione scaduta
        if (res.status === 401 || res.status === 403) {
            if (options.auth !== false) {
                localStorage.removeItem('admin_token');
                if (typeof App !== 'undefined') {
                    App.isAdmin = false;
                    App.updateNav();
                    App.updateBottomTabs();
                }
                if (typeof Router !== 'undefined') {
                    Router.navigate('/login');
                }
            }
            const err = new Error(body.error || body.message || 'Credenziali non corretti');
            err.status = res.status;
            err.body = body;
            throw err;
        }

        if (!res.ok) {
            const err = new Error(body.error || body.message || 'Errore del server');
            err.status = res.status;
            err.body = body;
            throw err;
        }

        return body.success !== undefined ? body : (text ? body : { success: true });
    } catch (e) {
        if (e.status) throw e; // rilancia errori HTTP già processati
        console.error('API Error:', e);
        throw new Error('Errore di connessione');
    }
}

async function apiGet(endpoint) {
    return apiFetch(endpoint);
}

async function apiPost(endpoint, data, extraOptions = {}) {
    return apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data), ...extraOptions });
}

async function apiPut(endpoint, data) {
    return apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(data) });
}

async function apiDelete(endpoint, data) {
    const options = { method: 'DELETE' };
    if (data) options.body = JSON.stringify(data);
    return apiFetch(endpoint, options);
}

async function apiUpload(endpoint, formData) {
    const url = API_URL + endpoint;
    const token = localStorage.getItem('admin_token');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
        const res = await fetch(url, { method: 'POST', headers, body: formData });

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('admin_token');
            if (typeof App !== 'undefined') {
                App.isAdmin = false;
                App.updateNav();
                App.updateBottomTabs();
            }
            if (typeof Router !== 'undefined') {
                Router.navigate('/login');
            }
            throw new Error('Sessione scaduta');
        }

        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text) return { success: true };
        return JSON.parse(text);
    } catch (e) {
        console.error('Upload Error:', e);
        throw e;
    }
}

function uploadFile(file, type) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    return apiUpload('upload.php', fd);
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCoachName(name) {
    if (!name) return '';
    if (name.includes('.')) {
        return name.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
