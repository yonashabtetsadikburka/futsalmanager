/* ========== ADMIN TEAMS ========== */
async function renderAdminTeams(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const isOrg = App.isOrganizer();
        const endpoints = isOrg
            ? ['tournaments/read.php', 'teams/read.php?tournament_id=' + App.userTournamentId, 'users/coaches.php?tournament_id=' + App.userTournamentId]
            : ['tournaments/read.php', 'teams/read.php', 'users/coaches.php'];
        const [tournaments, teams, coaches] = await Promise.all(endpoints.map(e => apiGet(e)));
        const tList = Array.isArray(tournaments) ? tournaments : (tournaments.data || []);
        const teamList = Array.isArray(teams) ? teams : (teams.data || []);
        const cList = Array.isArray(coaches) ? coaches : (coaches.data || []);

        let html = '<div class="screen active"><div class="screen-content">';
        html += '<h1 class="section-title" style="margin-bottom:16px">Gestione Squadre</h1>';
        html += '<div style="height:2px;background:var(--color-primary);margin-bottom:16px"></div>';

        if (teamList.length === 0) {
            html += showEmpty('account-multiple', 'Nessuna squadra', 'Crea una nuova squadra.');
        } else {
            html += '<div class="search-bar">' + icon('search', 20) + '<input type="text" placeholder="Cerca squadra..." oninput="filterAdminTeams(this.value)"></div>';
            html += '<div id="admin-teams-list">';
            teamList.forEach(t => {
                const tournament = tList.find(tor => tor.id == t.tournament_id);
                const searchText = ((t.name || '') + ' ' + (tournament ? tournament.name : 'nessun torneo')).toLowerCase();
                html += '<div class="card" style="margin-bottom:12px" data-search="' + escapeHtml(searchText) + '"><div class="card-body" style="display:flex;align-items:center;gap:12px">';
                if (t.logo_url) {
                    html += '<img src="' + escapeHtml(t.logo_url) + '" class="team-logo-sm" alt="Logo">';
                } else {
                    html += '<div class="team-logo-placeholder-sm">' + escapeHtml((t.name || '?').charAt(0).toUpperCase()) + '</div>';
                }
                html += '<div style="flex:1"><div style="font-weight:600;font-size:15px">' + escapeHtml(t.name) + '</div>';
                html += '<div style="font-size:13px;color:var(--color-text-secondary)">' + escapeHtml(tournament ? tournament.name : 'Nessun torneo') + '</div></div>';
                html += '<div style="display:flex;gap:8px">';
                html += '<button class="btn btn-sm btn-ghost" onclick="editTeam(' + t.id + ')">' + icon('pencil', 16) + '</button>';
                html += '<button class="btn btn-sm btn-ghost" style="color:var(--color-error)" onclick="deleteTeam(' + t.id + ')">' + icon('delete-outline', 16) + '</button>';
                html += '</div></div></div>';
            });
            html += '</div>';
        }
        html += '</div></div>';
        container.innerHTML = html;
        window._adminTeams = teamList;
        window._adminCoaches = cList;
        window._adminTournaments = tList;
        showFAB(() => editTeam(null));
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><p>Errore nel caricamento.</p></div></div>';
    }
}

function filterAdminTeams(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('#admin-teams-list .card').forEach(el => {
        el.style.display = el.dataset.search.includes(q) ? '' : 'none';
    });
}

