/* ========== TOURNAMENTS SCREEN ========== */
async function renderTournaments(container) {
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const res = await apiGet('tournaments/read.php');
        const list = Array.isArray(res) ? res : (res.data || []);
        let html = '<div class="screen active">';
        html += '<div class="screen-header screen-header-tournaments">';
        html += ' Tornei';
        html += '<span class="header-count">' + list.length + '</span>';
        html += '</div>';
        html += '<div class="screen-content">';

        if (list.length === 0) {
            html += showEmpty('trophy', 'Nessun torneo', 'Non ci sono tornei disponibili.');
        } else {
            html += '<div class="search-bar">' + icon('search', 20) + '<input type="text" placeholder="Cerca torneo..." oninput="filterTournaments(this.value)"></div>';
            html += '<div id="tournament-list">';
            list.forEach(t => {
                html += renderTournamentCard(t);
            });
            html += '</div>';
        }
        html += '</div></div>';
        container.innerHTML = html;
        window._tournamentList = list;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-header screen-header-tournaments">' + icon('trophy', 20) + ' Tornei<span class="header-count">0</span></div><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}

function renderTournamentCard(t) {
    const createdDate = t.created_at ? formatDateShort(t.created_at) : '';
    let logoHtml = '';
    if (t.logo_url) {
        logoHtml = '<img src="' + escapeHtml(t.logo_url) + '" class="list-item-logo" alt="Logo">';
    } else {
        logoHtml = '<div class="list-item-logo-placeholder">' + icon('trophy', 20) + '</div>';
    }
    return '<div class="list-item" onclick="Router.navigate(\'/torneo/' + t.id + '\')" style="margin-bottom:8px">' +
        logoHtml +
        '<div class="list-item-content">' +
        '<div class="list-item-title">' + escapeHtml(t.name) + '</div>' +
        '<div class="list-item-subtitle">' +
        statusBadge(t.status) +
        ' <span class="tournament-type-badge">' + escapeHtml(t.type || '5v5') + '</span>' +
        (createdDate ? ' <span class="tournament-date">' + icon('calendar', 10) + ' ' + createdDate + '</span>' : '') +
        '</div></div>' +
        '<div class="list-item-right">' + icon('chevron-right', 18) + '</div></div>';
}

function filterTournaments(query) {
    const list = window._tournamentList || [];
    const filtered = query ? list.filter(t => t.name.toLowerCase().includes(query.toLowerCase())) : list;
    document.getElementById('tournament-list').innerHTML = filtered.map(renderTournamentCard).join('');
}
