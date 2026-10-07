/* ========== ADMIN STANDINGS ========== */

var _adminStandingsEditing = {};

async function renderAdminStandings(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const isOrg = App.isOrganizer();

        let html = '<div class="screen active"><div class="screen-content">';
        html += '<h1 class="section-title" style="margin-bottom:16px">Gestione Classifiche</h1>';
        html += '<div style="height:2px;background:var(--color-primary);margin-bottom:16px"></div>';

        if (isOrg) {
            var tRes = await apiGet('tournaments/read.php?id=' + App.userTournamentId);
            var tList = Array.isArray(tRes) ? tRes : (tRes.data || []);
            var tName = tList.length > 0 ? tList[0].name : '';
            html += '<div style="margin-bottom:16px;font-size:14px;color:var(--color-text-secondary)">' + ' <strong>' + escapeHtml(tName) + '</strong></div>';
            html += '<div id="admin-standings-content">' + showLoading() + '</div>';
            html += '</div></div>';
            container.innerHTML = html;
            loadAdminStandings(App.userTournamentId);
        } else {
            const endpoints = ['tournaments/read.php', 'groups/read.php'];
            const [tournaments, groups] = await Promise.all(endpoints.map(e => apiGet(e)));
            const tList = Array.isArray(tournaments) ? tournaments : (tournaments.data || []);

            html += '<div class="form-group"><label class="form-label">Torneo</label><select class="form-select" id="admin-standings-tournament" onchange="_adminStandingsEditing={};loadAdminStandings(this.value)">';
            tList.forEach(t => { html += '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>'; });
            html += '</select></div>';
            html += '<div id="admin-standings-content">' + showLoading() + '</div>';
            html += '</div></div>';
            container.innerHTML = html;
            if (tList.length > 0) loadAdminStandings(tList[0].id);
        }
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><p>Errore nel caricamento.</p></div></div>';
    }
    hideFAB();
}

