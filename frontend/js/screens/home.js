/* ========== HOME SCREEN ========== */
async function renderHome(container) {
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const [stats, tournaments, matches] = await Promise.all([
            apiGet('stats/summary.php'),
            apiGet('tournaments/read.php'),
            apiGet('matches/read.php')
        ]);
        const tList = Array.isArray(tournaments) ? tournaments : (tournaments.data || []);
        const mList = Array.isArray(matches) ? matches : (matches.data || []);
        const sData = stats.data || stats;

        const totalGoals = mList.filter(m => m.home_score !== undefined && m.home_score !== null)
            .reduce((sum, m) => sum + (parseInt(m.home_score) || 0) + (parseInt(m.away_score) || 0), 0);

        let html = '<div class="screen active">';
        html += '<div class="screen-header screen-header-home home-header-logo">';
        html += '<img src="assets/Fut.webp" class="home-header-img" alt="Futsal Manager">';
        html += '<p class="home-header-subtitle">Gestisci il tuo torneo di calcetto in un unico posto</p>';
        html += '<button class="theme-toggle theme-toggle-home" onclick="toggleTheme()" aria-label="Cambia tema">' + icon(App.theme === 'bright' ? 'moon' : 'sun', 20) + '</button>';
        html += '</div>';
        html += '<div class="screen-content">';

        /* ===== HERO STAT ===== */
        html += '<div class="hero-stat animate-scaleIn">';
        html += '<div class="hero-stat-value">' + (sData.tournaments || 0) + '</div>';
        html += '<div class="hero-stat-label">Tornei attivi</div>';
        html += '<div class="hero-stats-row">';
        html += '<div class="hero-mini-stat"><div class="hero-mini-stat-value">' + (sData.teams || 0) + '</div><div class="hero-mini-stat-label">Squadre</div></div>';
        html += '<div class="hero-mini-stat"><div class="hero-mini-stat-value">' + (sData.players || 0) + '</div><div class="hero-mini-stat-label">Giocatori</div></div>';
        html += '<div class="hero-mini-stat"><div class="hero-mini-stat-value">' + (sData.matches || 0) + '</div><div class="hero-mini-stat-label">Partite</div></div>';
        html += '</div>';
        html += '</div>';

        /* ===== TORNEI RECENTI ===== */
        if (tList.length > 0) {
            html += '<div class="section animate-slideUp"><div class="section-header"><h2 class="section-title">Tornei</h2><span class="section-link" onclick="Router.navigate(\'/tornei\')">Vedi tutti</span></div>';
            tList.filter(t => t.status === 'active' || t.status === 'finished').slice(0, 5).forEach(t => {
                let logoHtml = '';
                if (t.logo_url) {
                    logoHtml = '<img src="' + escapeHtml(t.logo_url) + '" class="list-item-logo" alt="Logo">';
                } else {
                    logoHtml = '<div class="list-item-logo-placeholder">' + icon('trophy', 20) + '</div>';
                }
                const tMatches = mList.filter(m => m.tournament_id == t.id);
                const hasLive = tMatches.some(m => m.status === 'in_corso' || m.status === 'live');
                let matchInfo = '';
                if (hasLive) {
                    matchInfo = '<div class="list-item-match-info"><span class="live-badge">Live</span></div>';
                } else if (tMatches.length > 0) {
                    matchInfo = '<div class="list-item-match-info">' + icon('calendar', 14) + ' ' + tMatches.length + ' partite</div>';
                } else {
                    matchInfo = '<div class="list-item-match-info list-item-match-info--empty">' + icon('calendar', 14) + ' Nessuna partita</div>';
                }
                html += '<div class="list-item" onclick="Router.navigate(\'/torneo/' + t.id + '\')">';
                html += logoHtml;
                html += '<div class="list-item-content">';
                html += '<div class="list-item-title">' + escapeHtml(t.name) + '</div>';
                html += '<div class="list-item-subtitle">';
                html += statusBadge(t.status);
                html += ' <span class="tournament-type-badge">' + (t.type || '5v5') + '</span>';
                html += '</div>';
                html += matchInfo;
                html += '</div><div class="list-item-right">' + icon('chevron-right', 18) + '</div></div>';
            });
            html += '</div>';
        }

        /* ===== INFO ===== */
        html += '<div class="section animate-slideUp">';
        html += '<div class="section-header"><h2 class="section-title">Info</h2></div>';

        html += '<div class="list-item" onclick="Router.navigate(\'/notizie\')">';
        html += '<div class="list-item-logo-placeholder" style="background:var(--color-warning-bg);color:var(--color-warning)">' + icon('newspaper', 20) + '</div>';
        html += '<div class="list-item-content"><div class="list-item-title">Notizie</div>';
        html += '<div class="list-item-subtitle">Ultime novità dal mondo futsal</div></div>';
        html += '<div class="list-item-right">' + icon('chevron-right', 18) + '</div></div>';

        html += '<div class="list-item" onclick="Router.navigate(\'/chi-siamo\')">';
        html += '<div class="list-item-logo-placeholder" style="background:var(--color-primary-light);color:var(--color-primary)">' + icon('information', 20) + '</div>';
        html += '<div class="list-item-content"><div class="list-item-title">Chi Siamo</div>';
        html += '<div class="list-item-subtitle">Scopri di più su Futsal Manager</div></div>';
        html += '<div class="list-item-right">' + icon('chevron-right', 18) + '</div></div>';

        html += '<div class="list-item" onclick="Router.navigate(\'/contattaci\')">';
        html += '<div class="list-item-logo-placeholder" style="background:var(--color-success-bg);color:var(--color-success)">' + icon('email', 20) + '</div>';
        html += '<div class="list-item-content"><div class="list-item-title">Contattaci</div>';
        html += '<div class="list-item-subtitle">Hai domande? Scrivici</div></div>';
        html += '<div class="list-item-right">' + icon('chevron-right', 18) + '</div></div>';

        html += '</div>';

        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-header screen-header-home">' + icon('soccer-field', 20) + ' Futsal Manager</div><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}
