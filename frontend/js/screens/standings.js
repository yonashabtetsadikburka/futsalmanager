/* ========== STANDINGS SCREEN ========== */
async function renderStandings(container) {
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const [tournaments, groups] = await Promise.all([
            apiGet('tournaments/read.php'),
            apiGet('groups/read.php')
        ]);
        const tList = Array.isArray(tournaments) ? tournaments : (tournaments.data || []);
        const gList = Array.isArray(groups) ? groups : (groups.data || []);

        let html = '<div class="screen active">';
        html += '<div class="screen-header screen-header-standings">' + ' Classifiche</div>';
        html += '<div class="screen-content">';

        if (tList.length === 0) {
            html += showEmpty('format-list-numbered', 'Nessuna classifica', 'Nessun torneo disponibile.');
        } else {
            html += '<div class="form-group"><label class="form-label">Torneo</label><select class="form-select" id="standings-tournament" onchange="loadStandingsForTournament(this.value)">';
            tList.forEach(t => { html += '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>'; });
            html += '</select></div>';
            html += '<div id="standings-content">' + showLoading() + '</div>';
        }
        html += '</div></div>';
        container.innerHTML = html;
        if (tList.length > 0) loadStandingsForTournament(tList[0].id);
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-header screen-header-standings">' + icon('format-list-numbered', 20) + ' Classifiche</div><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}

async function loadStandingsForTournament(tournamentId) {
    const el = document.getElementById('standings-content');
    el.innerHTML = showLoading();
    try {
        const [tournaments, groups, standings] = await Promise.all([
            apiGet('tournaments/read.php?id=' + tournamentId),
            apiGet('groups/read.php?tournament_id=' + tournamentId),
            apiGet('groups/standings.php?tournament_id=' + tournamentId)
        ]);
        const tList = Array.isArray(tournaments) ? tournaments : (tournaments.data || []);
        const gList = Array.isArray(groups) ? groups : (groups.data || []);
        const sList = Array.isArray(standings) ? standings : (standings.data || []);
        const currentTournament = tList.length > 0 ? tList[0] : null;
        const isRoundRobin = currentTournament && currentTournament.format === 'round_robin';

        if (isRoundRobin) {
            /* Round Robin: usa tournament-level standings */
            const tStandings = await apiGet('tournaments/standings.php?tournament_id=' + tournamentId);
            const tStandingsList = Array.isArray(tStandings) ? tStandings : (tStandings.data || []);

            let html = '';
            html += '<div class="group-section"><div class="group-title">Classifica Generale</div>';
            html += '<div class="table-wrapper"><table class="standings-table"><thead><tr><th style="width:32px">#</th><th>Squadra</th><th style="width:28px">G</th><th style="width:28px">V</th><th style="width:28px">N</th><th style="width:28px">P</th><th style="width:32px">GF</th><th style="width:32px">GS</th><th style="width:32px">DR</th><th style="width:36px" class="th-pt">Pt</th></tr></thead><tbody>';
            tStandingsList.forEach((s, i) => {
                const played = (s.wins || 0) + (s.draws || 0) + (s.losses || 0);
                const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                html += '<tr><td><span class="table-pos ' + posClass + '">' + (i + 1) + '</span></td>';
                html += '<td><span class="table-team">';
                if (s.logo_url) {
                    html += '<img src="' + escapeHtml(s.logo_url) + '" class="table-team-logo" alt="">';
                } else {
                    html += '<span class="table-team-logo-placeholder">' + (s.name || '?').charAt(0) + '</span>';
                }
                html += escapeHtml(s.name || '') + '</span></td>';
                html += '<td>' + played + '</td><td>' + (s.wins || 0) + '</td><td>' + (s.draws || 0) + '</td><td>' + (s.losses || 0) + '</td>';
                html += '<td>' + (s.goals_scored || 0) + '</td><td>' + (s.goals_conceded || 0) + '</td><td>' + (s.diff_reti || 0) + '</td>';
                html += '<td class="td-pt"><strong>' + (s.punti || 0) + '</strong></td></tr>';
            });
            html += '</tbody></table></div></div>';

            el.innerHTML = html || showEmpty('format-list-numbered', 'Nessun dato', 'Nessuna classifica disponibile.');
        } else {
            /* Gironi: logica esistente */
            if (gList.length === 0) {
                el.innerHTML = showEmpty('google-circles', 'Nessun girone', 'Nessun girone trovato per questo torneo.');
                return;
            }
            let html = '';
            gList.forEach(g => {
                const groupStandings = sList.filter(s => s.group_id == g.id);
                groupStandings.sort((a, b) => (b.punti || 0) - (a.punti || 0) || (b.diff_reti || 0) - (a.diff_reti || 0));
                html += '<div class="group-section"><div class="group-title">' + escapeHtml(g.name) + '</div>';
                html += '<div class="table-wrapper"><table class="standings-table"><thead><tr><th style="width:32px">#</th><th>Squadra</th><th style="width:28px">G</th><th style="width:28px">V</th><th style="width:28px">N</th><th style="width:28px">P</th><th style="width:32px">GF</th><th style="width:32px">GS</th><th style="width:32px">DR</th><th style="width:36px" class="th-pt">Pt</th></tr></thead><tbody>';
                groupStandings.forEach((s, i) => {
                    const played = (s.wins || 0) + (s.draws || 0) + (s.losses || 0);
                    const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                    html += '<tr><td><span class="table-pos ' + posClass + '">' + (i + 1) + '</span></td>';
                    html += '<td><span class="table-team">';
                    if (s.logo_url) {
                        html += '<img src="' + escapeHtml(s.logo_url) + '" class="table-team-logo" alt="">';
                    } else {
                        html += '<span class="table-team-logo-placeholder">' + (s.name || '?').charAt(0) + '</span>';
                    }
                    html += escapeHtml(s.name || '') + '</span></td>';
                    html += '<td>' + played + '</td><td>' + (s.wins || 0) + '</td><td>' + (s.draws || 0) + '</td><td>' + (s.losses || 0) + '</td>';
                    html += '<td>' + (s.goals_scored || 0) + '</td><td>' + (s.goals_conceded || 0) + '</td><td>' + (s.diff_reti || 0) + '</td>';
                    html += '<td class="td-pt"><strong>' + (s.punti || 0) + '</strong></td></tr>';
                });
                html += '</tbody></table></div></div>';
            });
            el.innerHTML = html || showEmpty('format-list-numbered', 'Nessun dato', 'Nessuna classifica disponibile.');
        }
    } catch (e) {
        el.innerHTML = '<div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div>';
    }
}
