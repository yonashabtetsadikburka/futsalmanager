/* ========== ADMIN DASHBOARD ========== */
async function renderAdminDashboard(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const isOrg = App.isOrganizer();
        const endpoints = isOrg
            ? ['stats/summary.php?tournament_id=' + App.userTournamentId, 'tournaments/read_one.php?id=' + App.userTournamentId]
            : ['stats/summary.php', 'tournaments/read.php'];

        const [stats, tournamentRes] = await Promise.all(endpoints.map(e => apiGet(e)));
        const sData = stats.data || stats;
        const tData = tournamentRes.data || tournamentRes;
        const tList = Array.isArray(tData) ? tData : [tData];

        let html = '<div class="screen active">';
        html += '<div class="screen-header screen-header-admin" style="justify-content:space-between">';
        html += '<span style="display:flex;align-items:center;gap:var(--space-md)">' + ' ' + (isOrg ? 'Dashboard Organizzatore' : 'Dashboard Admin') + '</span>';
        html += '<span style="display:flex;align-items:center;gap:8px">';
        html += '<button class="theme-toggle desktop-only-hide" onclick="toggleThemeAdmin()" aria-label="Cambia tema">' + icon(App.theme === 'bright' ? 'moon' : 'sun', 20) + '</button>';
        html += '<button class="theme-toggle desktop-only-hide" onclick="App.logout()" aria-label="Logout" style="color:var(--color-error)">' + icon('logout', 20) + '</button>';
        html += '</span></div>';
        html += '<div class="screen-content">';

        if (isOrg && tList.length > 0) {
            const t = tList[0];
            html += '<h1 class="admin-welcome">' + escapeHtml(t.name) + '</h1>';
            html += '<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:24px">';
            html += '<div style="font-size:11px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Codice Organizzatore</div>';
            html += '<div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--color-primary);letter-spacing:1px">' + escapeHtml(t.organizer_code || 'N/A') + '</div>';
            html += '</div>';
        } else {
            
            html += '<p style="color:var(--color-text-secondary);margin-bottom:24px">Gestione tornei e squadre</p>';
        }

        html += '<div class="section"><div class="stat-grid">';
        if (isOrg) {
            html += '<div class="stat-card"><div class="stat-value">' + (sData.teams || 0) + '</div><div class="stat-label">Squadre</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (sData.players || 0) + '</div><div class="stat-label">Giocatori</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (sData.matches || 0) + '</div><div class="stat-label">Partite</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (sData.finished || 0) + '</div><div class="stat-label">Completate</div></div>';
        } else {
            html += '<div class="stat-card"><div class="stat-value">' + (sData.tournaments || tList.length || 0) + '</div><div class="stat-label">Tornei</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (sData.teams || 0) + '</div><div class="stat-label">Squadre</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (sData.players || 0) + '</div><div class="stat-label">Giocatori</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (sData.matches || 0) + '</div><div class="stat-label">Partite</div></div>';
        }
        html += '</div></div>';

        html += '<div class="section"><h2 class="section-title" style="margin-bottom:16px">Gestione</h2>';
        html += '<div class="admin-nav-grid">';
        if (!isOrg) {
            html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/tornei\')"><div class="admin-nav-icon" style="background:var(--color-primary)">' + icon('flag-checkered', 24) + '</div><div class="admin-nav-label">Tornei</div></div>';
        }
        html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/squadre\')"><div class="admin-nav-icon" style="background:#6366f1">' + icon('shield-account', 24) + '</div><div class="admin-nav-label">Squadre</div></div>';
        html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/gruppi\')"><div class="admin-nav-icon" style="background:#7c3aed">' + icon('medal', 24) + '</div><div class="admin-nav-label">Gironi</div></div>';
        html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/classifiche\')"><div class="admin-nav-icon" style="background:var(--color-success)">' + icon('medal', 24) + '</div><div class="admin-nav-label">Classifiche</div></div>';
        html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/partite\')"><div class="admin-nav-icon" style="background:var(--color-warning)">' + icon('soccer-field', 24) + '</div><div class="admin-nav-label">Partite</div></div>';
        html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/giocatori\')"><div class="admin-nav-icon" style="background:#0891b2">' + icon('soccer', 24) + '</div><div class="admin-nav-label">Giocatori</div></div>';
        html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/allenatori\')"><div class="admin-nav-icon" style="background:#be185d">' + icon('whistle', 24) + '</div><div class="admin-nav-label">Allenatori</div></div>';
        if (isOrg) {
            html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/manuale\')"><div class="admin-nav-icon" style="background:#f59e0b">' + icon('book-open-variant', 24) + '</div><div class="admin-nav-label">Manuale</div></div>';
            html += '<div class="admin-nav-item" onclick="Router.navigate(\'/admin/export-pdf\')"><div class="admin-nav-icon" style="background:var(--color-error)">' + icon('file-pdf-box', 24) + '</div><div class="admin-nav-label">Esporta PDF</div></div>';
        }
        html += '</div></div>';
        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-header screen-header-admin" style="justify-content:space-between"><span style="display:flex;align-items:center;gap:var(--space-md)">' + icon('shield-star', 20) + ' Admin</span><span style="display:flex;align-items:center;gap:8px"><button class="theme-toggle" onclick="toggleThemeAdmin()" aria-label="Cambia tema">' + icon(App.theme === 'bright' ? 'moon' : 'sun', 20) + '</button><button class="theme-toggle" onclick="App.logout()" aria-label="Logout" style="color:var(--color-error)">' + icon('logout', 20) + '</button></span></div><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}