async function loadAdminStandings(tournamentId) {
    const el = document.getElementById('admin-standings-content');
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
            html += '<div class="card" style="margin-bottom:16px">';
            html += '<div class="card-header"><h3>Classifica Generale</h3></div>';
            html += '<div class="card-body" style="padding:0">';
            html += '<div class="table-wrapper"><table class="standings-table">';
            html += '<thead><tr>';
            html += '<th style="width:32px">#</th>';
            html += '<th>Squadra</th>';
            html += '<th style="width:28px">G</th>';
            html += '<th style="width:28px">V</th>';
            html += '<th style="width:28px">N</th>';
            html += '<th style="width:28px">P</th>';
            html += '<th style="width:32px">GF</th>';
            html += '<th style="width:32px">GS</th>';
            html += '<th style="width:32px">DR</th>';
            html += '<th style="width:36px" class="th-pt">Pt</th>';
            html += '<th style="width:40px"></th>';
            html += '</tr></thead><tbody>';

            tStandingsList.forEach((s, i) => {
                const played = (s.wins || 0) + (s.draws || 0) + (s.losses || 0);
                const diff = (s.goals_scored || 0) - (s.goals_conceded || 0);
                const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                const isEditing = _adminStandingsEditing[s.id];

                html += '<tr id="standing-row-' + s.id + '">';

                // Posizione
                html += '<td><span class="table-pos ' + posClass + '">' + (i + 1) + '</span></td>';

                // Squadra
                html += '<td><span class="table-team">';
                if (s.logo_url) html += '<img src="' + escapeHtml(s.logo_url) + '" class="table-team-logo" alt="">';
                html += escapeHtml(s.name || '') + '</span></td>';

                if (isEditing) {
                    // Modalita modifica - input fields
                    html += adminStandingInput(s.id, 'wins', s.wins || 0);
                    html += adminStandingInput(s.id, 'draws', s.draws || 0);
                    html += adminStandingInput(s.id, 'losses', s.losses || 0);
                    html += adminStandingInput(s.id, 'goals_scored', s.goals_scored || 0);
                    html += adminStandingInput(s.id, 'goals_conceded', s.goals_conceded || 0);
                    // DR calcolato
                    html += '<td id="standing-dr-' + s.id + '" style="text-align:center;font-size:12px">' + diff + '</td>';
                    // Pt calcolato
                    html += '<td class="td-pt" id="standing-pt-' + s.id + '"><strong>' + (s.punti || 0) + '</strong></td>';
                    // Pulsanti Salva/Annulla
                    html += '<td style="text-align:center">';
                    html += '<span style="cursor:pointer;color:var(--color-success)" onclick="saveAdminStanding(' + s.id + ')" title="Salva">' + icon('check', 16) + '</span> ';
                    html += '<span style="cursor:pointer;color:var(--color-error)" onclick="cancelAdminStanding(' + s.id + ')" title="Annulla">' + icon('close', 16) + '</span>';
                    html += '</td>';
                } else {
                    // Modalita lettura
                    html += '<td style="text-align:center">' + played + '</td>';
                    html += '<td style="text-align:center">' + (s.wins || 0) + '</td>';
                    html += '<td style="text-align:center">' + (s.draws || 0) + '</td>';
                    html += '<td style="text-align:center">' + (s.losses || 0) + '</td>';
                    html += '<td style="text-align:center">' + (s.goals_scored || 0) + '</td>';
                    html += '<td style="text-align:center">' + (s.goals_conceded || 0) + '</td>';
                    html += '<td style="text-align:center">' + diff + '</td>';
                    html += '<td class="td-pt"><strong>' + (s.punti || 0) + '</strong></td>';
                    // Pulsante Modifica
                    html += '<td style="text-align:center"><span style="cursor:pointer;color:var(--color-primary)" onclick="editAdminStanding(' + s.id + ')" title="Modifica">' + icon('pencil', 15) + '</span></td>';
                }

                html += '</tr>';
            });

            html += '</tbody></table></div></div></div>';

            el.innerHTML = html || showEmpty('format-list-numbered', 'Nessun dato', 'Nessuna classifica disponibile.');
        } else {
            /* Gironi: logica esistente */
            if (gList.length === 0) {
                el.innerHTML = showEmpty('google-circles', 'Nessun girone', 'Nessun girone configurato per questo torneo.');
                return;
            }

            let html = '';
            gList.forEach(g => {
                const groupStandings = sList.filter(s => s.group_id == g.id);
                groupStandings.sort((a, b) => (b.punti || 0) - (a.punti || 0) || (b.diff_reti || 0) - (a.diff_reti || 0));

                html += '<div class="card" style="margin-bottom:16px">';
                html += '<div class="card-header"><h3>' + escapeHtml(g.name) + '</h3></div>';
                html += '<div class="card-body" style="padding:0">';
                html += '<div class="table-wrapper"><table class="standings-table">';
                html += '<thead><tr>';
                html += '<th style="width:32px">#</th>';
                html += '<th>Squadra</th>';
                html += '<th style="width:28px">G</th>';
                html += '<th style="width:28px">V</th>';
                html += '<th style="width:28px">N</th>';
                html += '<th style="width:28px">P</th>';
                html += '<th style="width:32px">GF</th>';
                html += '<th style="width:32px">GS</th>';
                html += '<th style="width:32px">DR</th>';
                html += '<th style="width:36px" class="th-pt">Pt</th>';
                html += '<th style="width:40px"></th>';
                html += '</tr></thead><tbody>';

                groupStandings.forEach((s, i) => {
                    const played = (s.wins || 0) + (s.draws || 0) + (s.losses || 0);
                    const diff = (s.goals_scored || 0) - (s.goals_conceded || 0);
                    const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                    const isEditing = _adminStandingsEditing[s.id];

                    html += '<tr id="standing-row-' + s.id + '">';

                    // Posizione
                    html += '<td><span class="table-pos ' + posClass + '">' + (i + 1) + '</span></td>';

                    // Squadra
                    html += '<td><span class="table-team">';
                    if (s.logo_url) html += '<img src="' + escapeHtml(s.logo_url) + '" class="table-team-logo" alt="">';
                    html += escapeHtml(s.name || '') + '</span></td>';

                    if (isEditing) {
                        // Modalita modifica - input fields
                        html += adminStandingInput(s.id, 'wins', s.wins || 0);
                        html += adminStandingInput(s.id, 'draws', s.draws || 0);
                        html += adminStandingInput(s.id, 'losses', s.losses || 0);
                        html += adminStandingInput(s.id, 'goals_scored', s.goals_scored || 0);
                        html += adminStandingInput(s.id, 'goals_conceded', s.goals_conceded || 0);
                        // DR calcolato
                        html += '<td id="standing-dr-' + s.id + '" style="text-align:center;font-size:12px">' + diff + '</td>';
                        // Pt calcolato
                        html += '<td class="td-pt" id="standing-pt-' + s.id + '"><strong>' + (s.punti || 0) + '</strong></td>';
                        // Pulsanti Salva/Annulla
                        html += '<td style="text-align:center">';
                        html += '<span style="cursor:pointer;color:var(--color-success)" onclick="saveAdminStanding(' + s.id + ')" title="Salva">' + icon('check', 16) + '</span> ';
                        html += '<span style="cursor:pointer;color:var(--color-error)" onclick="cancelAdminStanding(' + s.id + ')" title="Annulla">' + icon('close', 16) + '</span>';
                        html += '</td>';
                    } else {
                        // Modalita lettura
                        html += '<td style="text-align:center">' + played + '</td>';
                        html += '<td style="text-align:center">' + (s.wins || 0) + '</td>';
                        html += '<td style="text-align:center">' + (s.draws || 0) + '</td>';
                        html += '<td style="text-align:center">' + (s.losses || 0) + '</td>';
                        html += '<td style="text-align:center">' + (s.goals_scored || 0) + '</td>';
                        html += '<td style="text-align:center">' + (s.goals_conceded || 0) + '</td>';
                        html += '<td style="text-align:center">' + diff + '</td>';
                        html += '<td class="td-pt"><strong>' + (s.punti || 0) + '</strong></td>';
                        // Pulsante Modifica
                        html += '<td style="text-align:center"><span style="cursor:pointer;color:var(--color-primary)" onclick="editAdminStanding(' + s.id + ')" title="Modifica">' + icon('pencil', 15) + '</span></td>';
                    }

                    html += '</tr>';
                });

                html += '</tbody></table></div></div></div>';
            });

            el.innerHTML = html || showEmpty('format-list-numbered', 'Nessun dato', 'Nessuna classifica disponibile.');
        }
    } catch (e) {
        el.innerHTML = '<p>Errore nel caricamento.</p>';
    }
}

