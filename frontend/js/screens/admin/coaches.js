/* ========== ADMIN COACHES ========== */
async function renderAdminCoaches(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const isOrg = App.isOrganizer();
        const endpoint = isOrg ? 'users/coaches.php?tournament_id=' + App.userTournamentId : 'users/coaches.php';
        const res = await apiGet(endpoint);
        const list = Array.isArray(res) ? res : (res.data || []);

        let html = '<div class="screen active"><div class="screen-content">';
        html += '<h1 class="section-title" style="margin-bottom:16px">Gestione Allenatori</h1>';
        html += '<div style="height:2px;background:var(--color-primary);margin-bottom:16px"></div>';

        if (list.length === 0) {
            html += showEmpty('account-multiple-plus', 'Nessun allenatore', 'Aggiungi il primo allenatore.');
        } else {
            list.forEach(c => {
                html += '<div class="card" style="margin-bottom:8px"><div class="card-body" style="display:flex;align-items:center;gap:12px">';
                html += '<div style="flex:1"><div style="font-weight:600;font-size:14px">' + escapeHtml(c.first_name || '') + ' ' + escapeHtml(c.last_name || c.username || '') + '</div>';
                if (c.email) html += '<div style="font-size:12px;color:var(--color-text-secondary)">' + c.email + '</div>';
                html += '</div>';
                html += '<div style="display:flex;gap:8px">';
                html += '<button class="btn btn-sm btn-ghost" onclick="editCoach(' + c.id + ')">' + icon('pencil', 16) + '</button>';
                html += '<button class="btn btn-sm btn-ghost" style="color:var(--color-error)" onclick="deleteCoach(' + c.id + ')">' + icon('delete-outline', 16) + '</button>';
                html += '</div></div></div>';
            });
        }
        html += '</div></div>';
        container.innerHTML = html;
        showFAB(() => editCoach(null));
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><p>Errore nel caricamento.</p></div></div>';
    }
}

async function editCoach(id) {
    let c = {};
    if (id) {
        try {
            const endpoint = App.isOrganizer() ? 'users/coaches.php?tournament_id=' + App.userTournamentId : 'users/coaches.php';
            const allCoaches = await apiGet(endpoint);
            const cList = Array.isArray(allCoaches) ? allCoaches : (allCoaches.data || []);
            c = cList.find(co => co.id == id) || {};
        } catch(e) {}
    }

    const bodyHtml = '<div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="modal-c-first" value="' + escapeHtml(c.first_name || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Cognome</label><input class="form-input" id="modal-c-last" value="' + escapeHtml(c.last_name || '') + '"></div>';
    showModal(id ? 'Modifica Allenatore' : 'Nuovo Allenatore', bodyHtml,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveCoach(' + id + ')">Salva</button>');
}

async function saveCoach(id) {
    const data = {
        first_name: document.getElementById('modal-c-first').value,
        last_name: document.getElementById('modal-c-last').value
    };
    if (App.isOrganizer()) {
        data.tournament_id = App.userTournamentId;
    }
    if (!data.first_name || !data.last_name) { showToast('Inserisci nome e cognome', 'error'); return; }
    try {
        let res;
        if (id) {
            data.id = id;
            await apiPut('users/update_coach.php', data);
            closeModal(); showToast('Allenatore salvato', 'success'); Router.navigate('/admin/allenatori');
        } else {
            res = await apiPost('users/create_coach.php', data);
            closeModal();
            if (res.temp_password) {
                showModal('Allenatore creato', 
                    '<div style="text-align:center">' +
                    '<p style="margin-bottom:12px">Credenziali per l\'accesso:</p>' +
                    '<div style="background:var(--color-bg-secondary);padding:12px;border-radius:8px;margin-bottom:8px">' +
                    '<div style="font-size:12px;color:var(--color-text-secondary)">Username</div>' +
                    '<div style="font-family:var(--font-mono);font-weight:600">' + escapeHtml(res.username || '') + '</div>' +
                    '</div>' +
                    '<div style="background:var(--color-bg-secondary);padding:12px;border-radius:8px">' +
                    '<div style="font-size:12px;color:var(--color-text-secondary)">Password temporanea</div>' +
                    '<div style="font-family:var(--font-mono);font-weight:600;color:var(--color-primary)">' + escapeHtml(res.temp_password) + '</div>' +
                    '</div>' +
                    '<p style="font-size:12px;color:var(--color-text-tertiary);margin-top:12px">Consigli all\'allenatore di cambiare la password al primo accesso.</p>' +
                    '</div>');
            } else {
                showToast('Allenatore creato', 'success');
            }
            Router.navigate('/admin/allenatori');
        }
    } catch (e) { showToast('Errore nel salvataggio', 'error'); }
}

async function deleteCoach(id) {
    if (await confirmDialog('Elimina Allenatore', 'Sei sicuro di voler eliminare questo allenatore?')) {
        try { await apiDelete('users/delete_coach.php', {id: id}); showToast('Allenatore eliminato', 'success'); Router.navigate('/admin/allenatori'); }
        catch (e) { showToast('Errore nell\'eliminazione', 'error'); }
    }
}
