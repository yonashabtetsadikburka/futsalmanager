/* ========== ORGANIZER REGISTER SCREEN ========== */
async function renderOrganizerRegister(container) {
    let html = '<div class="screen active">';
    html += '<div class="login-container">';
    html += '<div class="login-card">';
    html += '<img src="/assets/Fut.webp" class="login-logo">';
    html += '<h2 style="font-family:var(--font-display);font-size:20px;font-weight:800;text-align:center;margin-bottom:4px">Registrati come Organizzatore</h2>';
    html += '<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;margin-bottom:20px">Inserisci il codice torneo per collegarti al tuo torneo</p>';
    html += '<div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="reg-first-name" placeholder="Mario"></div>';
    html += '<div class="form-group"><label class="form-label">Cognome</label><input class="form-input" id="reg-last-name" placeholder="Rossi"></div>';
    html += '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="reg-email" type="email" placeholder="email@esempio.it"></div>';
    html += '<div class="form-group"><label class="form-label">Password</label>';
    html += '<div class="password-wrapper">';
    html += '<input class="form-input" id="reg-password" type="password" placeholder="Min. 8 caratteri">';
    html += '<button type="button" class="password-toggle" onclick="togglePassword(\'reg-password\', this)">' + icon('eye', 18) + '</button>';
    html += '</div></div>';
    html += '<div class="form-group"><label class="form-label">Codice Torneo</label><input class="form-input" id="reg-code" placeholder="TOR-2026-XXXXXX" style="text-transform:uppercase;font-family:var(--font-mono)"></div>';
    html += '<button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="handleOrganizerRegister()">Registrati</button>';
    html += '<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;margin-top:16px">Hai già un account? <span style="color:var(--color-primary);cursor:pointer" onclick="Router.navigate(\'/login\')">Accedi</span></p>';
    html += '</div></div></div>';
    container.innerHTML = html;
}

async function handleOrganizerRegister() {
    const firstName = document.getElementById('reg-first-name').value.trim();
    const lastName = document.getElementById('reg-last-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const code = document.getElementById('reg-code').value.trim();

    if (!firstName || !lastName || !email || !password || !code) {
        showToast('Compila tutti i campi', 'error');
        return;
    }
    if (password.length < 8) {
        showToast('La password deve avere almeno 8 caratteri', 'error');
        return;
    }

    try {
        const res = await apiPost('register_organizer.php', {
            first_name: firstName,
            last_name: lastName,
            email,
            password,
            organizer_code: code
        }, { auth: false });
        if (res.token) {
            localStorage.setItem('admin_token', res.token);
            localStorage.setItem('user_role', 'organizer');
            localStorage.setItem('user_tournament_id', res.tournament_id);
            localStorage.setItem('user_name', res.first_name + ' ' + res.last_name);
            App.isAdmin = true;
            App.userRole = 'organizer';
            App.userTournamentId = res.tournament_id;
            App.updateNav();
            App.updateBottomTabs();
            const msg = 'Benvenuto, ' + res.first_name + '! Username: ' + res.username;
            showToast(msg, 'success');
            Router.navigate('/admin');
        } else {
            showToast(res.error || 'Errore nella registrazione', 'error');
        }
    } catch (e) {
        showToast(e.message || 'Errore di connessione', 'error');
    }
}
