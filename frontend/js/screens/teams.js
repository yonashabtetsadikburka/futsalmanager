/* ========== TEAMS SCREEN ========== */
async function renderTeams(container) {
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const res = await apiGet('teams/read.php');
        const list = Array.isArray(res) ? res : (res.data || []);
        let html = '<div class="screen active">';
        html += '<div class="screen-header screen-header-teams">';
        html += ' Squadre';
        html += '<span class="header-count">' + list.length + '</span>';
        html += '</div>';
        html += '<div class="screen-content">';

        if (list.length === 0) {
            html += showEmpty('account-multiple', 'Nessuna squadra', 'Nessuna squadra trovata.');
        } else {
            html += '<div class="search-bar">' + icon('search', 20) + '<input type="text" placeholder="Cerca squadra..." oninput="filterTeams(this.value)"></div>';
            html += '<div id="team-list">';
            list.forEach(t => {
                html += '<div class="list-item" onclick="Router.navigate(\'/squadra/' + t.id + '\')">';
                if (t.logo_url) {
                    html += '<img src="' + escapeHtml(t.logo_url) + '" class="list-item-logo" alt="Logo">';
                } else {
                    html += '<div class="list-item-logo-placeholder">' + (t.name || '?').charAt(0).toUpperCase() + '</div>';
                }
                html += '<div class="list-item-content"><div class="list-item-title">' + escapeHtml(t.name) + '</div>';
                if (t.coach_name) html += '<div class="list-item-subtitle">Allenatore: ' + escapeHtml(formatCoachName(t.coach_name)) + '</div>';
                html += '</div><div class="list-item-right">' + icon('chevron-right', 18) + '</div></div>';
            });
            html += '</div>';
        }
        html += '</div></div>';
        container.innerHTML = html;
        window._teamList = list;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-header screen-header-teams">' + icon('account-multiple', 20) + ' Squadre<span class="header-count">0</span></div><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}

function filterTeams(query) {
    const list = window._teamList || [];
    const filtered = query ? list.filter(t => t.name.toLowerCase().includes(query.toLowerCase())) : list;
    const el = document.getElementById('team-list');
    el.innerHTML = filtered.map(t => {
        let html = '<div class="list-item" onclick="Router.navigate(\'/squadra/' + t.id + '\')">';
        if (t.logo_url) {
            html += '<img src="' + escapeHtml(t.logo_url) + '" class="list-item-logo" alt="Logo">';
        } else {
            html += '<div class="list-item-logo-placeholder">' + (t.name || '?').charAt(0).toUpperCase() + '</div>';
        }
        html += '<div class="list-item-content"><div class="list-item-title">' + escapeHtml(t.name) + '</div>';
        if (t.coach_name) html += '<div class="list-item-subtitle">Allenatore: ' + escapeHtml(formatCoachName(t.coach_name)) + '</div>';
        html += '</div><div class="list-item-right">' + icon('chevron-right', 18) + '</div></div>';
        return html;
    }).join('');
}