async function editTeam(id) {
    let t = {};
    if (id) {
        t = window._adminTeams.find(tm => tm.id == id) || {};
    }
    const coaches = window._adminCoaches || [];
    const tournaments = window._adminTournaments || [];
    const isOrg = App.isOrganizer();
    window._teamLogo = t.logo_url || '';
    window._teamPhoto = t.photo_url || '';

    var tournamentField = '';
    if (isOrg) {
        var orgT = tournaments.find(to => to.id == App.userTournamentId);
        tournamentField = '<div class="form-group"><label class="form-label">Torneo</label><div style="padding:10px;background:var(--color-surface-alt);border-radius:var(--radius-md);font-weight:600">' + escapeHtml(orgT ? orgT.name : 'N/A') + '</div><input type="hidden" id="modal-team-tournament" value="' + App.userTournamentId + '"></div>';
    } else {
        tournamentField = '<div class="form-group"><label class="form-label">Torneo</label><select class="form-select" id="modal-team-tournament">' +
            '<option value="">Nessun torneo</option>' +
            tournaments.map(tor => '<option value="' + tor.id + '"' + (t.tournament_id == tor.id ? ' selected' : '') + '>' + escapeHtml(tor.name) + '</option>').join('') +
            '</select></div>';
    }

    const logoPreview = t.logo_url
        ? '<div style="position:relative;display:inline-block"><img src="' + escapeHtml(t.logo_url) + '" class="logo-preview" id="team-logo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removeTeamLogo()" title="Rimuovi logo">' + icon('close', 14) + '</button></div>'
        : '<div class="logo-placeholder" id="team-logo-preview">' + icon('image-plus', 40) + '<span>Carica Logo</span></div>';

    var bodyHtml = '<div class="form-group"><label class="form-label">Nome Squadra</label><input class="form-input" id="modal-team-name" value="' + escapeHtml(t.name || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Allenatore</label><select class="form-select" id="modal-team-coach">' +
        '<option value="">Nessuno</option>' +
        coaches.map(c => '<option value="' + c.id + '"' + (t.coach_id == c.id ? ' selected' : '') + '>' + escapeHtml(c.first_name || '') + ' ' + escapeHtml(c.last_name || '') + '</option>').join('') +
        '</select></div>' +
        tournamentField +
        '<div class="form-group"><label class="form-label">Logo</label>' +
        '<div class="logo-upload-area" id="team-logo-area" onclick="document.getElementById(\'modal-team-logo\').click()">' +
        logoPreview +
        '<input type="file" id="modal-team-logo" accept="image/*" style="display:none" onchange="previewTeamLogo(this)"></div></div>';

    const photoPreview = t.photo_url
        ? '<div style="position:relative;display:inline-block"><img src="' + escapeHtml(t.photo_url) + '" class="logo-preview" id="team-photo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removeTeamPhoto()" title="Rimuovi foto">' + icon('close', 14) + '</button></div>'
        : '<div class="logo-placeholder" id="team-photo-preview">' + icon('camera-plus', 40) + '<span>Foto Gruppo</span></div>';

    bodyHtml += '<div class="form-group"><label class="form-label">Foto Gruppo</label>' +
        '<div class="logo-upload-area" id="team-photo-area" onclick="document.getElementById(\'modal-team-photo\').click()">' +
        photoPreview +
        '<input type="file" id="modal-team-photo" accept="image/*" style="display:none" onchange="previewTeamPhoto(this)"></div></div>';

    if (id) {
        bodyHtml += '<div id="team-players-section" style="margin-top:16px;border-top:1px solid var(--color-border);padding-top:16px">';
        bodyHtml += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
        bodyHtml += '<label class="form-label" style="margin-bottom:0">Giocatori nella Squadra</label>';
        bodyHtml += '<span id="team-players-count" style="font-size:11px;color:var(--color-text-tertiary)"></span>';
        bodyHtml += '</div>';
        bodyHtml += '<div id="team-players-list"><div style="font-size:12px;color:var(--color-text-tertiary)">Caricamento...</div></div>';
        bodyHtml += '</div>';
    }

    showModal(id ? 'Modifica Squadra' : 'Nuova Squadra', bodyHtml,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveTeam(' + id + ')">Salva</button>');

    if (id) {
        loadTeamPlayers(id);
    }
}

async function loadTeamPlayers(teamId) {
    const listEl = document.getElementById('team-players-list');
    const countEl = document.getElementById('team-players-count');
    if (!listEl) return;

    try {
        const res = await apiGet('players/read.php?team_id=' + teamId);
        const players = Array.isArray(res) ? res : (res.data || []);

        countEl.textContent = players.length + ' giocator' + (players.length === 1 ? 'e' : 'i');

        if (players.length === 0) {
            listEl.innerHTML = '<div style="font-size:12px;color:var(--color-text-tertiary);text-align:center;padding:12px">Nessun giocatore assegnato</div>';
            return;
        }

        let html = '';
        players.forEach(p => {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:var(--radius-md);border:1px solid var(--color-border-light);margin-bottom:6px">';
            html += '<div style="width:28px;height:28px;border-radius:var(--radius-sm);background:var(--color-surface-alt);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--color-text-tertiary)">' + escapeHtml(((p.first_name || '?').charAt(0) + (p.last_name || '').charAt(0)).toUpperCase()) + '</div>';
            html += '<div style="flex:1;font-size:13px;font-weight:500">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
            html += '<button type="button" class="btn btn-sm btn-ghost" style="color:var(--color-error);font-size:11px" onclick="removePlayerFromTeam(' + p.id + ',' + teamId + ')">' + icon('delete-outline', 14) + ' Rimuovi</button>';
            html += '</div>';
        });
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = '<div style="font-size:12px;color:var(--color-error)">Errore nel caricamento</div>';
    }
}

async function removePlayerFromTeam(playerId, teamId) {
    if (!await confirmDialog('Rimuovi Giocatore', 'Rimuovere questo giocatore dalla squadra? Il giocatore non verrà eliminato.')) return;
    try {
        await apiPut('players/unassign.php', { id: playerId });
        showToast('Giocatore rimosso dalla squadra', 'success');
        loadTeamPlayers(teamId);
    } catch (e) {
        showToast(e.message || 'Errore nella rimozione', 'error');
    }
}

function removeTeamLogo() {
    window._teamLogo = '';
    const preview = document.getElementById('team-logo-preview');
    if (preview) {
        preview.outerHTML = '<div class="logo-placeholder" id="team-logo-preview">' + icon('image-plus', 40) + '<span>Carica Logo</span></div>';
    }
}

function previewTeamLogo(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('team-logo-preview').outerHTML =
                '<div style="position:relative;display:inline-block"><img src="' + e.target.result + '" class="logo-preview" id="team-logo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removeTeamLogo()" title="Rimuovi logo">' + icon('close', 14) + '</button></div>';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveTeam(id) {
    const name = document.getElementById('modal-team-name').value;
    const coachId = document.getElementById('modal-team-coach').value;
    const tournamentId = document.getElementById('modal-team-tournament').value;
    if (!name) { showToast('Inserisci il nome', 'error'); return; }
    if (!coachId) { showToast('Seleziona un allenatore prima', 'error'); return; }

    let logoUrl = window._teamLogo || '';
    const fileInput = document.getElementById('modal-team-logo');
    if (fileInput.files && fileInput.files[0]) {
        try {
            const uploadRes = await uploadFile(fileInput.files[0], 'team');
            if (uploadRes.url) logoUrl = uploadRes.url;
        } catch (e) {
            showToast('Errore upload logo', 'error');
            return;
        }
    }

    let photoUrl = window._teamPhoto || '';
    const photoInput = document.getElementById('modal-team-photo');
    if (photoInput.files && photoInput.files[0]) {
        try {
            const uploadRes = await uploadFile(photoInput.files[0], 'team-photos');
            if (uploadRes.url) photoUrl = uploadRes.url;
        } catch (e) {
            showToast('Errore upload foto gruppo', 'error');
            return;
        }
    }

    const data = {
        name,
        coach_id: coachId || null,
        tournament_id: tournamentId || null,
        logo_url: logoUrl || null,
        photo_url: photoUrl || null
    };

    try {
        if (id) {
            data.id = id;
            await apiPut('teams/update.php', data);
        } else {
            await apiPost('teams/create.php', data);
        }
        closeModal(); showToast('Squadra salvata', 'success'); Router.navigate('/admin/squadre');
    } catch (e) { showToast('Errore nel salvataggio', 'error'); }
}

async function deleteTeam(id) {
    if (await confirmDialog('Elimina Squadra', 'Sei sicuro di voler eliminare questa squadra?')) {
        try { await apiDelete('teams/delete.php?id=' + id); showToast('Squadra eliminata', 'success'); Router.navigate('/admin/squadre'); }
        catch (e) { showToast('Errore nell\'eliminazione', 'error'); }
    }
}

function previewTeamPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('team-photo-preview').outerHTML =
                '<div style="position:relative;display:inline-block"><img src="' + e.target.result + '" class="logo-preview" id="team-photo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removeTeamPhoto()" title="Rimuovi foto">' + icon('close', 14) + '</button></div>';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function removeTeamPhoto() {
    window._teamPhoto = '';
    const preview = document.getElementById('team-photo-preview');
    if (preview) {
        preview.outerHTML = '<div class="logo-placeholder" id="team-photo-preview">' + icon('camera-plus', 40) + '<span>Foto Gruppo</span></div>';
    }
}
