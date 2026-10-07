/* ========== ADMIN PLAYERS ========== */
async function renderAdminPlayers(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const isOrg = App.isOrganizer();
        const endpoint = isOrg ? 'players/read.php?tournament_id=' + App.userTournamentId : 'players/read.php';
        const res = await apiGet(endpoint);
        const list = Array.isArray(res) ? res : (res.data || []);

        let html = '<div class="screen active"><div class="screen-content">';
        html += '<h1 class="section-title" style="margin-bottom:16px">Gestione Giocatori</h1>';
        html += '<div style="height:2px;background:var(--color-primary);margin-bottom:16px"></div>';

        if (list.length === 0) {
            html += showEmpty('soccer', 'Nessun giocatore', 'Aggiungi il primo giocatore.');
        } else {
            html += '<div class="search-bar">' + icon('search', 20) + '<input type="text" placeholder="Cerca giocatore..." oninput="filterAdminPlayers(this.value)"></div>';
            html += '<div id="admin-player-list">';
            list.forEach(p => {
                html += '<div class="card" style="margin-bottom:8px" data-search="' + escapeHtml(((p.first_name || '') + ' ' + (p.last_name || '')).toLowerCase()) + '">';
                html += '<div class="card-body" style="display:flex;align-items:center;gap:12px">';
                html += '<div style="flex:1"><div style="font-weight:600;font-size:14px">' + escapeHtml(p.first_name || '') + ' ' + escapeHtml(p.last_name || '') + '</div>';
                let meta = [];
                if (p.role) meta.push(escapeHtml(p.role));
                if (p.age) meta.push(p.age + ' anni');
                if (p.team_name) meta.push(escapeHtml(p.team_name));
                if (meta.length) html += '<div style="font-size:12px;color:var(--color-text-secondary)">' + meta.join(' · ') + '</div>';
                html += '</div>';
                html += '<div style="display:flex;gap:8px">';
                html += '<button class="btn btn-sm btn-ghost" onclick="editPlayer(' + p.id + ')">' + icon('pencil', 16) + '</button>';
                html += '<button class="btn btn-sm btn-ghost" style="color:var(--color-error)" onclick="deletePlayer(' + p.id + ')">' + icon('delete-outline', 16) + '</button>';
                html += '</div></div></div>';
            });
            html += '</div>';
        }
        html += '</div></div>';
        container.innerHTML = html;
        showFAB(() => editPlayer(null));
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><p>Errore nel caricamento.</p></div></div>';
    }
}

function filterAdminPlayers(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('#admin-player-list .card').forEach(el => {
        el.style.display = el.dataset.search.includes(q) ? '' : 'none';
    });
}

