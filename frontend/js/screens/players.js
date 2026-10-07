/* ========== PLAYERS SCREEN ========== */
async function renderPlayers(container) {
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const [players, tournaments] = await Promise.all([
            apiGet('players/read.php'),
            apiGet('tournaments/read.php')
        ]);
        const pList = Array.isArray(players) ? players : (players.data || []);
        const tList = Array.isArray(tournaments) ? tournaments : (tournaments.data || []);

        let html = '<div class="screen active">';
        html += '<div class="screen-header screen-header-players">';
        html += ' Giocatori';
        html += '<span class="header-count">' + pList.length + '</span>';
        html += '</div>';
        html += '<div class="screen-content">';

        if (pList.length === 0) {
            html += showEmpty('soccer', 'Nessun giocatore', 'Nessun giocatore registrato.');
        } else {
            html += '<div class="search-bar">' + icon('search', 20) + '<input type="text" placeholder="Cerca giocatore..." oninput="filterPlayers(this.value)"></div>';
            html += '<div id="player-list">';

            window._playersShowAll = window._playersShowAll || {};

            if (tList.length > 0) {
                tList.forEach(t => {
                    const tPlayers = pList.filter(p => p.tournament_id == t.id || p.tournament_name === t.name);
                    if (tPlayers.length > 0) {
                        const showAll = window._playersShowAll[t.id];
                        const visible = showAll ? tPlayers : tPlayers.slice(0, 10);
                        const hasMore = tPlayers.length > 10;

                        html += '<div class="players-tournament-group">';
                        html += '<div class="players-tournament-header">';
                        html += '<div class="players-tournament-label">' + escapeHtml(t.name) + '</div>';
                        if (hasMore) {
                            html += '<span class="players-show-all" onclick="togglePlayersGroup(' + t.id + ')">' + (showAll ? 'Mostra meno' : 'Vedi tutti') + '</span>';
                        }
                        html += '</div>';
                        visible.forEach(p => { html += renderPlayerListItem(p); });
                        html += '</div>';
                    }
                });
                const ungrouped = pList.filter(p => !p.tournament_id && !p.tournament_name);
                if (ungrouped.length > 0) {
                    html += '<div class="players-tournament-group"><div class="players-tournament-label">Altri</div>';
                    ungrouped.forEach(p => { html += renderPlayerListItem(p); });
                    html += '</div>';
                }
            } else {
                pList.slice(0, 10).forEach(p => { html += renderPlayerListItem(p); });
            }
            html += '</div>';
        }
        html += '</div></div>';
        container.innerHTML = html;
        window._playerList = pList;
        window._tournamentListForPlayers = tList;
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-header screen-header-players">' + icon('soccer', 20) + ' Giocatori<span class="header-count">0</span></div><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}

function renderPlayerListItem(p) {
    let html = '<div class="list-item" onclick="Router.navigate(\'/giocatore/' + p.id + '\')">';
    html += '<div class="list-item-content">';
    html += '<div class="list-item-title">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
    let meta = [];
    if (p.role) meta.push(escapeHtml(p.role));
    if (p.team_name) meta.push(escapeHtml(p.team_name));
    if (p.age) meta.push(p.age + ' anni');
    html += '<div class="list-item-subtitle">' + meta.join(' \u00b7 ') + '</div>';
    html += '</div></div>';
    return html;
}

function togglePlayersGroup(tournamentId) {
    window._playersShowAll = window._playersShowAll || {};
    window._playersShowAll[tournamentId] = !window._playersShowAll[tournamentId];
    rebuildPlayerList(window._playerList || [], window._tournamentListForPlayers || []);
}

function rebuildPlayerList(pList, tList) {
    const container = document.getElementById('player-list');
    if (!container) return;
    let html = '';
    if (tList.length > 0) {
        tList.forEach(t => {
            const tPlayers = pList.filter(p => p.tournament_id == t.id || p.tournament_name === t.name);
            if (tPlayers.length > 0) {
                const showAll = window._playersShowAll[t.id];
                const visible = showAll ? tPlayers : tPlayers.slice(0, 10);
                const hasMore = tPlayers.length > 10;

                html += '<div class="players-tournament-group">';
                html += '<div class="players-tournament-header">';
                html += '<div class="players-tournament-label">' + escapeHtml(t.name) + '</div>';
                if (hasMore) {
                    html += '<span class="players-show-all" onclick="togglePlayersGroup(' + t.id + ')">' + (showAll ? 'Mostra meno' : 'Vedi tutti') + '</span>';
                }
                html += '</div>';
                visible.forEach(p => { html += renderPlayerListItem(p); });
                html += '</div>';
            }
        });
        const ungrouped = pList.filter(p => !p.tournament_id && !p.tournament_name);
        if (ungrouped.length > 0) {
            html += '<div class="players-tournament-group"><div class="players-tournament-label">Altri</div>';
            ungrouped.forEach(p => { html += renderPlayerListItem(p); });
            html += '</div>';
        }
    } else {
        pList.forEach(p => { html += renderPlayerListItem(p); });
    }
    container.innerHTML = html;
}

function filterPlayers(query) {
    const list = window._playerList || [];
    const filtered = query ? list.filter(p => ((p.first_name || '') + ' ' + (p.last_name || p.name || '')).toLowerCase().includes(query.toLowerCase())) : list;
    const el = document.getElementById('player-list');
    if (!el) return;
    if (query) {
        el.innerHTML = filtered.map(renderPlayerListItem).join('');
    } else {
        rebuildPlayerList(list, window._tournamentListForPlayers || []);
    }
}
