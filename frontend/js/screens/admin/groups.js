/* ========== ADMIN GROUPS ========== */

var _gSelectedTournament = null;
var _gSelectedFormat = 'girone';

async function renderAdminGroups(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const isOrg = App.isOrganizer();
        const tRes = isOrg ? await apiGet('tournaments/read.php?id=' + App.userTournamentId) : await apiGet('tournaments/read.php');
        const tList = Array.isArray(tRes) ? tRes : (tRes.data || []);
        _gSelectedTournament = isOrg ? App.userTournamentId : null;
        _gSelectedFormat = 'girone';

        let html = '<div class="screen active"><div class="screen-content">';
        html += '<h1 class="section-title" style="margin-bottom:16px">Gestione Gironi</h1>';
        html += '<div style="height:2px;background:var(--color-primary);margin-bottom:16px"></div>';

        /* Torneo selector per generate knockout */
        var showKnockoutSection = !isOrg || (_gSelectedFormat === 'girone');
        if (showKnockoutSection) {
        html += '<div class="card" style="margin-bottom:16px"><div class="card-body">';
        html += '<div style="font-weight:600;font-size:14px;margin-bottom:12px">Eliminazione Diretta</div>';
        if (isOrg) {
            var orgT = tList.find(t => t.id == App.userTournamentId);
            html += '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:12px">' + icon('information', 14) + ' Torneo: <strong>' + escapeHtml(orgT ? orgT.name : 'N/A') + '</strong></div>';
            html += '<input type="hidden" id="ko-tournament-select" value="' + App.userTournamentId + '">';
        } else {
            html += '<div class="form-group"><label class="form-label">Torneo</label><select class="form-select" id="ko-tournament-select">';
            tList.forEach(t => { html += '<option value="' + t.id + '">' + escapeHtml(t.name) + ' (' + t.status + ')</option>'; });
            html += '</select></div>';
        }
        html += '<button class="btn btn-primary btn-block" onclick="generateKnockout()" id="btn-generate-ko">' + icon('lightning-bolt', 18) + ' Genera Eliminazione Diretta</button>';
        html += '<button class="btn btn-outline btn-block" onclick="createThirdPlace()" id="btn-third-place" style="margin-top:8px">' + icon('medal', 18) + ' Crea Partita 3° Posto</button>';
        html += '</div></div>';
        }

        if (!isOrg) {
            /* Filtra per torneo - solo admin */
            html += '<div class="card" style="margin-bottom:16px"><div class="card-body">';
            html += '<div class="form-label">Filtra per Torneo</div>';
            html += '<div class="scroll-tabs">';
            html += '<div class="scroll-tab active" onclick="gFilterTournament(null, this)">Tutti</div>';
            tList.forEach(t => {
                html += '<div class="scroll-tab" onclick="gFilterTournament(' + t.id + ', this)">' + escapeHtml(t.name) + '</div>';
            });
            html += '</div></div></div>';
        }

        html += '<div id="g-groups-list"></div>';
        html += '</div></div>';
        container.innerHTML = html;

        await gLoadGroups();
        if (_gSelectedFormat === 'girone') {
            showFAB(() => editGroup(null));
        } else {
            hideFAB();
        }
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><p>Errore nel caricamento.</p></div></div>';
    }
}

function gFilterTournament(tid, tabEl) {
    _gSelectedTournament = tid;
    var tabs = tabEl.parentElement.querySelectorAll('.scroll-tab');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    tabEl.classList.add('active');
    gLoadGroups();
}

