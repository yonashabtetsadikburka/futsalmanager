/* ========== ADMIN TOURNAMENTS ========== */
async function renderAdminTournaments(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const res = await apiGet('tournaments/read.php');
        const list = Array.isArray(res) ? res : (res.data || []);

        let html = '<div class="screen active"><div class="screen-content">';
        html += '<h1 class="section-title" style="margin-bottom:16px">Gestione Tornei</h1>';
        html += '<div style="height:2px;background:var(--color-primary);margin-bottom:16px"></div>';

        if (list.length === 0) {
            html += showEmpty('trophy', 'Nessun torneo', 'Crea il primo torneo.');
        } else {
            list.forEach(t => {
                html += '<div class="card" style="margin-bottom:12px"><div class="card-body" style="display:flex;align-items:center;gap:12px">';
                if (t.logo_url) {
                    html += '<img src="' + escapeHtml(t.logo_url) + '" class="team-logo-sm" alt="Logo">';
                } else {
                    html += '<div class="team-logo-placeholder-sm">' + icon('trophy', 24) + '</div>';
                }
                html += '<div style="flex:1"><div style="font-weight:600;font-size:15px">' + escapeHtml(t.name) + '</div>';
                html += '<div style="font-size:13px;color:var(--color-text-secondary)">' + statusBadge(t.status) + ' ' + escapeHtml(t.type || '5v5') + '</div>';
                if (t.organizer_code) {
                    html += '<div style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;background:var(--color-surface-alt);padding:4px 8px;border-radius:var(--radius-sm)">';
                    html += '<span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--color-primary);letter-spacing:0.5px">' + escapeHtml(t.organizer_code) + '</span>';
                    html += '<span style="cursor:pointer;font-size:11px;color:var(--color-text-tertiary)" onclick="event.stopPropagation();copyTournamentCode(\'' + escapeHtml(t.organizer_code) + '\')" title="Copia codice">' + icon('content-copy', 12) + '</span>';
                    html += '</div>';
                }
                html += '</div>';
                html += '<div style="display:flex;gap:8px">';
                html += '<button class="btn btn-sm btn-ghost" onclick="editTournament(' + t.id + ')">' + icon('pencil', 16) + '</button>';
                html += '<button class="btn btn-sm btn-ghost" style="color:var(--color-error)" onclick="deleteTournament(' + t.id + ')">' + icon('delete-outline', 16) + '</button>';
                html += '</div></div></div>';
            });
        }
        html += '</div></div>';
        container.innerHTML = html;
        showFAB(() => editTournament(null));
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><p>Errore nel caricamento.</p></div></div>';
    }
}