async function editPlayer(id) {
    let p = {};
    if (id) {
        try {
            const isOrg = App.isOrganizer();
            const endpoint = isOrg ? 'players/read.php?tournament_id=' + App.userTournamentId : 'players/read.php';
            const allPlayers = await apiGet(endpoint);
            const pList = Array.isArray(allPlayers) ? allPlayers : (allPlayers.data || []);
            p = pList.find(pl => pl.id == id) || {};
        } catch(e) {}
    }
    const isOrg = App.isOrganizer();
    const teamsEndpoint = isOrg ? 'teams/read.php?tournament_id=' + App.userTournamentId : 'teams/read.php';
    const teamsRes = await apiGet(teamsEndpoint);
    const teamList = Array.isArray(teamsRes) ? teamsRes : (teamsRes.data || []);

    let bodyHtml = '<div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="modal-p-first" value="' + escapeHtml(p.first_name || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Cognome</label><input class="form-input" id="modal-p-last" value="' + escapeHtml(p.last_name || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Eta</label><input class="form-input" type="number" id="modal-p-age" value="' + (p.age || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Posizione</label><select class="form-select" id="modal-p-role">' +
        '<option value="">Seleziona...</option>' +
        '<option value="Portiere"' + (p.role === 'Portiere' ? ' selected' : '') + '>Portiere</option>' +
        '<option value="Difensore"' + (p.role === 'Difensore' ? ' selected' : '') + '>Difensore</option>' +
        '<option value="Centrocampista"' + (p.role === 'Centrocampista' ? ' selected' : '') + '>Centrocampista</option>' +
        '<option value="Attaccante"' + (p.role === 'Attaccante' ? ' selected' : '') + '>Attaccante</option>' +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">Squadra</label><select class="form-select" id="modal-p-team">' +
        '<option value="">Nessuna</option>' + teamList.map(t => '<option value="' + t.id + '"' + (p.team_id == t.id ? ' selected' : '') + '>' + escapeHtml(t.name) + '</option>').join('') +
        '</select></div>';

    const photoPreview = p.photo_url
        ? '<div style="position:relative;display:inline-block"><img src="' + escapeHtml(p.photo_url) + '" class="player-photo-preview" id="player-photo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removePlayerPhoto()" title="Rimuovi foto">' + icon('close', 14) + '</button></div>'
        : '<div class="logo-placeholder" id="player-photo-preview">' + icon('camera-plus', 40) + '<span>Carica Foto</span></div>';

    bodyHtml += '<div class="form-group"><label class="form-label">Foto Giocatore</label>' +
        '<div class="logo-upload-area" id="player-photo-area" onclick="document.getElementById(\'modal-player-photo\').click()">' +
        photoPreview +
        '<input type="file" id="modal-player-photo" accept="image/*" style="display:none" onchange="previewPlayerPhoto(this)"></div></div>';

    window._playerPhoto = p.photo_url || '';

    showModal(id ? 'Modifica Giocatore' : 'Nuovo Giocatore', bodyHtml,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="savePlayer(' + id + ')">Salva</button>');
}

async function savePlayer(id) {
    const data = {
        first_name: document.getElementById('modal-p-first').value,
        last_name: document.getElementById('modal-p-last').value,
        age: parseInt(document.getElementById('modal-p-age').value) || 0,
        role: document.getElementById('modal-p-role').value || null,
        team_id: document.getElementById('modal-p-team').value || null
    };
    if (App.isOrganizer()) {
        data.tournament_id = App.userTournamentId;
    }
    if (!data.first_name) { showToast('Inserisci il nome', 'error'); return; }
    if (!data.last_name) { showToast('Inserisci il cognome', 'error'); return; }

    const fileInput = document.getElementById('modal-player-photo');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            const uploadRes = await uploadFile(fileInput.files[0], 'players');
            if (uploadRes.url) data.photo_url = uploadRes.url;
        } catch (e) {
            showToast('Errore upload foto', 'error');
            return;
        }
    } else {
        data.photo_url = window._playerPhoto || null;
    }

    try {
        if (id) {
            data.id = id;
            await apiPut('players/update.php', data);
        } else {
            await apiPost('players/create.php', data);
        }
        closeModal(); showToast('Giocatore salvato', 'success'); Router.navigate('/admin/giocatori');
    } catch (e) {
        console.error('Save player error:', e);
        const msg = (e.body && (e.body.message || e.body.error)) || e.message || 'Errore nel salvataggio';
        showToast(msg, 'error');
    }
}

async function deletePlayer(id) {
    if (await confirmDialog('Elimina Giocatore', 'Sei sicuro di voler eliminare questo giocatore?')) {
        try { await apiDelete('players/delete.php', {id: id}); showToast('Giocatore eliminato', 'success'); Router.navigate('/admin/giocatori'); }
        catch (e) { showToast('Errore nell\'eliminazione', 'error'); }
    }
}

function previewPlayerPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('player-photo-preview').outerHTML =
                '<div style="position:relative;display:inline-block"><img src="' + e.target.result + '" class="player-photo-preview" id="player-photo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removePlayerPhoto()" title="Rimuovi foto">' + icon('close', 14) + '</button></div>';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function removePlayerPhoto() {
    window._playerPhoto = '';
    const preview = document.getElementById('player-photo-preview');
    if (preview) {
        preview.outerHTML = '<div class="logo-placeholder" id="player-photo-preview">' + icon('camera-plus', 40) + '<span>Carica Foto</span></div>';
    }
}
