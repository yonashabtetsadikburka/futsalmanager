/* ========== LOGIN SCREEN ========== */
function renderLogin(container) {
    if (App.isAdmin) {
        let html = '<div class="screen active">';
        html += '<div class="login-container">';
        html += '<div class="login-card" style="text-align:center">';
        html += '<img src="/assets/Fut.webp" class="login-logo">';
        html += '<h1 class="login-title">Futsal Manager</h1>';
        html += '<p class="login-subtitle">Sei gia connesso come ' + (App.userRole === 'organizer' ? 'organizzatore' : 'admin') + '</p>';
        html += '<button class="btn btn-primary btn-block btn-lg" onclick="Router.navigate(\'/admin\')" style="margin-bottom:12px">Vai alla Dashboard</button>';
        html += '<button class="btn btn-outline btn-block" onclick="App.logout()">Esci (Logout)</button>';
        html += '</div></div></div>';
        container.innerHTML = html;
        hideFAB();
        return;
    }
    let html = '<div class="screen active">';
    html += '<div class="login-container">';
    html += '<div class="login-card">';
    html += '<img src="/assets/Fut.webp" class="login-logo">';
    html += '<h1 class="login-title">Futsal Manager</h1>';
    html += '<p class="login-subtitle">Accedi al pannello di gestione</p>';
    html += '<div id="login-error" style="display:none;color:var(--color-error);font-size:13px;margin-bottom:12px"></div>';
    html += '<div class="form-group"><label class="form-label">Email o Username</label><input class="form-input" type="text" id="login-username" placeholder="Email o username"></div>';
    html += '<div class="form-group"><label class="form-label">Password</label>';
    html += '<div class="password-wrapper">';
    html += '<input class="form-input" type="password" id="login-password" placeholder="Password">';
    html += '<button type="button" class="password-toggle" onclick="togglePassword(\'login-password\', this)">' + icon('eye', 18) + '</button>';
    html += '</div></div>';
    html += '<button class="btn btn-primary btn-block btn-lg" onclick="handleLogin()">Entra</button>';
    html += '<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;margin-top:16px">Sei un organizzatore? <span style="color:var(--color-primary);cursor:pointer" onclick="Router.navigate(\'/register-organizer\')">Registrati qui</span></p>';
    html += '</div></div></div>';
    container.innerHTML = html;
    document.getElementById('login-password').addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });
    hideFAB();
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = icon('eye-off', 18);
    } else {
        input.type = 'password';
        btn.innerHTML = icon('eye', 18);
    }
}

function showLoginError(msg) {
    const errEl = document.getElementById('login-error');
    errEl.textContent = msg;
    errEl.style.display = 'block';
    setTimeout(() => { errEl.style.display = 'none'; }, 3000);
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { showLoginError('Inserisci username e password'); return; }
    try {
        const res = await apiPost('login.php', { username, password }, { auth: false });
        if (res.token || res.success) {
            App.login(res.token || res.data?.token);
            if (res.role) {
                App.userRole = res.role;
                localStorage.setItem('user_role', res.role);
            }
            if (res.tournament_id) {
                App.userTournamentId = res.tournament_id;
                localStorage.setItem('user_tournament_id', res.tournament_id);
            }
            if (res.first_name) {
                localStorage.setItem('user_name', res.first_name + ' ' + (res.last_name || ''));
            }
            showToast('Bentornato!', 'success');
            Router.navigate('/admin');
        } else {
            showLoginError(res.error || res.message || 'Credenziali non valide');
        }
    } catch (e) {
        showLoginError(e.message || 'Errore di connessione');
    }
}
