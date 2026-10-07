/* ========== STATS SCREEN ========== */
async function renderStats(container) {
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const [tournaments, playerStats] = await Promise.all([
            apiGet('tournaments/read.php'),
            apiGet('stats/summary.php')
        ]);
        const tList = Array.isArray(tournaments) ? tournaments : (tournaments.data || []);

        let selectedTournament = tList.length > 0 ? tList[0].id : null;
        let pStats = [];
        if (selectedTournament) {
            const res = await apiGet('stats/player_stats.php?tournament_id=' + selectedTournament);
            pStats = Array.isArray(res) ? res : (res.data || []);
        }

        let html = '<div class="screen active">';
        html += '<div class="screen-header screen-header-stats">' + ' Statistiche</div>';
        html += '<div class="screen-content">';

        if (tList.length > 0) {
            html += '<div class="form-group"><label class="form-label">Torneo</label><select class="form-select" id="stats-tournament" onchange="loadStatsForTournament(this.value)">';
            tList.forEach(t => { html += '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>'; });
            html += '</select></div>';
        }

        html += '<div class="scroll-tabs" id="stats-scroll-tabs">';
        html += '<div class="scroll-tab active" data-tab="scorers" onclick="showStatsTab(\'scorers\',this)">Marcatori</div>';
        html += '<div class="scroll-tab" data-tab="assists" onclick="showStatsTab(\'assists\',this)">Assist</div>';
        html += '<div class="scroll-tab" data-tab="cleansheets" onclick="showStatsTab(\'cleansheets\',this)">Clean Sheet</div>';
        html += '</div>';

        const scorers = [...pStats].sort((a, b) => (b.gol || 0) - (a.gol || 0)).filter(p => p.gol > 0);
        const assists = [...pStats].sort((a, b) => (b.assist || 0) - (a.assist || 0)).filter(p => p.assist > 0);
        const cleanSheets = [...pStats].sort((a, b) => (b.clean_sheets || 0) - (a.clean_sheets || 0)).filter(p => p.clean_sheets > 0);

        html += '<div id="stats-scorers" class="stats-tab-content">';
        if (scorers.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessuna statistica disponibile.');
        else scorers.forEach((p, i) => {
            html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
            html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
            html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
            html += '<div class="stat-leader-value">' + (p.gol || 0) + '</div></div>';
        });
        html += '</div>';

        html += '<div id="stats-assists" class="stats-tab-content" style="display:none">';
        if (assists.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessuna statistica disponibile.');
        else assists.forEach((p, i) => {
            html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
            html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
            html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
            html += '<div class="stat-leader-value">' + (p.assist || 0) + '</div></div>';
        });
        html += '</div>';

        html += '<div id="stats-cleansheets" class="stats-tab-content" style="display:none">';
        if (cleanSheets.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessuna statistica disponibile.');
        else cleanSheets.forEach((p, i) => {
            html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
            html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
            html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
            html += '<div class="stat-leader-value">' + (p.clean_sheets || 0) + '</div></div>';
        });
        html += '</div>';

        html += '</div></div>';
        container.innerHTML = html;
        window._statsTournaments = tList;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-header screen-header-stats">' + icon('chart', 20) + ' Statistiche</div><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}

async function loadStatsForTournament(tournamentId) {
    try {
        const pStats = await apiGet('stats/player_stats.php?tournament_id=' + tournamentId);
        const list = Array.isArray(pStats) ? pStats : (pStats.data || []);

        const scorers = [...list].sort((a, b) => (b.gol || 0) - (a.gol || 0)).filter(p => p.gol > 0);
        const assists = [...list].sort((a, b) => (b.assist || 0) - (a.assist || 0)).filter(p => p.assist > 0);
        const cleanSheets = [...list].sort((a, b) => (b.clean_sheets || 0) - (a.clean_sheets || 0)).filter(p => p.clean_sheets > 0);

        let html = '';
        if (scorers.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessuna statistica disponibile.');
        else scorers.forEach((p, i) => {
            html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
            html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
            html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
            html += '<div class="stat-leader-value">' + (p.gol || 0) + '</div></div>';
        });
        document.getElementById('stats-scorers').innerHTML = html;

        html = '';
        if (assists.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessuna statistica disponibile.');
        else assists.forEach((p, i) => {
            html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
            html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
            html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
            html += '<div class="stat-leader-value">' + (p.assist || 0) + '</div></div>';
        });
        document.getElementById('stats-assists').innerHTML = html;

        html = '';
        if (cleanSheets.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessuna statistica disponibile.');
        else cleanSheets.forEach((p, i) => {
            html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
            html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
            html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
            html += '<div class="stat-leader-value">' + (p.clean_sheets || 0) + '</div></div>';
        });
        document.getElementById('stats-cleansheets').innerHTML = html;
    } catch (e) {
        showToast('Errore nel caricamento delle statistiche', 'error');
    }
}

function showStatsTab(tab, el) {
    document.querySelectorAll('.stats-tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.scroll-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('stats-' + tab).style.display = 'block';
    el.classList.add('active');
}
