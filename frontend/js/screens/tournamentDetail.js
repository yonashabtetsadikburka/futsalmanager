/* ========== TOURNAMENT DETAIL SCREEN ========== */
async function renderTournamentDetail(container) {
    const id = getRouteParam();
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        const [tournament] = await Promise.all([
            apiGet('tournaments/read_one.php?id=' + id)
        ]);
        const t = tournament.data || tournament;
        const isRoundRobin = t.format === 'round_robin';

        const [groups, standings, allMatches, knockoutMatches, playerStats] = await Promise.all([
            isRoundRobin ? Promise.resolve({ data: [] }) : apiGet('groups/read.php?tournament_id=' + id),
            isRoundRobin ? apiGet('tournaments/standings.php?tournament_id=' + id) : apiGet('groups/standings.php?tournament_id=' + id),
            apiGet('tournaments/matches.php?tournament_id=' + id),
            isRoundRobin ? Promise.resolve({ data: [] }) : apiGet('groups/knockout_matches.php?tournament_id=' + id),
            apiGet('stats/player_stats.php?tournament_id=' + id)
        ]);
        const gList = Array.isArray(groups) ? groups : (groups.data || []);
        const sList = Array.isArray(standings) ? standings : (standings.data || []);
        const allMatchList = Array.isArray(allMatches) ? allMatches : (allMatches.data || []);
        const koList = Array.isArray(knockoutMatches) ? knockoutMatches : (knockoutMatches.data || []);
        const pStats = Array.isArray(playerStats) ? playerStats : (playerStats.data || []);

        const groupMatches = allMatchList.filter(m => m.round === 'girone');
        window._detailGroupMatches = groupMatches;
        window._detailKoMatches = koList;

        let html = '<div class="screen active">';

        /* ===== HEADER ===== */
        html += '<div class="tournament-detail-header"><div class="page-header" style="background:none;padding:0;border:none">';
        html += '<button class="back-btn" onclick="Router.back()">' + icon('arrow-left', 24) + '</button>';
        html += '<div style="display:flex;align-items:center;gap:12px">';
        if (t.logo_url) {
            html += '<img src="' + escapeHtml(t.logo_url) + '" class="team-logo-sm" style="width:48px;height:48px" alt="Logo">';
        } else {
            html += '<div class="team-logo-placeholder-sm" style="width:48px;height:48px;font-size:18px">' + icon('trophy', 24) + '</div>';
        }
        html += '<div><div class="tournament-detail-title">' + escapeHtml(t.name) + '</div>';
        html += '<div class="tournament-detail-meta">';
        html += statusBadge(t.status);
        html += ' <span class="tournament-type-badge tournament-type-badge--light">' + (t.type || '5v5') + '</span>';
        html += '</div></div></div></div></div>';

        /* ===== STATS RIGA ===== */
        html += '<div class="screen-content" style="padding-top:16px">';
        html += '<div class="stat-grid" style="margin-bottom:16px">';
        html += '<div class="stat-card"><div class="stat-value">' + (t.teams_count || 0) + '</div><div class="stat-label">Squadre</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (t.players_count || 0) + '</div><div class="stat-label">Giocatori</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (t.matches_count || 0) + '</div><div class="stat-label">Partite</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (t.finished_matches_count || 0) + '</div><div class="stat-label">Completate</div></div>';
        html += '</div>';

        /* ===== INFO TORNEO ===== */
        var hasInfo = t.location || t.start_date || t.end_date || t.description;
        if (hasInfo) {
            html += '<div class="card" style="margin-bottom:16px">';
            html += '<div class="card-body">';
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' + icon('information', 16) + '<span style="font-size:14px;font-weight:700">Informazioni</span></div>';
            if (t.location) {
                html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:var(--color-text-secondary)">' + icon('map-pin', 14) + '<span>' + escapeHtml(t.location) + '</span></div>';
            }
            if (t.start_date || t.end_date) {
                var dateStr = '';
                if (t.start_date && t.end_date) {
                    dateStr = formatDateShort(t.start_date) + ' — ' + formatDateShort(t.end_date);
                } else if (t.start_date) {
                    dateStr = 'Dal ' + formatDateShort(t.start_date);
                } else {
                    dateStr = 'Fino al ' + formatDateShort(t.end_date);
                }
                html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:var(--color-text-secondary)">' + icon('calendar', 14) + '<span>' + dateStr + '</span></div>';
            }
            if (t.description) {
                html += '<div style="font-size:13px;color:var(--color-text-secondary);line-height:1.5;white-space:pre-wrap">' + escapeHtml(t.description) + '</div>';
            }
            html += '</div></div>';
        }

        /* ===== TABS ===== */
        html += '<div class="tournament-tabs" id="detail-tabs">';
        html += '<div class="tournament-tab active" onclick="showDetailTab(\'groups\', this)">' + (isRoundRobin ? 'Classifica' : 'Gironi') + '</div>';
        html += '<div class="tournament-tab" onclick="showDetailTab(\'matches\', this)">Partite</div>';
        if (koList.length > 0) {
            html += '<div class="tournament-tab" onclick="showDetailTab(\'knockout\', this)">Eliminazione</div>';
        }
        html += '<div class="tournament-tab" onclick="showDetailTab(\'stats\', this)">Statistiche</div>';
        if (t.status === 'finished') {
            html += '<div class="tournament-tab" onclick="showDetailTab(\'albo\', this)">Albo d\'Oro</div>';
        }
        html += '</div>';

        /* ===== TAB: GIRONI / CLASSIFICA ===== */
        html += '<div id="detail-groups" class="detail-tab-content">';
        if (isRoundRobin) {
            /* Round Robin: mostra classifica piatta di tutte le squadre */
            if (sList.length > 0) {
                html += '<div class="group-section">';
                html += '<div class="group-title">Classifica Generale</div>';
                html += '<div class="table-wrapper"><table class="standings-table"><thead><tr><th style="width:32px">#</th><th>Squadra</th><th style="width:28px">G</th><th style="width:28px">V</th><th style="width:28px">N</th><th style="width:28px">P</th><th style="width:32px">GF</th><th style="width:32px">GS</th><th style="width:32px">DR</th><th style="width:36px" class="th-pt">Pt</th></tr></thead><tbody>';
                sList.forEach((s, i) => {
                    const played = (s.wins || 0) + (s.draws || 0) + (s.losses || 0);
                    const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                    html += '<tr><td><span class="table-pos ' + posClass + '">' + (i + 1) + '</span></td>';
                    html += '<td><span class="table-team">';
                    if (s.logo_url) {
                        html += '<img src="' + escapeHtml(s.logo_url) + '" class="table-team-logo" alt="">';
                    } else {
                        html += '<span class="table-team-logo-placeholder">' + (s.name || '?').charAt(0) + '</span>';
                    }
                    html += escapeHtml(s.name || '') + '</span></td>';
                    html += '<td>' + played + '</td><td>' + (s.wins || 0) + '</td><td>' + (s.draws || 0) + '</td><td>' + (s.losses || 0) + '</td>';
                    html += '<td>' + (s.goals_scored || 0) + '</td><td>' + (s.goals_conceded || 0) + '</td><td>' + (s.diff_reti || 0) + '</td>';
                    html += '<td class="td-pt"><strong>' + (s.punti || 0) + '</strong></td></tr>';
                });
                html += '</tbody></table></div>';
                html += '</div>';
            } else {
                html += showEmpty('format-list-numbered', 'Nessuna classifica', 'Nessuna classifica disponibile per questo torneo.');
            }
        } else {
        if (gList.length === 0) {
            html += showEmpty('google-circles', 'Nessun girone', 'Nessun girone configurato per questo torneo.');
        } else {
            gList.forEach(g => {
                const groupStandings = sList.filter(s => s.group_id == g.id);
                groupStandings.sort((a, b) => (b.punti || 0) - (a.punti || 0) || (b.diff_reti || 0) - (a.diff_reti || 0));

                html += '<div class="group-section">';
                html += '<div class="group-title">' + escapeHtml(g.name) + '</div>';

                if (groupStandings.length > 0) {
                    html += '<div class="table-wrapper"><table class="standings-table"><thead><tr><th style="width:32px">#</th><th>Squadra</th><th style="width:28px">G</th><th style="width:28px">V</th><th style="width:28px">N</th><th style="width:28px">P</th><th style="width:32px">GF</th><th style="width:32px">GS</th><th style="width:32px">DR</th><th style="width:36px" class="th-pt">Pt</th></tr></thead><tbody>';
                    groupStandings.forEach((s, i) => {
                        const played = (s.wins || 0) + (s.draws || 0) + (s.losses || 0);
                        const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                        html += '<tr><td><span class="table-pos ' + posClass + '">' + (i + 1) + '</span></td>';
                        html += '<td><span class="table-team">';
                        if (s.logo_url) {
                            html += '<img src="' + escapeHtml(s.logo_url) + '" class="table-team-logo" alt="">';
                        } else {
                            html += '<span class="table-team-logo-placeholder">' + (s.name || '?').charAt(0) + '</span>';
                        }
                        html += escapeHtml(s.name || '') + '</span></td>';
                        html += '<td>' + played + '</td><td>' + (s.wins || 0) + '</td><td>' + (s.draws || 0) + '</td><td>' + (s.losses || 0) + '</td>';
                        html += '<td>' + (s.goals_scored || 0) + '</td><td>' + (s.goals_conceded || 0) + '</td><td>' + (s.diff_reti || 0) + '</td>';
                        html += '<td class="td-pt"><strong>' + (s.punti || 0) + '</strong></td></tr>';
                    });
                    html += '</tbody></table></div>';
                }

                html += '</div>';
            });
        }
        }
        html += '</div>';

        /* ===== TAB: PARTITE (divise per girone o piatte per round_robin) ===== */
        html += '<div id="detail-matches" class="detail-tab-content" style="display:none">';
        if (groupMatches.length === 0 && koList.length === 0) {
            html += showEmpty('calendar', 'Nessuna partita', 'Nessuna partita trovata per questo torneo.');
        } else {
            if (isRoundRobin) {
                /* Round Robin: mostra tutte le partite in una lista piatta */
                var allGroupMatches = groupMatches.slice();
                allGroupMatches.sort(function(a, b) {
                    if (a.status === 'finished' && b.status !== 'finished') return 1;
                    if (a.status !== 'finished' && b.status === 'finished') return -1;
                    return new Date(a.match_date) - new Date(b.match_date);
                });
                html += '<div class="group-section">';
                html += '<div class="group-title">Calendario Partite</div>';
                allGroupMatches.forEach(function(m) {
                    var isFinished = m.status === 'finished';
                    var statusClass = isFinished ? 'match-status-finished' : 'match-status-scheduled';
                    var statusLabel = isFinished ? 'Terminata' : 'Pianificata';
                    var clickAttr = isFinished ? ' onclick="showMatchDetail(' + m.id + ')" style="cursor:pointer"' : '';

                    html += '<div class="match-card"' + clickAttr + '>';
                    html += '<div class="match-card-teams">';
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (m.home_logo_url) {
                        html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (m.home_team || '?').charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(m.home_team || 'TBD') + '</span></div></div>';
                    if (isFinished) {
                        var scoreStr = m.home_score + ' - ' + m.away_score;
                        if (m.home_extra_time !== null && m.away_extra_time !== null) {
                            scoreStr += ', ET ' + m.home_extra_time + ' - ' + m.away_extra_time;
                            if (m.home_extra_time == m.away_extra_time && m.home_penalties !== null && m.away_penalties !== null) {
                                scoreStr += ', Rig ' + m.home_penalties + ' - ' + m.away_penalties;
                            }
                        } else if (m.home_penalties !== null && m.away_penalties !== null) {
                            scoreStr += ', Rig ' + m.home_penalties + ' - ' + m.away_penalties;
                        }
                        html += '<div class="match-score">' + scoreStr + '</div>';
                    } else {
                        html += '<div class="match-score" style="font-size:11px;font-family:var(--font-mono);color:var(--color-text-tertiary)">VS</div>';
                    }
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (m.away_logo_url) {
                        html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (m.away_team || '?').charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(m.away_team || 'TBD') + '</span></div></div>';
                    html += '</div>';
                    html += '<div class="match-card-datetime">';
                    html += '<span class="match-status ' + statusClass + '"><span class="match-status-dot"></span>' + statusLabel + '</span>';
                    html += ' &nbsp; ' + formatDateTime(m.match_date);
                    if (t.location) html += ' &nbsp; ' + icon('map-pin', 10) + ' ' + escapeHtml(t.location);
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                /* Gironi: raggruppa per girone */
                if (gList.length > 0) {
                    gList.forEach(g => {
                        var gMatches = groupMatches.filter(m => m.group_name === g.name);
                        if (gMatches.length > 0) {
                            /* Ordina: pianificate sopra, terminate sotto, poi per data */
                            gMatches.sort(function(a, b) {
                                if (a.status === 'finished' && b.status !== 'finished') return 1;
                                if (a.status !== 'finished' && b.status === 'finished') return -1;
                                return new Date(a.match_date) - new Date(b.match_date);
                            });
                            html += '<div class="group-section">';
                            html += '<div class="group-title">' + g.name + '</div>';
                            gMatches.forEach(function(m) {
                                var isFinished = m.status === 'finished';
                                var statusClass = isFinished ? 'match-status-finished' : 'match-status-scheduled';
                                var statusLabel = isFinished ? 'Terminata' : 'Pianificata';
                                var clickAttr = isFinished ? ' onclick="showMatchDetail(' + m.id + ')" style="cursor:pointer"' : '';

                                html += '<div class="match-card"' + clickAttr + '>';
                                html += '<div class="match-card-teams">';
                                html += '<div class="match-team"><div class="match-team-row">';
                                if (m.home_logo_url) {
                                    html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                                } else {
                                    html += '<span class="match-team-logo-placeholder">' + (m.home_team || '?').charAt(0) + '</span>';
                                }
                                html += '<span class="match-team-name">' + escapeHtml(m.home_team || 'TBD') + '</span></div></div>';
                                if (isFinished) {
                                    var scoreStr = m.home_score + ' - ' + m.away_score;
                                    if (m.home_extra_time !== null && m.away_extra_time !== null) {
                                        scoreStr += ', ET ' + m.home_extra_time + ' - ' + m.away_extra_time;
                                        if (m.home_extra_time == m.away_extra_time && m.home_penalties !== null && m.away_penalties !== null) {
                                            scoreStr += ', Rig ' + m.home_penalties + ' - ' + m.away_penalties;
                                        }
                                    } else if (m.home_penalties !== null && m.away_penalties !== null) {
                                        scoreStr += ', Rig ' + m.home_penalties + ' - ' + m.away_penalties;
                                    }
                                    html += '<div class="match-score">' + scoreStr + '</div>';
                                } else {
                                    html += '<div class="match-score" style="font-size:11px;font-family:var(--font-mono);color:var(--color-text-tertiary)">VS</div>';
                                }
                                html += '<div class="match-team"><div class="match-team-row">';
                                if (m.away_logo_url) {
                                    html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                                } else {
                                    html += '<span class="match-team-logo-placeholder">' + (m.away_team || '?').charAt(0) + '</span>';
                                }
                                html += '<span class="match-team-name">' + escapeHtml(m.away_team || 'TBD') + '</span></div></div>';
                                html += '</div>';
                                html += '<div class="match-card-datetime">';
                                html += '<span class="match-status ' + statusClass + '"><span class="match-status-dot"></span>' + statusLabel + '</span>';
                                html += ' &nbsp; ' + formatDateTime(m.match_date);
                                if (t.location) html += ' &nbsp; ' + icon('map-pin', 10) + ' ' + escapeHtml(t.location);
                                html += '</div>';
                                html += '</div>';
                            });
                            html += '</div>';
                        }
                    });
                }
            }
            var ungroupedMatches = groupMatches.filter(function(m) { return !m.group_name; });
            if (ungroupedMatches.length > 0) {
                ungroupedMatches.sort(function(a, b) {
                    if (a.status === 'finished' && b.status !== 'finished') return 1;
                    if (a.status !== 'finished' && b.status === 'finished') return -1;
                    return new Date(a.match_date) - new Date(b.match_date);
                });
                html += '<div class="group-section">';
                html += '<div class="group-title">Altre partite</div>';
                ungroupedMatches.forEach(function(m) {
                    var isFinished = m.status === 'finished';
                    var statusClass = isFinished ? 'match-status-finished' : 'match-status-scheduled';
                    var statusLabel = isFinished ? 'Terminata' : 'Pianificata';
                    var clickAttr = isFinished ? ' onclick="showMatchDetail(' + m.id + ')" style="cursor:pointer"' : '';

                    html += '<div class="match-card"' + clickAttr + '>';
                    html += '<div class="match-card-teams">';
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (m.home_logo_url) {
                        html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (m.home_team || '?').charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(m.home_team || 'TBD') + '</span></div></div>';
if (isFinished) {
                var scoreStr = m.home_score + ' - ' + m.away_score;
                if (m.home_extra_time !== null && m.away_extra_time !== null) {
                    scoreStr += ', ET ' + m.home_extra_time + ' - ' + m.away_extra_time;
                    if (m.home_extra_time == m.away_extra_time && m.home_penalties !== null && m.away_penalties !== null) {
                        scoreStr += ', Rig ' + m.home_penalties + ' - ' + m.away_penalties;
                    }
                } else if (m.home_penalties !== null && m.away_penalties !== null) {
                    scoreStr += ', Rig ' + m.home_penalties + ' - ' + m.away_penalties;
                }
                html += '<div class="match-score">' + scoreStr + '</div>';
            } else {
                        html += '<div class="match-score" style="font-size:11px;font-family:var(--font-mono);color:var(--color-text-tertiary)">VS</div>';
                    }
                    html += '<div class="match-team"><div class="match-team-row">';
                    if (m.away_logo_url) {
                        html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                    } else {
                        html += '<span class="match-team-logo-placeholder">' + (m.away_team || '?').charAt(0) + '</span>';
                    }
                    html += '<span class="match-team-name">' + escapeHtml(m.away_team || 'TBD') + '</span></div></div>';
                    html += '</div>';
                    html += '<div class="match-card-datetime">';
                    html += '<span class="match-status ' + statusClass + '"><span class="match-status-dot"></span>' + statusLabel + '</span>';
                    html += ' &nbsp; ' + formatDateTime(m.match_date);
                    if (t.location) html += ' &nbsp; ' + icon('map-pin', 10) + ' ' + escapeHtml(t.location);
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
            }

            /* ===== ELIMINAZIONE DIRETTE NEL TAB PARTITE ===== */
            if (koList.length > 0) {
                var roundOrder = ['ottavi', 'quarti', 'semifinale', 'terzo_posto', 'finale'];
                var roundLabels = {
                    'ottavi': 'Ottavi di Finale',
                    'quarti': 'Quarti di Finale',
                    'semifinale': 'Semifinale',
                    'terzo_posto': '3° Posto',
                    'finale': 'Finale'
                };

                /* Titolo Eliminazione Diretta */
                html += '<div style="margin-top:24px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--color-primary)">';
                html += '<span style="font-size:15px;font-weight:700;color:var(--color-primary);text-transform:uppercase;letter-spacing:0.5px">' + icon('lightning-bolt', 16) + ' Eliminazione Diretta</span>';
                html += '</div>';

                roundOrder.forEach(function(round) {
                    var roundMatches = koList.filter(function(m) { return m.round === round; });
                    if (roundMatches.length === 0) return;

                    roundMatches.sort(function(a, b) {
                        if (a.status === 'finished' && b.status !== 'finished') return 1;
                        if (a.status !== 'finished' && b.status === 'finished') return -1;
                        return new Date(a.match_date) - new Date(b.match_date);
                    });

                    html += '<div class="group-section">';
                    html += '<div class="group-title">' + ' ' + (roundLabels[round] || round) + '</div>';

                    roundMatches.forEach(function(m) {
                        var isFinished = m.status === 'finished';
                        var hasET = m.home_extra_time !== null && m.away_extra_time !== null;
                        var hasRig = m.home_penalties !== null && m.away_penalties !== null;
                        var statusClass = isFinished ? 'match-status-finished' : 'match-status-scheduled';
                        var statusLabel = isFinished ? 'Terminata' : 'Pianificata';
                        var clickAttr = isFinished ? ' onclick="showMatchDetail(' + m.id + ')" style="cursor:pointer"' : '';

                        html += '<div class="match-card"' + clickAttr + '>';
                        html += '<div style="text-align:center;padding:10px 12px">';

                        /* Riga 1: Squadre + Risultato tempo regolare */
                        html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px">';
                        html += '<span style="flex:1;text-align:right;font-weight:600;font-size:13px">' + escapeHtml(m.home_team || 'TBD') + '</span>';
                        if (m.home_logo_url) {
                            html += '<img src="' + escapeHtml(m.home_logo_url) + '" class="match-team-logo" alt="">';
                        } else {
                            html += '<span class="match-team-logo-placeholder">' + (m.home_team || '?').charAt(0) + '</span>';
                        }
                        html += '<span style="font-weight:800;font-size:15px;color:var(--color-primary);min-width:80px;text-align:center">' + m.home_score + ' - ' + m.away_score + '</span>';
                        if (m.away_logo_url) {
                            html += '<img src="' + escapeHtml(m.away_logo_url) + '" class="match-team-logo" alt="">';
                        } else {
                            html += '<span class="match-team-logo-placeholder">' + (m.away_team || '?').charAt(0) + '</span>';
                        }
                        html += '<span style="flex:1;text-align:left;font-weight:600;font-size:13px">' + escapeHtml(m.away_team || 'TBD') + '</span>';
                        html += '</div>';

                        /* Riga 2: ET (se presente) */
                        if (hasET) {
                            html += '<div style="font-size:11px;color:var(--color-text-tertiary);font-weight:600;margin-top:4px">ET</div>';
                            html += '<div style="font-size:14px;font-weight:700">' + m.home_extra_time + ' - ' + m.away_extra_time + '</div>';
                        }

                        /* Riga 3: Rigori (se presente) */
                        if (hasRig) {
                            html += '<div style="font-size:11px;color:var(--color-text-tertiary);font-weight:600;margin-top:4px">Rig</div>';
                            html += '<div style="font-size:14px;font-weight:700">' + m.home_penalties + ' - ' + m.away_penalties + '</div>';
                        }

                        html += '</div>';

                        /* Stato + Data (fuori dal div interno, direct child di match-card) */
                        html += '<div class="match-card-datetime">';
                        html += '<span class="match-status ' + statusClass + '"><span class="match-status-dot"></span>' + statusLabel + '</span>';
                        html += ' &nbsp; ' + formatDateTime(m.match_date);
                        if (t.location) html += ' &nbsp; ' + icon('map-pin', 10) + ' ' + escapeHtml(t.location);
                        html += '</div>';

                        html += '</div>';
                    });

                    html += '</div>';
                });
            }
        }
        html += '</div>';

        /* ===== TAB: ELIMINAZIONE DIRETTE (BRACKET GRAFICO) ===== */
        if (koList.length > 0) {
            html += '<div id="detail-knockout" class="detail-tab-content" style="display:none">';
            html += renderBracket(koList);
            html += '</div>';
        }

        /* ===== TAB: STATISTICHE ===== */
        html += '<div id="detail-stats" class="detail-tab-content" style="display:none">';
        if (pStats.length === 0) {
            html += showEmpty('chart', 'Nessuna statistica', 'Nessuna statistica disponibile per questo torneo.');
        } else {
            if (isRoundRobin) {
                /* Round Robin: mostra statistiche piatte senza separazione per gironi */
                var scorers = [...pStats].sort((a, b) => (parseInt(b.gol) || 0) - (parseInt(a.gol) || 0)).filter(p => parseInt(p.gol) > 0);
                var assisters = [...pStats].sort((a, b) => (parseInt(b.assist) || 0) - (parseInt(a.assist) || 0)).filter(p => parseInt(p.assist) > 0);
                var cleanSheets = [...pStats].sort((a, b) => (parseInt(b.clean_sheets) || 0) - (parseInt(a.clean_sheets) || 0)).filter(p => parseInt(p.clean_sheets) > 0);

                /* Sub-tabs: Marcatori, Assist, Clean Sheet */
                html += '<div class="scroll-tabs" id="detail-stats-subtabs">';
                html += '<div class="scroll-tab active" data-subtab="scorers" onclick="showDetailStatsSubtab(\'scorers\',this)">Marcatori</div>';
                html += '<div class="scroll-tab" data-subtab="assists" onclick="showDetailStatsSubtab(\'assists\',this)">Assist</div>';
                html += '<div class="scroll-tab" data-subtab="cleansheets" onclick="showDetailStatsSubtab(\'cleansheets\',this)">Clean Sheet</div>';
                html += '</div>';

                /* Scorers */
                html += '<div class="detail-stats-subcontent" id="detail-stats-scorers-flat">';
                if (scorers.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessun marcatore disponibile.');
                else scorers.forEach((p, i) => {
                    html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
                    html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
                    html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
                    html += '<div class="stat-leader-value">' + (p.gol || 0) + '</div></div>';
                });
                html += '</div>';

                /* Assists */
                html += '<div class="detail-stats-subcontent" id="detail-stats-assists-flat" style="display:none">';
                if (assisters.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessun assist disponibile.');
                else assisters.forEach((p, i) => {
                    html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
                    html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
                    html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
                    html += '<div class="stat-leader-value">' + (p.assist || 0) + '</div></div>';
                });
                html += '</div>';

                /* Clean Sheets */
                html += '<div class="detail-stats-subcontent" id="detail-stats-cleansheets-flat" style="display:none">';
                if (cleanSheets.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessun clean sheet disponibile.');
                else cleanSheets.forEach((p, i) => {
                    html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
                    html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
                    html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
                    html += '<div class="stat-leader-value">' + (p.clean_sheets || 0) + '</div></div>';
                });
                html += '</div>';
            } else {
                /* Gironi: mostra statistiche per girone */
                /* Group scroll-tabs */
                if (gList.length > 0) {
                    html += '<div class="scroll-tabs" id="detail-stats-groups">';
                    gList.forEach((g, i) => {
                        html += '<div class="scroll-tab' + (i === 0 ? ' active' : '') + '" data-group="' + g.id + '" onclick="showDetailStatsGroup(' + g.id + ',this)">' + escapeHtml(g.name) + '</div>';
                    });
                html += '</div>';
            }

            /* Sub-tabs: Marcatori, Assist, Clean Sheet */
            html += '<div class="scroll-tabs" id="detail-stats-subtabs">';
            html += '<div class="scroll-tab active" data-subtab="scorers" onclick="showDetailStatsSubtab(\'scorers\',this)">Marcatori</div>';
            html += '<div class="scroll-tab" data-subtab="assists" onclick="showDetailStatsSubtab(\'assists\',this)">Assist</div>';
            html += '<div class="scroll-tab" data-subtab="cleansheets" onclick="showDetailStatsSubtab(\'cleansheets\',this)">Clean Sheet</div>';
            html += '</div>';

            /* Content containers */
            gList.forEach((g, gIdx) => {
                const groupStats = pStats.filter(p => p.group_id == g.id);
                const scorers = [...groupStats].sort((a, b) => (parseInt(b.gol) || 0) - (parseInt(a.gol) || 0)).filter(p => parseInt(p.gol) > 0);
                const assisters = [...groupStats].sort((a, b) => (parseInt(b.assist) || 0) - (parseInt(a.assist) || 0)).filter(p => parseInt(p.assist) > 0);
                const cleanSheets = [...groupStats].sort((a, b) => (parseInt(b.clean_sheets) || 0) - (parseInt(a.clean_sheets) || 0)).filter(p => parseInt(p.clean_sheets) > 0);

                /* Scorers */
                html += '<div class="detail-stats-group-content" data-group="' + g.id + '"' + (gIdx > 0 ? ' style="display:none"' : '') + '>';
                html += '<div id="detail-stats-scorers-' + g.id + '" class="detail-stats-subcontent">';
                if (scorers.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessun marcatore disponibile.');
                else scorers.forEach((p, i) => {
                    html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
                    html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
                    html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
                    html += '<div class="stat-leader-value">' + (p.gol || 0) + '</div></div>';
                });
                html += '</div>';

                /* Assists */
                html += '<div id="detail-stats-assists-' + g.id + '" class="detail-stats-subcontent" style="display:none">';
                if (assisters.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessun assist disponibile.');
                else assisters.forEach((p, i) => {
                    html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
                    html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
                    html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
                    html += '<div class="stat-leader-value">' + (p.assist || 0) + '</div></div>';
                });
                html += '</div>';

                /* Clean Sheets */
                html += '<div id="detail-stats-cleansheets-' + g.id + '" class="detail-stats-subcontent" style="display:none">';
                if (cleanSheets.length === 0) html += showEmpty('chart', 'Nessun dato', 'Nessun clean sheet disponibile.');
                else cleanSheets.forEach((p, i) => {
                    html += '<div class="stat-leader"><span class="stat-leader-rank ' + (i < 3 ? 'top-' + (i + 1) : '') + '">' + (i + 1) + '</span>';
                    html += '<div class="stat-leader-info"><div class="stat-leader-name">' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</div>';
                    html += '<div class="stat-leader-team">' + escapeHtml(p.team_name || '') + '</div></div>';
                    html += '<div class="stat-leader-value">' + (p.clean_sheets || 0) + '</div></div>';
                });
                html += '</div>';

                html += '</div>';
            });
            }
        }
        html += '</div>';

        /* ===== TAB: ALBO D'ORO ===== */
        if (t.status === 'finished') {
            html += '<div id="detail-albo" class="detail-tab-content" style="display:none">';
            html += '<div id="albo-content"><div style="text-align:center;padding:20px">' + showLoading() + '</div></div>';
            html += '</div>';
        }

        html += '</div></div>';
        container.innerHTML = html;

        if (t.status === 'finished') {
            loadAlboDoro(id);
        }
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content"><div class="empty-state">' + icon('alert-circle', 48) + '<h3>Qualcosa \u00e8 andato storto</h3><p>Riprova piu tardi.</p></div></div></div>';
    }
    hideFAB();
}

/* ========== BRACKET RENDERING ========== */
function renderBracket(koList) {
    const roundOrder = ['ottavi', 'quarti', 'semifinale', 'terzo_posto', 'finale'];
    const roundLabels = {
        'ottavi': 'Ottavi',
        'quarti': 'Quarti',
        'semifinale': 'Semifinale',
        'terzo_posto': '3\u00b0 Posto',
        'finale': 'Finale'
    };

    const availableRounds = roundOrder.filter(r => koList.some(m => m.round === r));

    let html = '<div class="bracket-container">';
    html += '<div class="bracket-scroll">';

    availableRounds.forEach((round, roundIdx) => {
        const roundMatches = koList.filter(m => m.round === round);
        const isFinalRound = (round === 'semifinale' || round === 'finale' || round === 'terzo_posto');
        const roundClass = isFinalRound ? 'bracket-round bracket-round-final' : 'bracket-round';

        html += '<div class="' + roundClass + '">';
        html += '<div class="bracket-round-title">' + (roundLabels[round] || round) + '</div>';
        html += '<div class="bracket-matches">';

        roundMatches.forEach(m => {
            const finished = m.status === 'finished';

            /* Determine winner: regular time → ET → penalties */
            let homeFinal = parseInt(m.home_score) || 0;
            let awayFinal = parseInt(m.away_score) || 0;
            if (homeFinal === awayFinal && m.home_extra_time !== null && m.away_extra_time !== null) {
                homeFinal = parseInt(m.home_extra_time) || 0;
                awayFinal = parseInt(m.away_extra_time) || 0;
            }
            if (homeFinal === awayFinal && m.home_penalties !== null && m.away_penalties !== null) {
                homeFinal = parseInt(m.home_penalties) || 0;
                awayFinal = parseInt(m.away_penalties) || 0;
            }
            const homeWin = finished && homeFinal > awayFinal;
            const awayWin = finished && awayFinal > homeFinal;

html += '<div class="bracket-match' + (finished ? ' finished' : '') + '">';
            html += '<div class="bracket-team' + (homeWin ? ' winner' : '') + '">';
            html += '<span class="bracket-team-name">' + escapeHtml(m.home_team || 'TBD') + '</span>';
            if (finished && m.round === 'terzo_posto') {
                html += '<span class="bracket-placement ' + (homeWin ? 'third' : 'fourth') + '">' + (homeWin ? '3°' : '4°') + '</span>';
            }
            if (finished) {
                html += '<span class="bracket-score">' + m.home_score + '</span>';
                if (m.home_extra_time !== null && m.away_extra_time !== null) {
                    html += '<span class="bracket-penalties">ET(' + m.home_extra_time + ')</span>';
                }
                if (m.home_penalties !== null && m.away_penalties !== null) {
                    html += '<span class="bracket-penalties">Rig(' + m.home_penalties + ')</span>';
                }
            }
            html += '</div>';
            html += '<div class="bracket-divider"></div>';
            html += '<div class="bracket-team' + (awayWin ? ' winner' : '') + '">';
            html += '<span class="bracket-team-name">' + escapeHtml(m.away_team || 'TBD') + '</span>';
            if (finished && m.round === 'terzo_posto') {
                html += '<span class="bracket-placement ' + (awayWin ? 'third' : 'fourth') + '">' + (awayWin ? '3°' : '4°') + '</span>';
            }
            if (finished) {
                html += '<span class="bracket-score">' + m.away_score + '</span>';
                if (m.home_extra_time !== null && m.away_extra_time !== null) {
                    html += '<span class="bracket-penalties">ET(' + m.away_extra_time + ')</span>';
                }
                if (m.home_penalties !== null && m.away_penalties !== null) {
                    html += '<span class="bracket-penalties">Rig(' + m.away_penalties + ')</span>';
                }
            }
            html += '</div>';
            if (!finished && m.match_date) {
                html += '<div class="bracket-date">' + formatDateTime(m.match_date) + '</div>';
            }
            html += '</div>';
        });

        html += '</div></div>';
    });

    /* Trofeo Campione (accanto al bracket Finale) */
    var finaleMatch = koList.find(function(m) { return m.round === 'finale' && m.status === 'finished'; });
    if (finaleMatch) {
        var fH = parseInt(finaleMatch.home_score) || 0;
        var fA = parseInt(finaleMatch.away_score) || 0;
        if (fH === fA && finaleMatch.home_extra_time !== null && finaleMatch.away_extra_time !== null) {
            fH = parseInt(finaleMatch.home_extra_time) || 0;
            fA = parseInt(finaleMatch.away_extra_time) || 0;
        }
        if (fH === fA && finaleMatch.home_penalties !== null && finaleMatch.away_penalties !== null) {
            fH = parseInt(finaleMatch.home_penalties) || 0;
            fA = parseInt(finaleMatch.away_penalties) || 0;
        }
        var champion = fH > fA ? finaleMatch.home_team : finaleMatch.away_team;

        html += '<div class="champion-section">';
        html += '<div class="trophy">';
        html += '<div class="trophy-body"><span class="trophy-icon">' + '</span></div>';
        html += '<div class="trophy-stem"></div>';
        html += '<div class="trophy-base"></div>';
        html += '</div>';
        html += '<div class="champion-label">Campione</div>';
        html += '<div class="champion-team">' + escapeHtml(champion) + '</div>';
        html += '</div>';
    }

    html += '</div></div>';
    return html;
}

function showDetailTab(tab, el) {
    document.querySelectorAll('.detail-tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tournament-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('detail-' + tab).style.display = 'block';
    if (el) el.classList.add('active');
}

async function loadAlboDoro(tournamentId) {
    const el = document.getElementById('albo-content');
    if (!el) return;

    try {
        const res = await apiGet('tournaments/albo_doro.php?tournament_id=' + tournamentId);
        const d = res.data || res;

        let html = '';

        /* Podio */
        if (d.champion || d.runner_up || d.third_place) {
            html += '<div class="albo-podium">';

            /* 2° Posto */
            html += '<div class="albo-podium-item albo-podium-second">';
            html += '<div class="albo-podium-rank">2°</div>';
            html += '<div class="albo-podium-medal albo-medal-silver">' + icon('medal', 24) + '</div>';
            html += '<div class="albo-podium-team">' + escapeHtml(d.runner_up || '-') + '</div>';
            html += '<div class="albo-podium-label">Finalista</div>';
            html += '</div>';

            /* 1° Posto */
            html += '<div class="albo-podium-item albo-podium-first">';
            html += '<div class="albo-podium-rank">1°</div>';
            html += '<div class="albo-podium-medal albo-medal-gold">' + icon('trophy', 32) + '</div>';
            html += '<div class="albo-podium-team">' + escapeHtml(d.champion || '-') + '</div>';
            html += '<div class="albo-podium-label">Campione</div>';
            html += '</div>';

            /* 3° Posto */
            html += '<div class="albo-podium-item albo-podium-third">';
            html += '<div class="albo-podium-rank">3°</div>';
            html += '<div class="albo-podium-medal albo-medal-bronze">' + icon('medal', 20) + '</div>';
            html += '<div class="albo-podium-team">' + escapeHtml(d.third_place || '-') + '</div>';
            html += '<div class="albo-podium-label">Terzo Posto</div>';
            html += '</div>';

            html += '</div>';
        }

        /* Statistiche individuali */
        if (d.top_scorer || d.top_assist || d.best_goalkeeper) {
            html += '<div class="albo-section">';
            html += '<div class="albo-section-title">Riconoscimenti Individuali</div>';

            if (d.top_scorer) {
                html += '<div class="albo-stat-card">';
                html += '<div class="albo-stat-icon" style="background:var(--color-warning)">' + icon('soccer', 20) + '</div>';
                html += '<div class="albo-stat-info">';
                html += '<div class="albo-stat-label">Capocannoniere</div>';
                html += '<div class="albo-stat-name">' + escapeHtml(d.top_scorer.name) + '</div>';
                html += '<div class="albo-stat-detail">' + escapeHtml(d.top_scorer.team) + ' · ' + d.top_scorer.goals + ' gol</div>';
                html += '</div></div>';
            }

            if (d.top_assist) {
                html += '<div class="albo-stat-card">';
                html += '<div class="albo-stat-icon" style="background:var(--color-primary)">' + icon('soccer-field', 20) + '</div>';
                html += '<div class="albo-stat-info">';
                html += '<div class="albo-stat-label">Capoassist</div>';
                html += '<div class="albo-stat-name">' + escapeHtml(d.top_assist.name) + '</div>';
                html += '<div class="albo-stat-detail">' + escapeHtml(d.top_assist.team) + ' · ' + d.top_assist.assists + ' assist</div>';
                html += '</div></div>';
            }

            if (d.best_goalkeeper) {
                html += '<div class="albo-stat-card">';
                html += '<div class="albo-stat-icon" style="background:var(--color-success)">' + icon('shield-check', 20) + '</div>';
                html += '<div class="albo-stat-info">';
                html += '<div class="albo-stat-label">Miglior Portiere</div>';
                html += '<div class="albo-stat-name">' + escapeHtml(d.best_goalkeeper.name) + '</div>';
                html += '<div class="albo-stat-detail">' + escapeHtml(d.best_goalkeeper.team) + ' · ' + d.best_goalkeeper.clean_sheets + ' clean sheet</div>';
                html += '</div></div>';
            }

            html += '</div>';
        }

        if (!html) {
            html = showEmpty('trophy', 'Nessun dato', 'Nessun dato disponibile per l\'albo d\'oro di questo torneo.');
        }

        el.innerHTML = html;
    } catch (e) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">' + icon('alert-circle', 24) + '<br>Impossibile caricare l\'albo d\'oro</div>';
    }
}

let _detailStatsActiveGroup = null;
let _detailStatsActiveSubtab = 'scorers';

function showDetailStatsGroup(groupId, el) {
    _detailStatsActiveGroup = groupId;
    document.querySelectorAll('#detail-stats-groups .scroll-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.detail-stats-group-content').forEach(c => c.style.display = 'none');
    const target = document.querySelector('.detail-stats-group-content[data-group="' + groupId + '"]');
    if (target) target.style.display = 'block';
    _detailStatsUpdateVisibility();
}

function showDetailStatsSubtab(subtab, el) {
    _detailStatsActiveSubtab = subtab;
    document.querySelectorAll('#detail-stats-subtabs .scroll-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    _detailStatsUpdateVisibility();
}

function _detailStatsUpdateVisibility() {
    document.querySelectorAll('.detail-stats-group-content[data-group]').forEach(group => {
        if (group.style.display === 'none') return;
        const gid = group.dataset.group;
        group.querySelectorAll('.detail-stats-subcontent').forEach(c => c.style.display = 'none');
        const target = group.querySelector('#detail-stats-' + _detailStatsActiveSubtab + '-' + gid);
        if (target) target.style.display = 'block';
    });
}

function formatRound(round) {
    const map = {
        'girone': 'Girone',
        'ottavi': 'Ottavi',
        'quarti': 'Quarti',
        'semifinale': 'Semifinale',
        'finale': 'Finale',
        'terzo_posto': 'Terzo Posto'
    };
    return map[round] || round;
}

/* ========== MATCH DETAIL MODAL (PUBBLICO) ========== */
async function showMatchDetail(matchId) {
    showModal('Risultato', '<div style="text-align:center;padding:20px">' + showLoading() + '</div>');

    try {
        var res = await apiGet('stats/player_stats.php?match_id=' + matchId);
        var stats = Array.isArray(res) ? res : (res.data || []);
    } catch (e) {
        showModal('Risultato', '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">Impossibile caricare i dettagli</div>');
        return;
    }

    var matchInfo = null;
    var groupMatches = window._detailGroupMatches || [];
    for (var i = 0; i < groupMatches.length; i++) {
        if (groupMatches[i].id == matchId) {
            matchInfo = groupMatches[i];
            break;
        }
    }

    if (!matchInfo) {
        var koMatches = window._detailKoMatches || [];
        for (var i = 0; i < koMatches.length; i++) {
            if (koMatches[i].id == matchId) {
                matchInfo = koMatches[i];
                break;
            }
        }
    }

    if (!matchInfo) {
        showModal('Risultato', '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">Partita non trovata</div>');
        return;
    }

    var homeTeam = matchInfo.home_team || 'TBD';
    var awayTeam = matchInfo.away_team || 'TBD';
    var homeScore = matchInfo.home_score != null ? matchInfo.home_score : 0;
    var awayScore = matchInfo.away_score != null ? matchInfo.away_score : 0;

    var homeScorers = stats.filter(function(p) { return p.team_name === homeTeam && p.gol > 0; });
    var awayScorers = stats.filter(function(p) { return p.team_name === awayTeam && p.gol > 0; });

    var body = '';

    /* Data/ora centrata in cima */
    body += '<div style="text-align:center;font-family:var(--font-mono);font-size:11px;color:var(--color-text-tertiary);margin-bottom:16px">';
    body += formatDateTime(matchInfo.match_date);
    body += '</div>';

    /* Score centrato */
    body += '<div style="text-align:center;font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--color-text-primary);margin-bottom:20px">';
    body += escapeHtml(homeTeam) + ' <span style="color:var(--color-primary)">' + homeScore + ' - ' + awayScore + '</span> ' + escapeHtml(awayTeam);
    body += '</div>';

    /* Breakdown ET / Rigori */
    var hasET = matchInfo.home_extra_time !== null && matchInfo.away_extra_time !== null;
    var hasRig = matchInfo.home_penalties !== null && matchInfo.away_penalties !== null;
    if (hasET || hasRig) {
        body += '<div style="text-align:center;margin-bottom:16px;font-size:13px">';
        if (hasET) {
            body += '<div style="color:var(--color-text-tertiary);font-weight:600">ET <span style="color:var(--color-text-primary);font-weight:700">' + matchInfo.home_extra_time + ' - ' + matchInfo.away_extra_time + '</span></div>';
        }
        if (hasRig) {
            body += '<div style="color:var(--color-text-tertiary);font-weight:600;margin-top:2px">Rig <span style="color:var(--color-primary);font-weight:700">' + matchInfo.home_penalties + ' - ' + matchInfo.away_penalties + '</span></div>';
        }
        body += '</div>';
    }

    /* Marcatori in due colonne */
    if (homeScorers.length > 0 || awayScorers.length > 0) {
        body += '<div style="display:flex;justify-content:space-between">';
        /* Colonna sinistra: squadra casa */
        body += '<div style="flex:1;text-align:left">';
        homeScorers.forEach(function(p) {
            body += '<div style="font-size:13px;padding:2px 0;color:var(--color-text-primary)">' + abbreviateName(p.first_name, p.last_name) + '<span style="color:var(--color-primary);font-weight:700">(' + p.gol + ')</span></div>';
        });
        body += '</div>';
        /* Colonna destra: squadra ospite */
        body += '<div style="flex:1;text-align:right">';
        awayScorers.forEach(function(p) {
            body += '<div style="font-size:13px;padding:2px 0;color:var(--color-text-primary)">' + abbreviateName(p.first_name, p.last_name) + '<span style="color:var(--color-primary);font-weight:700">(' + p.gol + ')</span></div>';
        });
        body += '</div>';
        body += '</div>';
    } else {
        body += '<div style="text-align:center;color:var(--color-text-tertiary);font-size:12px;margin-top:8px">Nessun dato sui marcatori</div>';
    }

    showModal('Risultato', body);
}

function abbreviateName(first, last) {
    if (!first && !last) return '';
    if (!first) return last;
    if (!last) return first;
    return first.charAt(0) + '.' + last;
}
