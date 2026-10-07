/* ========== TEAM DETAIL SCREEN ========== */
async function renderTeamDetail(container) {
    const id = getRouteParam();
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const [teamsRes, players, matchesRes] = await Promise.all([
            apiGet('teams/read.php'),
            apiGet('players/read.php?team_id=' + id),
            apiGet('matches/read.php')
        ]);
        const teamList = Array.isArray(teamsRes) ? teamsRes : (teamsRes.data || []);
        const t = teamList.find(tm => tm.id == id) || {};
        const pList = Array.isArray(players) ? players : (players.data || []);
        const allMatches = Array.isArray(matchesRes) ? matchesRes : (matchesRes.data || []);

        const teamMatches = allMatches.filter(m => m.home_team_id == id || m.away_team_id == id);
        const finished = teamMatches.filter(m => m.status === 'finished');
        const scheduled = teamMatches.filter(m => m.status !== 'finished');

        const played = (t.wins || 0) + (t.draws || 0) + (t.losses || 0);

        let html = '<div class="screen active">';

        /* ===== BANNER ===== */
        html += '<div class="team-detail-banner"><div class="page-header" style="background:none;padding:0;border:none">';
        html += '<button class="back-btn" onclick="Router.back()">' + icon('arrow-left', 24) + '</button>';
        html += '<div></div></div>';
        if (t.logo_url) {
            html += '<img src="' + escapeHtml(t.logo_url) + '" class="team-detail-logo" alt="Logo">';
        } else {
            html += '<div class="team-detail-logo team-detail-logo-placeholder">' + (t.name || '?').charAt(0).toUpperCase() + '</div>';
        }
        html += '<div class="team-detail-name">' + escapeHtml(t.name) + '</div>';
        if (t.tournament_name) html += '<div class="team-detail-meta">' + escapeHtml(t.tournament_name) + '</div>';
        html += '</div>';

        html += '<div class="screen-content">';

        /* ===== FOTO GRUPPO + INFO SQUADRA ===== */
        if (t.photo_url || t.tournament_name || t.coach_name || t.created_at) {
            html += '<div class="team-photo-section">';
            if (t.photo_url) {
                html += '<img src="' + escapeHtml(t.photo_url) + '" class="team-group-photo" alt="Foto Gruppo">';
            }
            html += '<div class="team-photo-info">';
            if (t.tournament_name) {
                html += '<div class="team-photo-info-row">' + icon('trophy', 16) + '<span>' + escapeHtml(t.tournament_name) + '</span></div>';
            }
            if (t.coach_name) {
                html += '<div class="team-photo-info-row">' + icon('account', 16) + '<span>Allenatore: ' + escapeHtml(t.coach_name) + '</span></div>';
            }
            if (t.created_at) {
                html += '<div class="team-photo-info-row">' + icon('clock', 16) + '<span>Iscritto il ' + formatDateShort(t.created_at) + '</span></div>';
            }
            html += '</div>';
            html += '</div>';
        }

        /* ===== STATS GRID ===== */
        if (played > 0 || t.wins || t.draws || t.losses) {
            html += '<div class="section-title-row"><h2 class="section-title">Statistiche</h2></div>';
            html += '<div class="stat-grid">';
            html += '<div class="stat-card"><div class="stat-value">' + played + '</div><div class="stat-label">Giocate</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (t.wins || 0) + '</div><div class="stat-label">Vinte</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (t.draws || 0) + '</div><div class="stat-label">Pareggiate</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (t.losses || 0) + '</div><div class="stat-label">Perse</div></div>';
            html += '</div>';
        }

        /* ===== PARTITE ===== */
        if (teamMatches.length > 0) {
            html += '<div class="section-title-row" style="margin-top:16px"><h2 class="section-title">Partite</h2><span class="header-count">' + teamMatches.length + '</span></div>';

            if (finished.length > 0) {
                const sortedFinished = finished.sort((a, b) => new Date(b.match_date) - new Date(a.match_date));
                sortedFinished.forEach(function(m) {
                    var isHome = m.home_team_id == id;
                    var homeScore = parseInt(m.home_score) || 0;
                    var awayScore = parseInt(m.away_score) || 0;

                    html += '<div class="match-card" onclick="showMatchDetail(' + m.id + ')" style="cursor:pointer">';
                    html += '<div class="match-card-teams">';
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (isHome && m.home_logo_url) {
                        html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                    } else if (!isHome && m.away_logo_url) {
                        html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (isHome ? (m.home_team || '?') : (m.away_team || '?')).charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(isHome ? (m.home_team || 'TBD') : (m.away_team || 'TBD')) + '</span></div></div>';
                    html += '<div class="match-score">';
                    html += homeScore + ' - ' + awayScore;
                    html += '</div>';
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (!isHome && m.home_logo_url) {
                        html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                    } else if (isHome && m.away_logo_url) {
                        html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (isHome ? (m.away_team || '?') : (m.home_team || '?')).charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(isHome ? (m.away_team || 'TBD') : (m.home_team || 'TBD')) + '</span></div></div>';
                    html += '</div>';
                    html += '<div class="match-card-datetime">';
                    html += '<span class="match-status match-status-finished"><span class="match-status-dot"></span>Terminata</span>';
                    html += ' &nbsp; ' + formatDateTime(m.match_date);
                    html += '</div>';
                    html += '</div>';
                });
            }

            if (scheduled.length > 0) {
                const sortedScheduled = scheduled.sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
                sortedScheduled.forEach(function(m) {
                    var isHome = m.home_team_id == id;

                    html += '<div class="match-card">';
                    html += '<div class="match-card-teams">';
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (isHome && m.home_logo_url) {
                        html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                    } else if (!isHome && m.away_logo_url) {
                        html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (isHome ? (m.home_team || '?') : (m.away_team || '?')).charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(isHome ? (m.home_team || 'TBD') : (m.away_team || 'TBD')) + '</span></div></div>';
                    html += '<div class="match-score" style="font-size:11px;font-family:var(--font-mono);color:var(--color-text-tertiary)">VS</div>';
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (!isHome && m.home_logo_url) {
                        html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                    } else if (isHome && m.away_logo_url) {
                        html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (isHome ? (m.away_team || '?') : (m.home_team || '?')).charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(isHome ? (m.away_team || 'TBD') : (m.home_team || 'TBD')) + '</span></div></div>';
                    html += '</div>';
                    html += '<div class="match-card-datetime">';
                    html += '<span class="match-status match-status-scheduled"><span class="match-status-dot"></span>Pianificata</span>';
                    html += ' &nbsp; ' + formatDateTime(m.match_date);
                    html += '</div>';
                    html += '</div>';
                });
            }
        }

        /* ===== GIOCATORI ===== */
        html += '<div class="section-title-row" style="margin-top:16px"><h2 class="section-title">Giocatori</h2><span class="header-count">' + pList.length + '</span></div>';
        if (pList.length === 0) {
            html += showEmpty('account', 'Nessun giocatore', 'Nessun giocatore assegnato a questa squadra.');
        } else {
            pList.forEach(p => {
                html += '<div class="list-item" onclick="Router.navigate(\'/giocatore/' + p.id + '\')">';
                html += '<div class="list-item-content">';
                html += '<div class="list-item-title">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
                let meta = [];
                if (p.role) meta.push(escapeHtml(p.role));
                if (p.age) meta.push(p.age + ' anni');
                if (meta.length) html += '<div class="list-item-subtitle">' + meta.join(' \u00b7 ') + '</div>';
                html += '</div></div>';
            });
        }

        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}
