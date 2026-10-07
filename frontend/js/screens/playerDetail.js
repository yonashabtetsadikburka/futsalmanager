/* ========== PLAYER DETAIL SCREEN ========== */
async function renderPlayerDetail(container) {
    const id = getRouteParam();
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const [playersRes, teamsRes] = await Promise.all([
            apiGet('players/read.php'),
            apiGet('teams/read.php')
        ]);
        const allPlayers = Array.isArray(playersRes) ? playersRes : (playersRes.data || []);
        const allTeams = Array.isArray(teamsRes) ? teamsRes : (teamsRes.data || []);

        const p = allPlayers.find(pl => pl.id == id);
        if (!p) {
            container.innerHTML = '<div class="screen active"><div class="screen-content"><div class="empty-state">' + icon('account', 48) + '<h3>Giocatore non trovato</h3><p>Il giocatore richiesto non esiste.</p></div></div></div>';
            hideFAB();
            return;
        }

        const team = allTeams.find(t => t.id == p.team_id) || {};
        const tournamentId = team.tournament_id || p.tournament_id;

        let playerStats = null;
        if (tournamentId) {
            try {
                const statsRes = await apiGet('stats/player_stats.php?tournament_id=' + tournamentId);
                const allStats = Array.isArray(statsRes) ? statsRes : (statsRes.data || []);
                playerStats = allStats.find(s => s.id == id) || null;
            } catch (e) {}
        }

        const fullName = escapeHtml((p.first_name || '') + ' ' + (p.last_name || ''));
        const roleLabel = p.role || 'N/D';
        const roleColor = getRoleColor(p.role);

        let html = '<div class="screen active">';

        /* ===== BANNER ===== */
        html += '<div class="team-detail-banner"><div class="page-header" style="background:none;padding:0;border:none">';
        html += '<button class="back-btn" onclick="Router.back()">' + icon('arrow-left', 24) + '</button>';
        html += '<div></div></div>';
        if (p.photo_url) {
            html += '<img src="' + escapeHtml(p.photo_url) + '" class="player-detail-photo" alt="Foto">';
        } else {
            html += '<div class="team-detail-logo team-detail-logo-placeholder">' + (p.first_name || '?').charAt(0).toUpperCase() + '</div>';
        }
        html += '<div class="team-detail-name">' + fullName + '</div>';
        html += '<div class="team-detail-meta">';
        html += '<span class="badge" style="background:' + roleColor + ';color:#fff;font-size:11px;padding:2px 8px;border-radius:12px">' + escapeHtml(roleLabel) + '</span>';
        if (p.age) html += ' <span style="margin-left:8px">' + p.age + ' anni</span>';
        html += '</div>';
        html += '</div>';

        html += '<div class="screen-content">';

        /* ===== INFO ===== */
        html += '<div class="card" style="margin-bottom:16px">';
        html += '<div class="card-body">';
        if (p.team_name) {
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' + icon('shield', 16) + '<span style="font-size:13px">' + escapeHtml(p.team_name) + '</span></div>';
        }
        if (p.tournament_name || team.tournament_name) {
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' + icon('medal', 16) + '<span style="font-size:13px">' + escapeHtml(p.tournament_name || team.tournament_name || '') + '</span></div>';
        }
        if (p.created_at) {
            html += '<div style="display:flex;align-items:center;gap:8px">' + icon('clock', 16) + '<span style="font-size:13px">Iscritto il ' + formatDateShort(p.created_at) + '</span></div>';
        }
        html += '</div></div>';

        /* ===== STATS ===== */
        html += '<div class="section-title-row"><h2 class="section-title">Statistiche</h2></div>';
        if (playerStats) {
            html += '<div class="stat-grid">';
            html += '<div class="stat-card"><div class="stat-value">' + (playerStats.gol || 0) + '</div><div class="stat-label">Gol</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (playerStats.assist || 0) + '</div><div class="stat-label">Assist</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (playerStats.presenze || 0) + '</div><div class="stat-label">Presenze</div></div>';
            html += '<div class="stat-card"><div class="stat-value">' + (playerStats.clean_sheets || 0) + '</div><div class="stat-label">Clean Sheet</div></div>';
            html += '</div>';

            if (playerStats.group_name) {
                html += '<div style="text-align:center;margin-top:8px;font-size:12px;color:var(--color-text-tertiary)">';
                html += 'Girone: ' + escapeHtml(playerStats.group_name);
                html += '</div>';
            }
        } else {
            html += showEmpty('chart', 'Nessuna statistica', 'Nessuna statistica disponibile per questo giocatore.');
        }

        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}

function getRoleColor(role) {
    switch (role) {
        case 'Portiere': return 'var(--color-warning)';
        case 'Difensore': return 'var(--color-indigo)';
        case 'Centrocampista': return 'var(--color-success)';
        case 'Attaccante': return 'var(--color-primary)';
        default: return 'var(--color-text-tertiary)';
    }
}
