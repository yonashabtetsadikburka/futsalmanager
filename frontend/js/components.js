/* ========== TOAST ========== */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + message + '</span><span class="toast-close" onclick="this.parentElement.remove()">' + icon('close', 16) + '</span>';
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
}

/* ========== MODAL ========== */
function showModal(title, bodyHtml, footerHtml) {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = '<div class="modal"><div class="modal-header"><h2>' + title + '</h2><button class="modal-close" onclick="closeModal()">' + icon('close', 20) + '</button></div><div class="modal-body">' + bodyHtml + '</div>' + (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') + '</div>';
    overlay.classList.add('active');
}
function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
}

/* ========== LOADING ========== */
function showLoading() {
    return '<div class="spinner"></div>';
}

/* ========== EMPTY STATE ========== */
function showEmpty(iconName, title, message) {
    return '<div class="empty-state">' + icon(iconName, 56) + '<h3>' + title + '</h3><p>' + message + '</p></div>';
}

/* ========== FAB ========== */
function showFAB(onClick) {
    let fab = document.getElementById('fab');
    if (!fab) {
        fab = document.createElement('button');
        fab.id = 'fab';
        fab.className = 'fab no-print';
        document.body.appendChild(fab);
    }
    fab.innerHTML = icon('plus', 24);
    fab.onclick = onClick;
    fab.style.display = 'flex';
}
function hideFAB() {
    const fab = document.getElementById('fab');
    if (fab) fab.style.display = 'none';
}

/* ========== CONFIRM DIALOG ========== */
function confirmDialog(title, message) {
    return new Promise(resolve => {
        const overlay = document.getElementById('modal-overlay');
        overlay.innerHTML = '<div class="modal" style="max-width:380px"><div class="modal-header"><h2>' + title + '</h2></div><div class="modal-body"><p>' + message + '</p></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Annulla</button><button class="btn btn-danger" id="confirm-ok-btn">Conferma</button></div></div>';
        overlay.classList.add('active');
        document.getElementById('confirm-ok-btn').onclick = () => { closeModal(); resolve(true); };
        overlay.onclick = (e) => { if (e.target === overlay) { closeModal(); resolve(false); } };
    });
}

/* ========== TOURNAMENT BADGE HTML ========== */
function statusBadge(status) {
    const map = {
        'active': 'In corso',
        'finished': 'Completato',
        'upcoming': 'In arrivo',
        'in_corso': 'In corso',
        'completed': 'Completato',
        'annullato': 'Annullato'
    };
    return '<span class="status-badge status-' + status + '">' + (map[status] || status) + '</span>';
}

/* ========== PLAYER SELECT MODAL ========== */
function showPlayerSelectModal(players, selectedIds, onSave) {
    let tempSelected = new Set(selectedIds || []);
    const bodyHtml = '<div class="player-select-list" id="player-select-list">' +
        players.map(p => '<label class="player-select-item' + (tempSelected.has(p.id) ? ' selected' : '') + '" data-id="' + p.id + '"><input type="checkbox" ' + (tempSelected.has(p.id) ? 'checked' : '') + ' onchange="togglePlayerSelect(' + p.id + ')"><span>' + (p.first_name || '') + ' ' + (p.last_name || p.name || '') + '</span></label>').join('') +
        '</div>';
    showModal('Seleziona Giocatori', bodyHtml,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button><button class="btn btn-primary" id="player-select-save">Salva</button>');
    window._togglePlayerSelect = (id) => {
        if (tempSelected.has(id)) tempSelected.delete(id); else tempSelected.add(id);
        const item = document.querySelector('.player-select-item[data-id="' + id + '"]');
        if (item) { item.classList.toggle('selected'); item.querySelector('input').checked = tempSelected.has(id); }
    };
    document.getElementById('player-select-save').onclick = () => { closeModal(); onSave(Array.from(tempSelected)); };
}
function togglePlayerSelect(id) { if (window._togglePlayerSelect) window._togglePlayerSelect(id); }