async function gLoadGroups() {
    var url = _gSelectedTournament ? 'groups/read.php?tournament_id=' + _gSelectedTournament : 'groups/read.php';
    var gRes = await apiGet(url);
    var gList = Array.isArray(gRes) ? gRes : (gRes.data || []);

    var tRes = _gSelectedTournament ? await apiGet('tournaments/read.php?id=' + _gSelectedTournament) : await apiGet('tournaments/read.php');
    var tList = Array.isArray(tRes) ? tRes : (tRes.data || []);
    var el = document.getElementById('g-groups-list');
    if (!el) return;

    var currentTournament = tList.find(t => t.id == _gSelectedTournament);
    _gSelectedFormat = currentTournament ? (currentTournament.format || 'girone') : 'girone';

    if (_gSelectedFormat === 'round_robin') {
        var html = '<div class="card" style="margin-bottom:16px"><div class="card-body" style="text-align:center;padding:24px">';
        html += '<div style="font-size:48px;margin-bottom:12px">' + icon('google-circles', 48) + '</div>';
        html += '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Formato Round Robin</div>';
        html += '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px">Le squadre si affrontano tutte in un unico girone. Non è necessario creare gironi.</div>';
        html += '<div style="font-size:12px;color:var(--color-text-tertiary)">' + icon('information', 14) + ' Vai alla sezione <strong>Partite</strong> per gestire il calendario.</div>';
        html += '</div></div>';
        el.innerHTML = html;
        return;
    }

    if (gList.length === 0) {
        el.innerHTML = showEmpty('google-circles', 'Nessun girone', 'Crea un nuovo girone.');
        return;
    }

    var html = '';
    gList.forEach(g => {
        var tournament = tList.find(t => t.id == g.tournament_id);
        var count = g.teams_count || 0;
        html += '<div class="card" style="margin-bottom:12px"><div class="card-body" style="display:flex;align-items:center;gap:12px">';
        html += '<div style="flex:1"><div style="font-weight:600;font-size:15px">' + escapeHtml(g.name) + '</div>';
        html += '<div style="font-size:13px;color:var(--color-text-secondary)">' + escapeHtml(tournament ? tournament.name : '') + ' &middot; ' + count + ' squadre</div></div>';
        html += '<div style="display:flex;gap:8px">';
        html += '<button class="btn btn-sm btn-outline" onclick="openGroupTeamsModal(' + g.id + ', \'' + escapeHtml(g.name.replace(/'/g, "\\'")) + '\', ' + g.tournament_id + ')">' + icon('account-plus', 14) + ' Squadre</button>';
        html += '<button class="btn btn-sm btn-ghost" onclick="editGroup(' + g.id + ')">' + icon('pencil', 16) + '</button>';
        html += '<button class="btn btn-sm btn-ghost" style="color:var(--color-error)" onclick="deleteGroup(' + g.id + ')">' + icon('delete-outline', 16) + '</button>';
        html += '</div></div></div>';
    });
    el.innerHTML = html;
}

async function openGroupTeamsModal(groupId, groupName, tournamentId) {
    /* Carica squadre del torneo */
    var tRes = await apiGet('teams/read.php?tournament_id=' + tournamentId);
    var allTeams = Array.isArray(tRes) ? tRes : (tRes.data || []);

    /* Carica squadre già assegnate a questo girone */
    var gtRes = await apiGet('groups/teams.php?group_id=' + groupId);
    var currentTeams = Array.isArray(gtRes) ? gtRes : (gtRes.data || []);
    var currentIds = currentTeams.map(t => t.id);

    /* Carica squadre già assegnate ad altri gironi dello stesso torneo */
    var gRes = await apiGet('groups/read.php?tournament_id=' + tournamentId);
    var gList = Array.isArray(gRes) ? gRes : (gRes.data || []);
    var otherGroupTeamIds = [];
    for (var i = 0; i < gList.length; i++) {
        if (gList[i].id == groupId) continue;
        var ogtRes = await apiGet('groups/teams.php?group_id=' + gList[i].id);
        var ogtList = Array.isArray(ogtRes) ? ogtRes : (ogtRes.data || []);
        ogtList.forEach(function(t) { otherGroupTeamIds.push(t.id); });
    }

    var body = '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:12px">' + icon('information', 14) + ' Seleziona le squadre del girone <strong>' + escapeHtml(groupName) + '</strong></div>';

    if (allTeams.length === 0) {
        body += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">' + icon('account-off', 24) + '<br>Nessuna squadra in questo torneo</div>';
    } else {
        allTeams.forEach(t => {
            var inGroup = currentIds.indexOf(t.id) !== -1;
            var inOther = otherGroupTeamIds.indexOf(t.id) !== -1;
            var disabled = inOther && !inGroup;
            var checked = inGroup ? ' checked' : '';
            var opacity = disabled ? 'opacity:0.4;' : '';
            var strike = disabled ? 'text-decoration:line-through;' : '';
            body += '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:6px;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';' + opacity + '">';
            body += '<input type="checkbox" value="' + t.id + '"' + checked + (disabled ? ' disabled' : '') + ' style="width:18px;height:18px;accent-color:var(--color-primary)">';
            body += '<div><div style="font-weight:600;font-size:14px;' + strike + '">' + escapeHtml(t.name) + '</div>';
            if (disabled) {
                var otherG = gList.find(function(gr) { return otherGroupTeamIds.indexOf(t.id) !== -1 && gr.id != groupId; });
                body += '<div style="font-size:11px;color:var(--color-error)">Già assegnata a un altro girone</div>';
            }
            body += '</div></label>';
        });
    }

    window._groupTeamsModalId = groupId;

    showModal('Squadre del Girone', body,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button>' +
        '<button class="btn btn-primary" onclick="saveGroupTeams()">' + ' Salva</button>');
}

async function saveGroupTeams() {
    var groupId = window._groupTeamsModalId;
    if (!groupId) return;

    var checkboxes = document.querySelectorAll('.modal-body input[type="checkbox"]:checked');
    var teamIds = [];
    checkboxes.forEach(function(cb) { teamIds.push(parseInt(cb.value)); });

    try {
        await apiPost('groups/assign_teams.php', { group_id: groupId, team_ids: teamIds });
        closeModal();
        showToast('Squadre aggiornate', 'success');
        gLoadGroups();
    } catch (e) { showToast('Errore nel salvataggio', 'error'); }
}

async function generateKnockout() {
    const tournamentId = document.getElementById('ko-tournament-select').value;
    if (!tournamentId) { showToast('Seleziona un torneo', 'error'); return; }

    const confirmed = await confirmDialog('Genera Eliminazione Diretta', 'Vuoi generare le partite di eliminazione diretta per questo torneo?');
    if (!confirmed) return;

    const btn = document.getElementById('btn-generate-ko');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Generazione...';

    try {
        const res = await apiPost('groups/generate_knockout.php', { tournament_id: parseInt(tournamentId) });
        showToast(res.message || 'Eliminazione diretta generata', 'success');
    } catch (e) {
        const msg = e.message || 'Errore nella generazione';
        if (msg.includes('force=1')) {
            const force = await confirmDialog('Sovrascrivere?', 'Esistono già partite di eliminazione diretta. Vuoi sovrascrivere?');
            if (force) {
                try {
                    const res = await apiPost('groups/generate_knockout.php', { tournament_id: parseInt(tournamentId), force: 1 });
                    showToast(res.message || 'Eliminazione diretta rigenerata', 'success');
                } catch (e2) { showToast('Errore: ' + e2.message, 'error'); }
            }
        } else {
            showToast('Errore: ' + msg, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = icon('lightning-bolt', 18) + ' Genera Eliminazione Diretta';
    }
}

async function createThirdPlace() {
    const tournamentId = document.getElementById('ko-tournament-select').value;
    if (!tournamentId) { showToast('Seleziona un torneo', 'error'); return; }

    const confirmed = await confirmDialog('Crea Partita 3° Posto', 'Vuoi creare la partita per il 3° posto tra i perdenti delle semifinali?');
    if (!confirmed) return;

    const btn = document.getElementById('btn-third-place');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Creazione...';

    try {
        const res = await apiPost('matches/create_third_place.php', { tournament_id: parseInt(tournamentId) });
        showToast(res.message || 'Partita 3° Posto creata', 'success');
    } catch (e) {
        showToast('Errore: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = icon('medal', 18) + ' Crea Partita 3° Posto';
    }
}

async function editGroup(id) {
    let g = {};
    if (id) {
        try {
            var gUrl = App.isOrganizer() ? 'groups/read.php?tournament_id=' + App.userTournamentId : 'groups/read.php';
            const allGroups = await apiGet(gUrl);
            const gList = Array.isArray(allGroups) ? allGroups : (allGroups.data || []);
            g = gList.find(gr => gr.id == id) || {};
        } catch(e) {}
    }
    var tUrl = App.isOrganizer() ? 'tournaments/read.php?id=' + App.userTournamentId : 'tournaments/read.php';
    const tRes = await apiGet(tUrl);
    const tList = Array.isArray(tRes) ? tRes : (tRes.data || []);

    const bodyHtml = '<div class="form-group"><label class="form-label">Nome Girone</label><input class="form-input" id="modal-g-name" value="' + (g.name || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Torneo</label><select class="form-select" id="modal-g-tournament">' +
        tList.map(t => '<option value="' + t.id + '"' + (g.tournament_id == t.id ? ' selected' : '') + '>' + escapeHtml(t.name) + '</option>').join('') +
        '</select></div>';
    showModal(id ? 'Modifica Girone' : 'Nuovo Girone', bodyHtml,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveGroup(' + id + ')">Salva</button>');
}

async function saveGroup(id) {
    const data = { name: document.getElementById('modal-g-name').value, tournament_id: document.getElementById('modal-g-tournament').value };
    if (!data.name) { showToast('Inserisci il nome', 'error'); return; }
    try {
        if (id) {
            data.id = id;
            await apiPut('groups/update.php', data);
        } else {
            await apiPost('groups/create.php', data);
        }
        closeModal(); showToast('Girone salvato', 'success'); Router.navigate('/admin/gruppi');
    } catch (e) { showToast('Errore nel salvataggio', 'error'); }
}

async function deleteGroup(id) {
    if (await confirmDialog('Elimina Girone', 'Sei sicuro di voler eliminare questo girone?')) {
        try { await apiDelete('groups/delete.php?id=' + id); showToast('Girone eliminato', 'success'); Router.navigate('/admin/gruppi'); }
        catch (e) { showToast('Errore nell\'eliminazione', 'error'); }
    }
}