function adminStandingInput(teamId, field, value) {
    return '<td style="text-align:center;padding:2px"><input type="number" min="0" class="form-input" style="width:36px;padding:2px;text-align:center;font-size:12px" id="standing-' + teamId + '-' + field + '" value="' + value + '" onchange="adminStandingRecalc(' + teamId + ')"></td>';
}

function adminStandingRecalc(teamId) {
    var w = parseInt(document.getElementById('standing-' + teamId + '-wins').value) || 0;
    var d = parseInt(document.getElementById('standing-' + teamId + '-draws').value) || 0;
    var l = parseInt(document.getElementById('standing-' + teamId + '-losses').value) || 0;
    var gf = parseInt(document.getElementById('standing-' + teamId + '-goals_scored').value) || 0;
    var gs = parseInt(document.getElementById('standing-' + teamId + '-goals_conceded').value) || 0;
    var dr = gf - gs;
    var pt = w * 3 + d;
    var drEl = document.getElementById('standing-dr-' + teamId);
    var ptEl = document.getElementById('standing-pt-' + teamId);
    if (drEl) drEl.textContent = dr;
    if (ptEl) ptEl.innerHTML = '<strong>' + pt + '</strong>';
}

function editAdminStanding(teamId) {
    _adminStandingsEditing[teamId] = true;
    var tournamentId = App.isOrganizer() ? App.userTournamentId : document.getElementById('admin-standings-tournament').value;
    loadAdminStandings(tournamentId);
}

function cancelAdminStanding(teamId) {
    delete _adminStandingsEditing[teamId];
    var tournamentId = App.isOrganizer() ? App.userTournamentId : document.getElementById('admin-standings-tournament').value;
    loadAdminStandings(tournamentId);
}

async function saveAdminStanding(teamId) {
    var data = {
        id: teamId,
        wins: parseInt(document.getElementById('standing-' + teamId + '-wins').value) || 0,
        draws: parseInt(document.getElementById('standing-' + teamId + '-draws').value) || 0,
        losses: parseInt(document.getElementById('standing-' + teamId + '-losses').value) || 0,
        goals_scored: parseInt(document.getElementById('standing-' + teamId + '-goals_scored').value) || 0,
        goals_conceded: parseInt(document.getElementById('standing-' + teamId + '-goals_conceded').value) || 0
    };
    try {
        await apiPut('teams/update_standings.php', data);
        delete _adminStandingsEditing[teamId];
        showToast('Classifica aggiornata', 'success');
        var tournamentId = App.isOrganizer() ? App.userTournamentId : document.getElementById('admin-standings-tournament').value;
        loadAdminStandings(tournamentId);
    } catch (e) {
        showToast('Errore nel salvataggio', 'error');
    }
}