async function editTournament(id) {
    let t = {};
    if (id) {
        try { const res = await apiGet('tournaments/read_one.php?id=' + id); t = res.data || res; } catch(e) {}
    }
    window._tournamentLogo = t.logo_url || '';

    const logoPreview = t.logo_url
        ? '<div style="position:relative;display:inline-block"><img src="' + escapeHtml(t.logo_url) + '" class="logo-preview" id="tournament-logo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removeTournamentLogo()" title="Rimuovi logo">' + icon('close', 14) + '</button></div>'
        : '<div class="logo-placeholder" id="tournament-logo-preview">' + icon('image-plus', 40) + '<span>Carica Logo</span></div>';

    var bodyHtml = '<div class="form-group"><label class="form-label">Nome Torneo</label><input class="form-input" id="modal-t-name" value="' + escapeHtml(t.name || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="modal-t-type">' +
        '<option value="5v5"' + (t.type === '5v5' ? ' selected' : '') + '>5v5</option>' +
        '<option value="7v7"' + (t.type === '7v7' ? ' selected' : '') + '>7v7</option>' +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">Formato</label><select class="form-select" id="modal-t-format" onchange="toggleKnockoutOption()">' +
        '<option value="girone"' + ((t.format || 'girone') === 'girone' ? ' selected' : '') + '>Gironi + Eliminazione Diretta</option>' +
        '<option value="round_robin"' + (t.format === 'round_robin' ? ' selected' : '') + '>Round Robin (tutti vs tutti)</option>' +
        '</select></div>' +
        '<div class="form-group" id="format-ko-wrapper"' + ((t.format || 'girone') === 'round_robin' ? ' style="display:none"' : '') + '>' +
        '<label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
        '<input type="checkbox" id="modal-t-knockout"' + (t.has_knockout ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--color-primary)">' +
        ' Fase a eliminazione diretta</label></div>' +
        '<div class="form-group"><label class="form-label">Stato</label><select class="form-select" id="modal-t-status">' +
        '<option value="active"' + (t.status === 'active' ? ' selected' : '') + '>In corso</option>' +
        '<option value="finished"' + (t.status === 'finished' ? ' selected' : '') + '>Completato</option>' +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">Luogo</label><input class="form-input" id="modal-t-location" value="' + escapeHtml(t.location || '') + '" placeholder="Es. Palazzetto Sport City"></div>' +
        '<div style="display:flex;gap:12px">' +
        '<div class="form-group" style="flex:1"><label class="form-label">Data Inizio</label><input class="form-input" type="date" id="modal-t-start-date" value="' + (t.start_date || '') + '"></div>' +
        '<div class="form-group" style="flex:1"><label class="form-label">Data Fine</label><input class="form-input" type="date" id="modal-t-end-date" value="' + (t.end_date || '') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Descrizione</label><textarea class="form-textarea" id="modal-t-description" rows="3" placeholder="Informazioni aggiuntive sul torneo...">' + escapeHtml(t.description || '') + '</textarea></div>' +
        (id && t.organizer_code ? '<div class="form-group"><label class="form-label">Codice Organizzatore</label><div style="display:flex;align-items:center;gap:8px;background:var(--color-surface-alt);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--color-border)"><span style="font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--color-primary);letter-spacing:0.5px;flex:1">' + escapeHtml(t.organizer_code) + '</span><button type="button" class="btn btn-sm btn-ghost" onclick="copyTournamentCode(\'' + escapeHtml(t.organizer_code) + '\')" title="Copia codice">' + icon('content-copy', 16) + '</button></div></div>' : '') +
        '<div class="form-group"><label class="form-label">Logo</label>' +
        '<div class="logo-upload-area" id="tournament-logo-area" onclick="document.getElementById(\'modal-t-logo\').click()">' +
        logoPreview +
        '<input type="file" id="modal-t-logo" accept="image/*" style="display:none" onchange="previewTournamentLogo(this)"></div></div>';

    if (id) {
        bodyHtml += '<div id="tournament-teams-section" style="margin-top:16px;border-top:1px solid var(--color-border);padding-top:16px">';
        bodyHtml += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
        bodyHtml += '<label class="form-label" style="margin-bottom:0">Squadre nel Torneo</label>';
        bodyHtml += '<span id="tournament-teams-count" style="font-size:11px;color:var(--color-text-tertiary)"></span>';
        bodyHtml += '</div>';
        bodyHtml += '<div id="tournament-teams-list"><div style="font-size:12px;color:var(--color-text-tertiary)">Caricamento...</div></div>';
        bodyHtml += '</div>';
    }

    showModal(id ? 'Modifica Torneo' : 'Nuovo Torneo', bodyHtml,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveTournament(' + id + ')">Salva</button>');

    if (id) {
        loadTournamentTeams(id);
    }
}

async function loadTournamentTeams(tournamentId) {
    const listEl = document.getElementById('tournament-teams-list');
    const countEl = document.getElementById('tournament-teams-count');
    if (!listEl) return;

    try {
        const res = await apiGet('teams/read.php?tournament_id=' + tournamentId);
        const teams = Array.isArray(res) ? res : (res.data || []);

        countEl.textContent = teams.length + ' squadr' + (teams.length === 1 ? 'a' : 'e');

        if (teams.length === 0) {
            listEl.innerHTML = '<div style="font-size:12px;color:var(--color-text-tertiary);text-align:center;padding:12px">Nessuna squadra assegnata</div>';
            return;
        }

        let html = '';
        teams.forEach(team => {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:var(--radius-md);border:1px solid var(--color-border-light);margin-bottom:6px">';
            if (team.logo_url) {
                html += '<img src="' + escapeHtml(team.logo_url) + '" style="width:28px;height:28px;border-radius:var(--radius-sm);object-fit:cover">';
            } else {
                html += '<div style="width:28px;height:28px;border-radius:var(--radius-sm);background:var(--color-surface-alt);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--color-text-tertiary)">' + escapeHtml((team.name || '?').charAt(0).toUpperCase()) + '</div>';
            }
            html += '<div style="flex:1;font-size:13px;font-weight:500">' + escapeHtml(team.name) + '</div>';
            html += '<button type="button" class="btn btn-sm btn-ghost" style="color:var(--color-error);font-size:11px" onclick="removeTeamFromTournament(' + team.id + ',' + tournamentId + ')">' + icon('delete-outline', 14) + ' Rimuovi</button>';
            html += '</div>';
        });
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = '<div style="font-size:12px;color:var(--color-error)">Errore nel caricamento</div>';
    }
}

async function removeTeamFromTournament(teamId, tournamentId) {
    if (!await confirmDialog('Rimuovi Squadra', 'Rimuovere questa squadra dal torneo? La squadra non verrà eliminata.')) return;
    try {
        await apiPut('teams/update.php', { id: teamId, tournament_id: null });
        showToast('Squadra rimossa dal torneo', 'success');
        loadTournamentTeams(tournamentId);
    } catch (e) {
        showToast(e.message || 'Errore nella rimozione', 'error');
    }
}

function removeTournamentLogo() {
    window._tournamentLogo = '';
    const preview = document.getElementById('tournament-logo-preview');
    if (preview) {
        preview.outerHTML = '<div class="logo-placeholder" id="tournament-logo-preview">' + icon('image-plus', 40) + '<span>Carica Logo</span></div>';
    }
}

function previewTournamentLogo(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('tournament-logo-preview').outerHTML =
                '<div style="position:relative;display:inline-block"><img src="' + e.target.result + '" class="logo-preview" id="tournament-logo-preview"><button type="button" class="logo-remove-btn" onclick="event.stopPropagation();removeTournamentLogo()" title="Rimuovi logo">' + icon('close', 14) + '</button></div>';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveTournament(id) {
    const name = document.getElementById('modal-t-name').value;
    const type = document.getElementById('modal-t-type').value;
    const status = document.getElementById('modal-t-status').value;
    if (!name) { showToast('Inserisci il nome', 'error'); return; }

    let logoUrl = window._tournamentLogo || '';
    const fileInput = document.getElementById('modal-t-logo');
    if (fileInput.files && fileInput.files[0]) {
        try {
            const uploadRes = await uploadFile(fileInput.files[0], 'tournament');
            if (uploadRes.url) logoUrl = uploadRes.url;
        } catch (e) {
            showToast('Errore upload logo', 'error');
            return;
        }
    }

    const data = { name, type, status, format: document.getElementById('modal-t-format').value, has_knockout: document.getElementById('modal-t-knockout').checked ? 1 : 0, logo_url: logoUrl || null, location: document.getElementById('modal-t-location').value || null, start_date: document.getElementById('modal-t-start-date').value || null, end_date: document.getElementById('modal-t-end-date').value || null, description: document.getElementById('modal-t-description').value || null };
    try {
        if (id) {
            data.id = id;
            await apiPut('tournaments/update.php', data);
            closeModal(); showToast('Torneo salvato', 'success'); Router.navigate('/admin/tornei');
        } else {
            const res = await apiPost('tournaments/create.php', data);
            closeModal();
            if (res.organizer_code) {
                showTournamentCreatedModal(res.organizer_code, name);
            } else {
                showToast('Torneo creato', 'success');
                Router.navigate('/admin/tornei');
            }
        }
    } catch (e) { showToast('Errore nel salvataggio', 'error'); }
}

async function deleteTournament(id) {
    if (await confirmDialog('Elimina Torneo', 'Sei sicuro di voler eliminare questo torneo e tutti i dati associati (squadre, gironi, partite, giocatori, organizer)?')) {
        try { await apiDelete('tournaments/delete.php?id=' + id + '&force=1'); showToast('Torneo eliminato', 'success'); Router.navigate('/admin/tornei'); }
        catch (e) { showToast('Errore nell\'eliminazione', 'error'); }
    }
}

function showTournamentCreatedModal(code, name) {
    const bodyHtml = '<div style="text-align:center;padding:8px 0">' +
        '<div style="font-size:14px;color:var(--color-text-secondary);margin-bottom:8px">Torneo <strong>' + escapeHtml(name) + '</strong> creato!</div>' +
        '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px">Condividi questo codice con l\'organizzatore:</div>' +
        '<div style="background:var(--color-surface-alt);border:2px solid var(--color-primary);border-radius:var(--radius-md);padding:16px;margin-bottom:16px">' +
        '<div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--color-primary);letter-spacing:1px">' + escapeHtml(code) + '</div>' +
        '</div>' +
        '<button class="btn btn-primary" style="width:100%" onclick="copyTournamentCode(\'' + escapeHtml(code) + '\')">' + icon('content-copy', 16) + ' Copia Codice</button>' +
        '</div>';
    showModal('Codice Organizzatore', bodyHtml,
        '<button class="btn btn-outline" onclick="closeModal();Router.navigate(\'/admin/tornei\')">Chiudi</button>');
}

function copyTournamentCode(code) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Codice copiato: ' + code, 'success');
        }).catch(() => {
            fallbackCopy(code);
        });
    } else {
        fallbackCopy(code);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('Codice copiato: ' + text, 'success');
    } catch (e) {
        showToast('Errore nella copia', 'error');
    }
    document.body.removeChild(ta);
}

function toggleKnockoutOption() {
    var format = document.getElementById('modal-t-format').value;
    var wrapper = document.getElementById('format-ko-wrapper');
    if (wrapper) {
        wrapper.style.display = format === 'round_robin' ? 'none' : '';
    }
    if (format === 'round_robin') {
        var koCheckbox = document.getElementById('modal-t-knockout');
        if (koCheckbox) koCheckbox.checked = false;
    }
}
