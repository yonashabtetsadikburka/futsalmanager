/* ========== ADMIN MATCHES ========== */

var _mTournaments = [];
var _mGroups = [];
var _mTeams = [];
var _mMatches = [];

var _createForm = { tid: null, gid: null, homeId: null, awayId: null, date: '', time: '' };
var _selMatchId = null;
var _selMatch = null;

var _cal = { year: 0, month: 0, sel: '' };
var _tw = { hour: 18, minute: 0 };
var _mShowAll = {};

/* ══════════════════════════════════════════
   MAIN RENDER
   ══════════════════════════════════════════ */

async function renderAdminMatches(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }
    container.innerHTML = '<div class="screen active"><div class="screen-content">' + showLoading() + '</div></div>';
    try {
        var isOrg = App.isOrganizer();
        var endpoints = isOrg
            ? ['tournaments/read.php?id=' + App.userTournamentId, 'matches/read.php?tournament_id=' + App.userTournamentId]
            : ['tournaments/read.php', 'matches/read.php'];
        var results = await Promise.all(endpoints.map(e => apiGet(e)));
        var tRes = results[0];
        var mRes = results[1];
        _mTournaments = Array.isArray(tRes) ? tRes : (tRes.data || []);
        _mMatches = Array.isArray(mRes) ? mRes : (mRes.data || []);

        _createForm = { tid: null, gid: null, homeId: null, awayId: null, date: '', time: '' };
        _selMatchId = null;
        _selMatch = null;
        _mGroups = [];
        _mTeams = [];

        var html = '<div class="screen active"><div class="screen-content">';
        html += '<h1 class="section-title" style="margin-bottom:16px">' + ' Gestione Partite</h1>';
        html += '<div style="height:2px;background:var(--color-primary);margin-bottom:16px"></div>';
        html += '<div id="matches-create-section"></div>';
        html += '<div id="matches-list-section"></div>';
        html += '</div></div>';
        container.innerHTML = html;

        renderCreateSection();
        renderMatchesSection();
        showFAB(function() { document.getElementById('matches-create-section').scrollIntoView({ behavior: 'smooth' }); });
    } catch (e) {
        container.innerHTML = '<div class="screen active"><div class="screen-content">' + showEmpty('soccer', 'Errore', 'Errore nel caricamento') + '</div></div>';
    }
}

/* ══════════════════════════════════════════
   SECTION 1: CREA NUOVA PARTITA
   ══════════════════════════════════════════ */

function renderCreateSection() {
    var el = document.getElementById('matches-create-section');
    if (!el) return;
    var c = _createForm;

    var html = '<div class="card" style="margin-bottom:20px">';
    html += '<div class="card-header"><h3>' + ' Crea Nuova Partita</h3></div>';
    html += '<div class="card-body">';

    /* ── Torneo chips ── */
    html += '<div class="form-label">Torneo</div>';
    html += '<div class="scroll-tabs" style="margin-bottom:16px">';
    _mTournaments.forEach(function(t) {
        var active = c.tid == t.id ? ' active' : '';
        html += '<div class="scroll-tab' + active + '" onclick="mToggleTournament(' + t.id + ')">' + escapeHtml(t.name) + '</div>';
    });
    html += '</div>';

    /* ── Girone chips (solo se ci sono gironi) ── */
    if (c.tid && _mGroups.length > 0) {
        html += '<div class="form-label">Girone</div>';
        html += '<div class="scroll-tabs" style="margin-bottom:16px">';
        _mGroups.forEach(function(g) {
            var active = (c.gid == g.id) ? ' active' : '';
            html += '<div class="scroll-tab' + active + '" onclick="mToggleGroup(' + g.id + ')">' + escapeHtml(g.name) + '</div>';
        });
        html += '</div>';
    } else if (c.tid && _mGroups.length === 0) {
        var isRR = _mTournaments.find(function(t) { return t.id == c.tid; });
        if (isRR && isRR.format === 'round_robin') {
            html += '<div style="font-size:12px;color:var(--color-success);margin-bottom:12px">' + icon('information', 14) + ' Formato Round Robin - le partite non richiedono gironi</div>';
        } else {
            html += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:12px">' + icon('information', 14) + ' Nessun girone configurato per questo torneo</div>';
        }
    }

    /* ── Genera Partite Round Robin ── */
    if (c.gid && _mTeams.length >= 2) {
        var matchCount = _mTeams.length * (_mTeams.length - 1) / 2;
        var groupObj = _mGroups.find(function(g) { return g.id == c.gid; });
        var groupName = groupObj ? groupObj.name : 'Girone';
        html += '<div style="margin-bottom:16px">';
        html += '<button class="btn btn-outline btn-block" onclick="mConfirmGenerateRoundRobin()" style="border-color:var(--color-primary);color:var(--color-primary)">';
        html += icon('zap', 16) + ' Genera ' + matchCount + ' Partite per ' + escapeHtml(groupName);
        html += '</button>';
        html += '</div>';
    }

    /* ── Squadra Casa chips ── */
    if (_mTeams.length > 0) {
        html += '<div class="form-label">Squadra Casa</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
        _mTeams.forEach(function(t) {
            var sel = (c.homeId == t.id);
            var st = 'padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid;transition:all 0.15s;';
            st += sel ? 'background:#059669;color:#fff;border-color:#059669;' : 'background:transparent;color:#059669;border-color:#059669;';
            html += '<div style="' + st + '" onclick="mToggleHome(' + t.id + ')">' + escapeHtml(t.name) + '</div>';
        });
        html += '</div>';

        /* ── Squadra Ospite chips ── */
        html += '<div class="form-label">Squadra Ospite</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">';
        _mTeams.forEach(function(t) {
            var sel = (c.awayId == t.id);
            var st = 'padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid;transition:all 0.15s;';
            st += sel ? 'background:#d97706;color:#fff;border-color:#d97706;' : 'background:transparent;color:#d97706;border-color:#d97706;';
            html += '<div style="' + st + '" onclick="mToggleAway(' + t.id + ')">' + escapeHtml(t.name) + '</div>';
        });
        html += '</div>';
    } else if (c.tid) {
        html += '<div style="font-size:12px;color:var(--color-error);margin-bottom:12px">' + icon('information', 14) + ' Nessuna squadra disponibile</div>';
    }

    /* ── Data (date picker modal) + Ora (time wheel modal) ── */
    html += '<div class="form-label">Data e Ora</div>';
    html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">';
    html += '<button class="btn btn-outline" onclick="openDatePickerModal()">' + icon('calendar', 16) + ' ' + (c.date || 'Seleziona Data') + '</button>';
    html += '<button class="btn btn-outline" onclick="openTimeWheelModal()">' + icon('clock', 16) + ' ' + (c.time || 'Seleziona Ora') + '</button>';
    html += '</div>';

    /* ── Validazione ── */
    var valid = mValidateCreate();
    if (valid !== true) {
        html += '<div style="font-size:12px;color:var(--color-warning);margin-bottom:12px">' + icon('information', 14) + ' ' + valid + '</div>';
    }

    /* ── Pulsante Crea ── */
    var disabled = valid !== true ? ' disabled' : '';
    html += '<button class="btn btn-primary btn-block"' + disabled + ' onclick="saveNewMatch()">' + icon('plus-circle', 16) + ' Crea Partita</button>';

    html += '</div></div>';
    el.innerHTML = html;
}

/* ── Toggle Torneo ── */
function mToggleTournament(tid) {
    if (_createForm.tid == tid) {
        _createForm.tid = null;
        _createForm.gid = null;
        _createForm.homeId = null;
        _createForm.awayId = null;
        _mGroups = [];
        _mTeams = [];
        renderCreateSection();
    } else {
        _createForm.tid = tid;
        _createForm.gid = null;
        _createForm.homeId = null;
        _createForm.awayId = null;
        loadGroupsAndTeams(tid);
    }
}

async function loadGroupsAndTeams(tid) {
    var gRes = await apiGet('groups/read.php?tournament_id=' + tid);
    _mGroups = Array.isArray(gRes) ? gRes : (gRes.data || []);

    var tRes = await apiGet('teams/read.php?tournament_id=' + tid);
    _mTeams = Array.isArray(tRes) ? tRes : (tRes.data || []);

    renderCreateSection();
}

/* ── Toggle Girone ── */
function mToggleGroup(gid) {
    if (_createForm.gid == gid) {
        _createForm.gid = null;
        _createForm.homeId = null;
        _createForm.awayId = null;
        /* Ricarica tutte le squadre del torneo */
        if (_createForm.tid) {
            apiGet('teams/read.php?tournament_id=' + _createForm.tid).then(function(res) {
                _mTeams = Array.isArray(res) ? res : (res.data || []);
                renderCreateSection();
            });
        }
    } else {
        _createForm.gid = gid;
        _createForm.homeId = null;
        _createForm.awayId = null;
        /* Carica solo squadre del girone */
        apiGet('groups/teams.php?group_id=' + gid).then(function(res) {
            _mTeams = Array.isArray(res) ? res : (res.data || []);
            renderCreateSection();
        });
    }
}

/* ── Toggle Squadre ── */
function mToggleHome(tid) {
    _createForm.homeId = (_createForm.homeId == tid) ? null : tid;
    renderCreateSection();
}

function mToggleAway(tid) {
    _createForm.awayId = (_createForm.awayId == tid) ? null : tid;
    renderCreateSection();
}

/* ── Validazione ── */
function mValidateCreate() {
    var c = _createForm;
    if (!c.tid) return 'Seleziona un torneo';
    if (_mGroups.length > 0 && !c.gid) return 'Seleziona un girone';
    if (_mTeams.length === 0) return 'Nessuna squadra disponibile';
    if (!c.homeId) return 'Seleziona la squadra casa';
    if (!c.awayId) return 'Seleziona la squadra ospite';
    if (c.homeId == c.awayId) return 'Le squadre devono essere diverse';
    if (!c.date) return 'Seleziona la data';
    if (!c.time) return 'Inserisci l\'ora';
    return true;
}

/* ── Salva Nuova Partita ── */
async function saveNewMatch() {
    var valid = mValidateCreate();
    if (valid !== true) { showToast(valid, 'error'); return; }
    var c = _createForm;
    try {
        var res = await apiPost('matches/create.php', {
            tournament_id: c.tid,
            group_id: c.gid || null,
            home_team_id: c.homeId,
            away_team_id: c.awayId,
            match_date: c.date + ' ' + c.time
        });
        if (res && res.success === false) {
            showToast(res.message || 'Errore nel salvataggio', 'error');
            return;
        }
        showToast('Partita creata', 'success');
        /* Mantieni torneo selezionato, resetta il resto */
        _createForm = { tid: c.tid, gid: null, homeId: null, awayId: null, date: '', time: '' };
        _selMatchId = null;
        _selMatch = null;
    } catch (e) { showToast(e.message || 'Errore nel salvataggio', 'error'); return; }
    /* Ricarica dati in blocco separato (la partita è già salvata) */
    try {
        var mEndpoint = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
        var mRes = await apiGet(mEndpoint);
        _mMatches = Array.isArray(mRes) ? mRes : (mRes.data || []);
        await loadGroupsAndTeams(c.tid);
        renderMatchesSection();
    } catch (e) { showToast('Partita salvata, impossibile aggiornare l\'elenco', 'warning'); renderMatchesSection(); }
}

/* ══════════════════════════════════════════
   SECTION 2: PARTITE PER TORNEO
   ══════════════════════════════════════════ */

function renderMatchesSection() {
    var el = document.getElementById('matches-list-section');
    if (!el) return;

    if (!_mMatches.length) {
        el.innerHTML = showEmpty('soccer', 'Nessuna partita', 'Nessuna partita trovata');
        return;
    }

    var grouped = {};
    _mMatches.forEach(function(m) {
        var tid = m.tournament_id;
        var gid = m.group_id || 'ko';
        if (!grouped[tid]) grouped[tid] = { name: getMTeamName(tid), groups: {} };
        if (!grouped[tid].groups[gid]) grouped[tid].groups[gid] = { name: m.group_name || 'Playoff/Finale', scheduled: [], finished: [] };
        if (m.status === 'finished') grouped[tid].groups[gid].finished.push(m);
        else grouped[tid].groups[gid].scheduled.push(m);
    });

    var html = '';
    var sorted = Object.keys(grouped).sort(function(a, b) {
        return grouped[a].name.localeCompare(grouped[b].name);
    });

    sorted.forEach(function(tid) {
        var sec = grouped[tid];
        var totalMatches = 0;
        Object.keys(sec.groups).forEach(function(gid) {
            totalMatches += sec.groups[gid].scheduled.length + sec.groups[gid].finished.length;
        });
        if (!totalMatches) return;

        html += '<div style="margin-bottom:24px">';
        html += '<div style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:2px solid var(--color-primary);margin-bottom:12px">';
        html += '<span style="font-size:15px;font-weight:700;color:var(--color-primary);text-transform:uppercase;letter-spacing:0.5px">' + escapeHtml(sec.name) + '</span>';
        html += '</div>';

        var groupKeys = Object.keys(sec.groups).sort(function(a, b) {
            if (a === 'ko') return 1;
            if (b === 'ko') return -1;
            return (sec.groups[a].name || '').localeCompare(sec.groups[b].name || '');
        });

        groupKeys.forEach(function(gid) {
            var grp = sec.groups[gid];
            if (!grp.scheduled.length && !grp.finished.length) return;

            var showAll = _mShowAll[tid + '_' + gid];
            var grpTotal = grp.scheduled.length + grp.finished.length;
            var limited = !showAll && grpTotal > 5;

            html += '<div style="margin-bottom:16px">';
            html += '<div class="match-group-header">';
            html += '<span style="font-size:13px;font-weight:600;color:var(--color-text);text-transform:uppercase">' + icon('google-circles', 14) + ' ' + escapeHtml(grp.name) + '</span>';
            html += '</div>';

            var visibleScheduled = limited ? grp.scheduled.slice(0, Math.max(0, 5 - grp.finished.length)) : grp.scheduled;
            var visibleFinished = limited ? grp.finished.slice(0, Math.max(0, 5 - visibleScheduled.length)) : grp.finished;
            var remaining = grpTotal - visibleScheduled.length - visibleFinished.length;

            if (visibleScheduled.length) {
                html += '<div style="font-size:11px;font-weight:600;color:var(--color-text-tertiary);margin-bottom:6px">' + icon('calendar', 12) + ' PIANIFICATE (' + grp.scheduled.length + ')</div>';
                visibleScheduled.forEach(function(m) { html += renderMScheduledCard(m); });
            }

            if (visibleFinished.length) {
                html += '<div style="font-size:11px;font-weight:600;color:var(--color-text-tertiary);margin-bottom:6px;margin-top:12px">' + icon('check-circle', 12) + ' TERMINATE (' + grp.finished.length + ')</div>';
                visibleFinished.forEach(function(m) { html += renderMFinishedCard(m); });
            }

            if (remaining > 0) {
                html += '<button class="btn btn-outline btn-block" style="margin-top:8px" onclick="mShowMoreGroup(\'' + tid + '_' + gid + '\')">' + icon('chevron-down', 16) + ' Mostra di più (' + remaining + ' rimanenti)</button>';
            }

            html += '</div>';
        });

        html += '</div>';
    });

    el.innerHTML = html;
}

function mShowMoreGroup(key) {
    _mShowAll[key] = true;
    renderMatchesSection();
}

function formatMatchDateTime(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split(' ');
    var d = parts[0] || '';
    var t = parts[1] || '';
    var dp = d.split('-');
    if (dp.length === 3) return dp[2] + '/' + dp[1] + '/' + dp[0] + (t ? ' ' + t : '');
    return dateStr;
}

function renderMScheduledCard(m) {
    var isKo = m.round && m.round !== 'girone';
    var sel = _selMatchId == m.id;
    var borderStyle = sel ? 'border:2px solid var(--color-primary);background:var(--color-primary-light);' : 'border-left: 4px solid var(--color-success)';
    var html = '<div class="match-card" style="' + borderStyle + 'margin-bottom:8px;cursor:pointer" onclick="selectMatchFor(' + m.id + ')">';

    html += '<div style="text-align:center;padding:8px 12px">';
    html += '<div style="font-weight:700;font-size:15px">' + escapeHtml(m.home_team || 'TBD') + ' vs ' + escapeHtml(m.away_team || 'TBD') + '</div>';
    html += '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">' + icon('calendar', 12) + ' Pianificata &middot; ' + formatMatchDateTime(m.match_date) + '</div>';

    if (isKo) {
        html += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">' + icon('lightning-bolt', 12) + ' ' + getMRound(m.round) + '</div>';
    } else if (m.group_name) {
        html += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">' + icon('google-circles', 12) + ' Girone ' + escapeHtml(m.group_name) + '</div>';
    }

    html += '<div style="display:flex;justify-content:center;gap:8px;margin-top:8px">';
    html += '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();openEditModal(' + m.id + ')">' + icon('pencil', 14) + ' Modifica</button>';
    html += '<button class="btn btn-sm btn-ghost" style="color:var(--color-error)" onclick="event.stopPropagation();deleteMatch(' + m.id + ')">' + icon('delete-outline', 14) + ' Elimina</button>';
    html += '</div></div></div>';
    return html;
}

function renderMFinishedCard(m) {
    var isKo = m.round && m.round !== 'girone';
    var html = '<div class="match-card" style="opacity:0.85;border-left: 4px solid var(--color-border);margin-bottom:8px">';

    html += '<div style="text-align:center;padding:8px 12px">';
    html += '<div style="font-weight:700;font-size:15px">' + escapeHtml(m.home_team || 'TBD') + ' vs ' + escapeHtml(m.away_team || 'TBD') + '</div>';
    html += '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">' + icon('check-circle', 12) + ' Terminata &middot; ' + m.home_score + ' - ' + m.away_score + '</div>';

    var info = [];
    if (isKo) {
        info.push(icon('lightning-bolt', 12) + ' ' + getMRound(m.round));
        if (m.home_extra_time !== null && m.away_extra_time !== null) info.push('ET: ' + m.home_extra_time + '-' + m.away_extra_time);
        if (m.home_penalties !== null && m.away_penalties !== null) info.push('Rig: ' + m.home_penalties + '-' + m.away_penalties);
    } else if (m.group_name) {
        info.push('Girone ' + escapeHtml(m.group_name));
    }
    if (info.length) html += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">' + info.join(' &middot; ') + '</div>';

    html += '<div style="display:flex;justify-content:center;gap:8px;margin-top:8px">';
    html += '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();openEditResultModal(' + m.id + ')">' + icon('pencil', 14) + ' Modifica</button>';
    html += '<button class="btn btn-sm btn-ghost" style="color:var(--color-error)" onclick="deleteMatch(' + m.id + ')">' + icon('delete-outline', 14) + ' Elimina</button>';
    html += '<button class="btn btn-sm btn-outline" onclick="openStatsModal(' + m.id + ')">' + icon('chart', 14) + ' Statistiche</button>';
    html += '</div></div></div>';
    return html;
}

function selectMatchFor(matchId) {
    if (_selMatchId == matchId) {
        _selMatchId = null;
        _selMatch = null;
    } else {
        _selMatchId = matchId;
        _selMatch = _mMatches.find(function(m) { return m.id == matchId; }) || null;
    }
    renderMatchesSection();
    renderResultSection();
}

function getMTeamName(id) {
    var t = _mTournaments.find(function(tc) { return tc.id == id; });
    return t ? escapeHtml(t.name) : 'Torneo ' + id;
}

function getMRound(r) {
    var l = { girone: 'Girone', ottavi: 'Ottavi', quarti: 'Quarti', semifinale: 'Semifinale', finale: 'Finale', terzo_posto: '3° Posto' };
    return l[r] || r;
}

/* ══════════════════════════════════════════
   SECTION 3: INSERISCI RISULTATO
   ══════════════════════════════════════════ */

function renderResultSection() {
    var existing = document.getElementById('matches-result-section');
    if (existing) existing.remove();

    if (!_selMatchId || !_selMatch) return;
    var m = _selMatch;
    var isKo = m.round && m.round !== 'girone';

    var container = document.querySelector('.screen-content');
    if (!container) return;

    var html = '<div id="matches-result-section" class="card" style="margin-bottom:20px;border:2px solid var(--color-primary)">';
    html += '<div class="card-header"><h3>' + icon('flag-checkered', 18) + ' Inserisci Risultato</h3></div>';
    html += '<div class="card-body">';

    html += '<div style="font-size:13px;font-weight:600;color:var(--color-primary);margin-bottom:12px">' + icon('information', 14) + ' Partita selezionata: #' + m.id + '</div>';

    html += '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px">';
    html += '<span style="flex:1;text-align:right;font-weight:600;font-size:14px">' + escapeHtml(m.home_team || 'Casa') + '</span>';
    html += '<input type="number" id="res-home-score" min="0" value="0" style="width:60px;text-align:center;font-size:22px;font-weight:700;padding:8px;border:1.5px solid var(--color-border);border-radius:8px">';
    html += '<span style="font-size:20px;font-weight:800;color:var(--color-text-tertiary)">-</span>';
    html += '<input type="number" id="res-away-score" min="0" value="0" style="width:60px;text-align:center;font-size:22px;font-weight:700;padding:8px;border:1.5px solid var(--color-border);border-radius:8px">';
    html += '<span style="flex:1;text-align:left;font-weight:600;font-size:14px">' + escapeHtml(m.away_team || 'Ospite') + '</span>';
    html += '</div>';

    if (isKo) {
        html += '<div style="border-top:1px solid var(--color-border-light);padding-top:12px;margin-bottom:12px">';
        html += '<div style="font-size:12px;font-weight:600;color:var(--color-text-tertiary);margin-bottom:8px">' + icon('lightning-bolt', 12) + ' ' + getMRound(m.round) + '</div>';
        html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
        html += '<div style="flex:1"><div class="form-label">ET Casa</div><input type="number" id="res-home-et" min="0" class="form-input" placeholder="-"></div>';
        html += '<div style="flex:1"><div class="form-label">ET Ospite</div><input type="number" id="res-away-et" min="0" class="form-input" placeholder="-"></div>';
        html += '</div>';
        html += '<div style="display:flex;gap:8px">';
        html += '<div style="flex:1"><div class="form-label">Rigori Casa</div><input type="number" id="res-home-pens" min="0" class="form-input" placeholder="-"></div>';
        html += '<div style="flex:1"><div class="form-label">Rigori Ospite</div><input type="number" id="res-away-pens" min="0" class="form-input" placeholder="-"></div>';
        html += '</div></div>';
    }

    html += '<button class="btn btn-success btn-block" style="margin-top:8px" onclick="saveFinishStep1()">' + ' Termina Partita</button>';
    html += '</div></div>';

    container.appendChild(document.createRange().createContextualFragment(html));
    document.getElementById('matches-result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveFinishStep1() {
    var m = _selMatch;
    if (!m) return;

    var data = {
        match_id: m.id,
        home_score: parseInt(document.getElementById('res-home-score').value) || 0,
        away_score: parseInt(document.getElementById('res-away-score').value) || 0
    };

    var isKo = m.round && m.round !== 'girone';
    if (isKo) {
        var he = document.getElementById('res-home-et').value;
        var ae = document.getElementById('res-away-et').value;
        var hp = document.getElementById('res-home-pens').value;
        var ap = document.getElementById('res-away-pens').value;
        if (he !== '' && ae !== '') { data.home_extra_time = parseInt(he); data.away_extra_time = parseInt(ae); }
        if (hp !== '' && ap !== '') { data.home_penalties = parseInt(hp); data.away_penalties = parseInt(ap); }
    }

    try {
        var res = await apiPut('matches/finish.php', data);
        m.home_score = data.home_score;
        m.away_score = data.away_score;
        m.status = 'finished';
        if (isKo) {
            m.home_extra_time = data.home_extra_time !== undefined ? data.home_extra_time : null;
            m.away_extra_time = data.away_extra_time !== undefined ? data.away_extra_time : null;
            m.home_penalties = data.home_penalties !== undefined ? data.home_penalties : null;
            m.away_penalties = data.away_penalties !== undefined ? data.away_penalties : null;
        }
        openStatsModal(m.id, res);
    } catch (e) { showToast('Errore nel salvataggio', 'error'); }
}

/* ══════════════════════════════════════════
   MODAL 1: MODIFICA PARTITA
   ══════════════════════════════════════════ */

async function openEditModal(matchId) {
    var m = _mMatches.find(function(mt) { return mt.id == matchId; });
    if (!m) return;

    var teamsRes = await apiGet('teams/read.php?tournament_id=' + m.tournament_id);
    var tList = Array.isArray(teamsRes) ? teamsRes : (teamsRes.data || []);

    var mDate = new Date(m.match_date);
    var initDate = m.match_date.split(' ')[0];
    var initTime = String(mDate.getHours()).padStart(2, '0') + ':' + String(mDate.getMinutes()).padStart(2, '0');

    var body = '';

    /* Squadra Casa */
    body += '<div class="form-label">Squadra Casa</div>';
    body += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
    tList.forEach(function(t) {
        var sel = (m.home_team_id == t.id);
        var st = 'padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid;transition:all 0.15s;';
        st += sel ? 'background:#059669;color:#fff;border-color:#059669;' : 'background:transparent;color:#059669;border-color:#059669;';
        body += '<div style="' + st + '" id="edit-home-' + t.id + '" onclick="mEditSelectTeam(\'home\',' + t.id + ')">' + escapeHtml(t.name) + '</div>';
    });
    body += '</div>';

    /* Squadra Ospite */
    body += '<div class="form-label">Squadra Ospite</div>';
    body += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">';
    tList.forEach(function(t) {
        var sel = (m.away_team_id == t.id);
        var st = 'padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid;transition:all 0.15s;';
        st += sel ? 'background:#d97706;color:#fff;border-color:#d97706;' : 'background:transparent;color:#d97706;border-color:#d97706;';
        body += '<div style="' + st + '" id="edit-away-' + t.id + '" onclick="mEditSelectTeam(\'away\',' + t.id + ')">' + escapeHtml(t.name) + '</div>';
    });
    body += '</div>';

    /* Data + Ora */
    body += '<div class="form-label">Data e Ora</div>';
    body += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">';
    body += '<button class="btn btn-outline" id="edit-date-btn" onclick="openDatePickerModal(\'edit\')">' + icon('calendar', 16) + ' ' + initDate + '</button>';
    body += '<button class="btn btn-outline" id="edit-time-btn" onclick="openTimeWheelModal(\'edit\')">' + icon('clock', 16) + ' ' + initTime + '</button>';
    body += '</div>';

    window._editMatchState = {
        id: matchId,
        tid: m.tournament_id,
        homeId: m.home_team_id,
        awayId: m.away_team_id,
        date: initDate,
        time: initTime
    };

    showModal('Modifica Partita', body,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button>' +
        '<button class="btn btn-primary" onclick="saveEditMatch(' + matchId + ')">' + ' Salva</button>');
}

function mEditSelectTeam(side, tid) {
    var s = window._editMatchState;
    if (!s) return;
    if (side === 'home') {
        s.homeId = (s.homeId == tid) ? null : tid;
    } else {
        s.awayId = (s.awayId == tid) ? null : tid;
    }
    var prefix = 'edit-' + side + '-';
    document.querySelectorAll('[id^="' + prefix + '"]').forEach(function(el) {
        var id = parseInt(el.id.replace(prefix, ''));
        var sel = (side === 'home') ? (s.homeId == id) : (s.awayId == id);
        var color = (side === 'home') ? '#059669' : '#d97706';
        el.style.background = sel ? color : 'transparent';
        el.style.color = sel ? '#fff' : color;
    });
}

async function saveEditMatch(matchId) {
    var s = window._editMatchState;
    if (!s) return;
    if (!s.homeId || !s.awayId) { showToast('Seleziona entrambe le squadre', 'error'); return; }
    if (s.homeId == s.awayId) { showToast('Le squadre devono essere diverse', 'error'); return; }
    if (!s.time) { showToast('Inserisci l\'ora', 'error'); return; }

    try {
        var res = await apiPut('matches/update.php', {
            match_id: matchId,
            tournament_id: s.tid,
            home_team_id: s.homeId,
            away_team_id: s.awayId,
            match_date: s.date + ' ' + s.time
        });
        if (res && res.success === false) {
            showToast(res.message || 'Errore nel salvataggio', 'error');
            return;
        }
        closeModal();
        showToast('Partita aggiornata', 'success');
    } catch (e) { showToast(e.message || 'Errore nel salvataggio', 'error'); return; }
    try {
        var mEndpoint = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
        var mRes = await apiGet(mEndpoint);
        _mMatches = Array.isArray(mRes) ? mRes : (mRes.data || []);
        _selMatchId = null;
        _selMatch = null;
        renderMatchesSection();
        renderResultSection();
    } catch (e) { showToast('Partita salvata, impossibile aggiornare l\'elenco', 'warning'); renderMatchesSection(); }
}

/* ══════════════════════════════════════════
   MODAL 1B: MODIFICA RISULTATO PARTITA TERMINATA
   ══════════════════════════════════════════ */

async function openEditResultModal(matchId) {
    var m = _mMatches.find(function(mt) { return mt.id == matchId; });
    if (!m) return;

    var isKo = m.round && m.round !== 'girone';

    var body = '';
    body += '<div style="font-size:13px;font-weight:600;color:var(--color-primary);margin-bottom:12px">' + icon('information', 14) + ' Modifica il risultato di questa partita</div>';

    /* Teams display */
    body += '<div style="text-align:center;margin-bottom:16px">';
    body += '<div style="font-weight:700;font-size:14px">' + escapeHtml(m.home_team || 'TBD') + ' vs ' + escapeHtml(m.away_team || 'TBD') + '</div>';
    if (isKo) {
        body += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">' + icon('lightning-bolt', 12) + ' ' + getMRound(m.round) + '</div>';
    } else if (m.group_name) {
        body += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">' + icon('google-circles', 12) + ' Girone ' + escapeHtml(m.group_name) + '</div>';
    }
    body += '</div>';

    /* Score inputs */
    body += '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px">';
    body += '<span style="flex:1;text-align:right;font-weight:600;font-size:13px">' + escapeHtml(m.home_team || 'Casa') + '</span>';
    body += '<input type="number" id="edit-res-home-score" min="0" value="' + (m.home_score || 0) + '" style="width:60px;text-align:center;font-size:22px;font-weight:700;padding:8px;border:1.5px solid var(--color-border);border-radius:8px">';
    body += '<span style="font-size:20px;font-weight:800;color:var(--color-text-tertiary)">-</span>';
    body += '<input type="number" id="edit-res-away-score" min="0" value="' + (m.away_score || 0) + '" style="width:60px;text-align:center;font-size:22px;font-weight:700;padding:8px;border:1.5px solid var(--color-border);border-radius:8px">';
    body += '<span style="flex:1;text-align:left;font-weight:600;font-size:13px">' + escapeHtml(m.away_team || 'Ospite') + '</span>';
    body += '</div>';

    /* KO: Extra time + Penalties */
    if (isKo) {
        body += '<div style="border-top:1px solid var(--color-border-light);padding-top:12px;margin-bottom:12px">';
        body += '<div style="font-size:12px;font-weight:600;color:var(--color-text-tertiary);margin-bottom:8px">' + icon('lightning-bolt', 12) + ' ' + getMRound(m.round) + '</div>';
        body += '<div style="display:flex;gap:8px;margin-bottom:8px">';
        body += '<div style="flex:1"><div class="form-label">ET Casa</div><input type="number" id="edit-res-home-et" min="0" class="form-input" value="' + (m.home_extra_time != null ? m.home_extra_time : '') + '" placeholder="-"></div>';
        body += '<div style="flex:1"><div class="form-label">ET Ospite</div><input type="number" id="edit-res-away-et" min="0" class="form-input" value="' + (m.away_extra_time != null ? m.away_extra_time : '') + '" placeholder="-"></div>';
        body += '</div>';
        body += '<div style="display:flex;gap:8px">';
        body += '<div style="flex:1"><div class="form-label">Rigori Casa</div><input type="number" id="edit-res-home-pens" min="0" class="form-input" value="' + (m.home_penalties != null ? m.home_penalties : '') + '" placeholder="-"></div>';
        body += '<div style="flex:1"><div class="form-label">Rigori Ospite</div><input type="number" id="edit-res-away-pens" min="0" class="form-input" value="' + (m.away_penalties != null ? m.away_penalties : '') + '" placeholder="-"></div>';
        body += '</div></div>';
    }

    window._editResultMatchId = matchId;

    showModal('Modifica Risultato', body,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button>' +
        '<button class="btn btn-primary" onclick="saveEditResult()">' + icon('check', 16) + ' Salva</button>');
}

async function saveEditResult() {
    var matchId = window._editResultMatchId;
    if (!matchId) return;

    var m = _mMatches.find(function(mt) { return mt.id == matchId; });
    if (!m) return;

    var isKo = m.round && m.round !== 'girone';

    var payload = {
        match_id: matchId,
        home_score: parseInt(document.getElementById('edit-res-home-score').value) || 0,
        away_score: parseInt(document.getElementById('edit-res-away-score').value) || 0
    };

    if (isKo) {
        var he = document.getElementById('edit-res-home-et').value;
        var ae = document.getElementById('edit-res-away-et').value;
        var hp = document.getElementById('edit-res-home-pens').value;
        var ap = document.getElementById('edit-res-away-pens').value;
        if (he !== '' && ae !== '') { payload.home_extra_time = parseInt(he); payload.away_extra_time = parseInt(ae); }
        if (hp !== '' && ap !== '') { payload.home_penalties = parseInt(hp); payload.away_penalties = parseInt(ap); }
    }

    try {
        var res = await apiPut('matches/update_result.php', payload);
        if (res && res.success === false) {
            showToast(res.message || 'Errore nel salvataggio', 'error');
            return;
        }
        closeModal();
        showToast('Risultato aggiornato', 'success');
    } catch (e) { showToast(e.message || 'Errore nel salvataggio', 'error'); return; }

    try {
        var mEndpoint = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
        var mRes = await apiGet(mEndpoint);
        _mMatches = Array.isArray(mRes) ? mRes : (mRes.data || []);
        _selMatchId = null;
        _selMatch = null;
        renderMatchesSection();
        renderResultSection();
    } catch (e) { showToast('Risultato salvato, impossibile aggiornare l\'elenco', 'warning'); renderMatchesSection(); }
}

/* ══════════════════════════════════════════
   MODAL 2: STATISTICHE GIOCATORI
   (usa stats/player_stats.php?match_id=X)
   ══════════════════════════════════════════ */

async function openStatsModal(matchId, finishResult) {
    var m = _mMatches.find(function(mt) { return mt.id == matchId; });
    if (!m) {
        var mEndpoint = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
        var mRes = await apiGet(mEndpoint);
        var mList = Array.isArray(mRes) ? mRes : (mRes.data || []);
        m = mList.find(function(mt) { return mt.id == matchId; });
    }
    if (!m) return;

    /* Carica SOLO i giocatori di questa partita (match_players) */
    var statsRes = await apiGet('stats/player_stats.php?match_id=' + matchId);
    var players = Array.isArray(statsRes) ? statsRes : (statsRes.data || []);

    /* Separa per squadra */
    var homePlayers = players.filter(function(p) { return p.team_name === m.home_team; });
    var awayPlayers = players.filter(function(p) { return p.team_name === m.away_team; });

    /* Se non ci sono match_players (partita appena terminata), mostra tutti i giocatori delle squadre */
    if (homePlayers.length === 0 && awayPlayers.length === 0) {
        var hpRes = await apiGet('players/read.php?team_id=' + m.home_team_id);
        var apRes = await apiGet('players/read.php?team_id=' + m.away_team_id);
        homePlayers = (Array.isArray(hpRes) ? hpRes : (hpRes.data || [])).map(function(p) {
            return { id: p.id, first_name: p.first_name, last_name: p.last_name, team_name: m.home_team, gol: 0, assist: 0 };
        });
        awayPlayers = (Array.isArray(apRes) ? apRes : (apRes.data || [])).map(function(p) {
            return { id: p.id, first_name: p.first_name, last_name: p.last_name, team_name: m.away_team, gol: 0, assist: 0 };
        });
    }

    var body = '';

    /* Squadra Casa */
    body += '<div style="font-weight:600;font-size:13px;color:var(--color-primary);margin-bottom:8px">' + icon('account-multiple', 14) + ' ' + escapeHtml(m.home_team || 'Casa') + ' (' + homePlayers.length + ')</div>';
    homePlayers.forEach(function(p) {
        body += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px" data-team="home">';
        body += '<span style="flex:1;font-weight:500;font-size:13px">' + escapeHtml(p.first_name || '') + ' ' + escapeHtml(p.last_name || '') + '</span>';
        body += '<input type="number" min="0" value="' + (p.gol || 0) + '" class="form-input" style="width:50px;text-align:center;padding:4px;font-size:12px" data-pid="' + p.id + '" data-field="goals">';
        body += '<span style="font-size:10px;color:var(--color-text-tertiary);font-weight:600">G</span>';
        body += '<input type="number" min="0" value="' + (p.assist || 0) + '" class="form-input" style="width:50px;text-align:center;padding:4px;font-size:12px" data-pid="' + p.id + '" data-field="assists">';
        body += '<span style="font-size:10px;color:var(--color-text-tertiary);font-weight:600">A</span>';
        body += '</div>';
    });

    /* Squadra Ospite */
    body += '<div style="font-weight:600;font-size:13px;color:var(--color-error);margin:12px 0 8px">' + icon('account-multiple', 14) + ' ' + escapeHtml(m.away_team || 'Ospite') + ' (' + awayPlayers.length + ')</div>';
    awayPlayers.forEach(function(p) {
        body += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px" data-team="away">';
        body += '<span style="flex:1;font-weight:500;font-size:13px">' + escapeHtml(p.first_name || '') + ' ' + escapeHtml(p.last_name || '') + '</span>';
        body += '<input type="number" min="0" value="' + (p.gol || 0) + '" class="form-input" style="width:50px;text-align:center;padding:4px;font-size:12px" data-pid="' + p.id + '" data-field="goals">';
        body += '<span style="font-size:10px;color:var(--color-text-tertiary);font-weight:600">G</span>';
        body += '<input type="number" min="0" value="' + (p.assist || 0) + '" class="form-input" style="width:50px;text-align:center;padding:4px;font-size:12px" data-pid="' + p.id + '" data-field="assists">';
        body += '<span style="font-size:10px;color:var(--color-text-tertiary);font-weight:600">A</span>';
        body += '</div>';
    });

    window._statsFinishResult = finishResult || null;
    window._statsMatch = m;

    showModal('Statistiche Giocatori', body,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button>' +
        '<button class="btn btn-primary" onclick="savePlayerStats(' + matchId + ')">' + ' Salva</button>');
}

async function savePlayerStats(matchId) {
    var inputs = document.querySelectorAll('.modal-body input[data-pid]');
    var players = {};
    inputs.forEach(function(inp) {
        var pid = inp.dataset.pid;
        if (!players[pid]) players[pid] = { player_id: parseInt(pid), goals: 0, assists: 0 };
        players[pid][inp.dataset.field] = parseInt(inp.value) || 0;
    });

    var m = window._statsMatch;
    if (m) {
        var playerArr = Object.values(players);
        var homeGoalsSum = 0;
        var awayGoalsSum = 0;
        playerArr.forEach(function(p) {
            var el = document.querySelector('input[data-pid="' + p.player_id + '"][data-field="goals"]');
            if (!el) return;
            var row = el.closest('[data-team]');
            var team = row ? row.dataset.team : null;
            if (team === 'home') homeGoalsSum += p.goals;
            else if (team === 'away') awayGoalsSum += p.goals;
        });

        var homeScore = parseInt(m.home_score) || 0;
        var awayScore = parseInt(m.away_score) || 0;
        if (m.home_extra_time !== undefined && m.home_extra_time !== null && m.away_extra_time !== undefined && m.away_extra_time !== null) {
            homeScore += parseInt(m.home_extra_time) || 0;
            awayScore += parseInt(m.away_extra_time) || 0;
        }
        if (homeGoalsSum !== homeScore) {
            showToast('Gol casa (' + homeGoalsSum + ') non corrispondono al risultato (' + homeScore + ')', 'error');
            return;
        }
        if (awayGoalsSum !== awayScore) {
            showToast('Gol fuori (' + awayGoalsSum + ') non corrispondono al risultato (' + awayScore + ')', 'error');
            return;
        }
    }

    try {
        await apiPut('matches/update_player_stats.php', { match_id: matchId, players: Object.values(players) });
        closeModal();
        showToast('Partita conclusa', 'success');
        var fr = window._statsFinishResult;
        if (fr && fr.advanced) {
            showToast(fr.advanced.winner + ' avanzato a ' + getMRound(fr.advanced.next_round), 'info');
        }
        var mEndpoint = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
        var mRes = await apiGet(mEndpoint);
        _mMatches = Array.isArray(mRes) ? mRes : (mRes.data || []);
        _selMatchId = null;
        _selMatch = null;
        renderMatchesSection();
        renderResultSection();
    } catch (e) { showToast('Errore nel salvataggio', 'error'); }
}

/* ══════════════════════════════════════════
   MODAL 3: DATE PICKER (Calendario)
   ══════════════════════════════════════════ */

function openDatePickerModal(mode) {
    window._dpMode = mode || 'create';
    var now = new Date();
    var src = window._dpMode === 'edit' ? window._editMatchState : _createForm;
    var initDate = (src && src.date) ? src.date : now.toISOString().slice(0, 10);
    var parts = initDate.split('-');
    _cal = { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1, sel: initDate };

    var body = '<div id="dp-calendar"></div>';
    showModal('Seleziona Data', body,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button>' +
        '<button class="btn btn-primary" onclick="dpConfirm()">' + icon('check', 16) + ' Conferma</button>');

    setTimeout(function() { renderDPCalendar(); }, 50);
}

function renderDPCalendar() {
    var s = _cal;
    var today = new Date();
    var firstDay = new Date(s.year, s.month, 1);
    var lastDay = new Date(s.year, s.month + 1, 0);
    var startDow = firstDay.getDay();
    var daysInMonth = lastDay.getDate();
    var prevLast = new Date(s.year, s.month, 0).getDate();
    var mn = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

    var h = '<div style="text-align:center">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    h += '<button class="btn btn-sm btn-ghost" onclick="dpNav(-1)" style="font-size:20px;padding:4px 12px">&#8249;</button>';
    h += '<span style="font-weight:700;font-size:15px">' + mn[s.month] + ' ' + s.year + '</span>';
    h += '<button class="btn btn-sm btn-ghost" onclick="dpNav(1)" style="font-size:20px;padding:4px 12px">&#8250;</button>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">';
    ['L','M','M','G','V','S','D'].forEach(function(d) {
        h += '<div style="text-align:center;font-size:11px;font-weight:700;color:var(--color-text-tertiary);padding:6px 0">' + d + '</div>';
    });
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">';
    for (var i = startDow - 1; i >= 0; i--) {
        h += '<div style="text-align:center;padding:10px 0;font-size:14px;border-radius:8px;color:var(--color-text-tertiary);opacity:0.3">' + (prevLast - i) + '</div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
        var ds = s.year + '-' + String(s.month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var isT = d === today.getDate() && s.month === today.getMonth() && s.year === today.getFullYear();
        var isS = ds === s.sel;
        var st = 'text-align:center;padding:10px 0;font-size:14px;border-radius:8px;cursor:pointer;font-weight:500;transition:all 0.15s;';
        if (isS) st += 'background:var(--color-primary);color:#fff;font-weight:700;';
        else if (isT) st += 'border:2px solid var(--color-primary);font-weight:700;';
        h += '<div style="' + st + '" onclick="dpSelect(\'' + ds + '\')">' + d + '</div>';
    }
    var rem = (startDow + daysInMonth) % 7 === 0 ? 0 : 7 - ((startDow + daysInMonth) % 7);
    for (var r = 1; r <= rem; r++) {
        h += '<div style="text-align:center;padding:10px 0;font-size:14px;border-radius:8px;color:var(--color-text-tertiary);opacity:0.3">' + r + '</div>';
    }
    h += '</div></div>';

    var el = document.getElementById('dp-calendar');
    if (el) el.innerHTML = h;
}

function dpNav(dir) {
    _cal.month += dir;
    if (_cal.month > 11) { _cal.month = 0; _cal.year++; }
    if (_cal.month < 0) { _cal.month = 11; _cal.year--; }
    renderDPCalendar();
}

function dpSelect(ds) {
    _cal.sel = ds;
    renderDPCalendar();
}

function dpConfirm() {
    if (!_cal.sel) return;
    if (window._dpMode === 'edit' && window._editMatchState) {
        window._editMatchState.date = _cal.sel;
        var btn = document.getElementById('edit-date-btn');
        if (btn) btn.innerHTML = icon('calendar', 16) + ' ' + _cal.sel;
    } else {
        _createForm.date = _cal.sel;
        renderCreateSection();
    }
    closeModal();
}

/* ══════════════════════════════════════════
   MODAL 4: TIME WHEEL (Ora)
   ══════════════════════════════════════════ */

function openTimeWheelModal(mode) {
    window._twMode = mode || 'create';
    var src = window._twMode === 'edit' ? window._editMatchState : _createForm;
    if (src && src.time) {
        var parts = src.time.split(':');
        _tw = { hour: parseInt(parts[0]) || 18, minute: parseInt(parts[1]) || 0 };
    } else {
        _tw = { hour: 18, minute: 0 };
    }

    var body = '<div id="tw-container"></div>';
    showModal('Seleziona Ora', body,
        '<button class="btn btn-outline" onclick="closeModal()">Annulla</button>' +
        '<button class="btn btn-primary" onclick="twConfirm()">' + icon('check', 16) + ' Conferma</button>');

    setTimeout(function() { renderTimeWheel(); }, 50);
}

function renderTimeWheel() {
    var h = '<div style="display:flex;gap:16px;justify-content:center;align-items:stretch">';

    /* Ore */
    h += '<div style="text-align:center">';
    h += '<div style="font-size:12px;font-weight:600;color:var(--color-text-tertiary);margin-bottom:8px">ORE</div>';
    h += '<div class="tw-container" id="tw-hours">';
    for (var hr = 0; hr <= 23; hr++) {
        var hs = String(hr).padStart(2, '0');
        var sel = hr === _tw.hour;
        var cls = 'tw-item' + (sel ? ' tw-selected' : '');
        h += '<div class="' + cls + '" onclick="twSelectHour(' + hr + ')">' + hs + '</div>';
    }
    h += '</div></div>';

    /* Separatore */
    h += '<div style="display:flex;align-items:center;font-size:24px;font-weight:800;color:var(--color-text-tertiary);padding-bottom:24px">:</div>';

    /* Minuti */
    h += '<div style="text-align:center">';
    h += '<div style="font-size:12px;font-weight:600;color:var(--color-text-tertiary);margin-bottom:8px">MINUTI</div>';
    h += '<div class="tw-container" id="tw-minutes">';
    for (var mn = 0; mn <= 59; mn++) {
        var ms = String(mn).padStart(2, '0');
        var sel = mn === _tw.minute;
        var cls = 'tw-item' + (sel ? ' tw-selected' : '');
        h += '<div class="' + cls + '" onclick="twSelectMinute(' + mn + ')">' + ms + '</div>';
    }
    h += '</div></div>';

    h += '</div>';

    var el = document.getElementById('tw-container');
    if (el) el.innerHTML = h;

    /* Scroll to selected items */
    setTimeout(function() {
        var hc = document.getElementById('tw-hours');
        var mc = document.getElementById('tw-minutes');
        if (hc) {
            var selH = hc.querySelector('.tw-selected');
            if (selH) selH.scrollIntoView({ block: 'center' });
        }
        if (mc) {
            var selM = mc.querySelector('.tw-selected');
            if (selM) selM.scrollIntoView({ block: 'center' });
        }
    }, 100);
}

function twSelectHour(hr) {
    _tw.hour = hr;
    renderTimeWheel();
    /* Scroll to selected */
    var hc = document.getElementById('tw-hours');
    if (hc) {
        var items = hc.querySelectorAll('.tw-item');
        if (items[hr]) items[hr].scrollIntoView({ block: 'center' });
    }
}

function twSelectMinute(mn) {
    _tw.minute = mn;
    renderTimeWheel();
    /* Scroll to selected */
    var mc = document.getElementById('tw-minutes');
    if (mc) {
        var items = mc.querySelectorAll('.tw-item');
        if (items[mn]) items[mn].scrollIntoView({ block: 'center' });
    }
}

function twConfirm() {
    var timeStr = String(_tw.hour).padStart(2, '0') + ':' + String(_tw.minute).padStart(2, '0');
    if (window._twMode === 'edit' && window._editMatchState) {
        window._editMatchState.time = timeStr;
        var btn = document.getElementById('edit-time-btn');
        if (btn) btn.innerHTML = icon('clock', 16) + ' ' + timeStr;
    } else {
        _createForm.time = timeStr;
        renderCreateSection();
    }
    closeModal();
}

/* ══════════════════════════════════════════
   GENERA PARTITE ROUND ROBIN
   ══════════════════════════════════════════ */

async function mConfirmGenerateRoundRobin() {
    var c = _createForm;
    var groupObj = _mGroups.find(function(g) { return g.id == c.gid; });
    var teamCount = _mTeams.length;
    var matchCount = teamCount * (teamCount - 1) / 2;

    var existingMatches = _mMatches.filter(function(m) { return m.group_id == c.gid; });

    var body = '<div style="text-align:center">';
    body += '<div style="font-size:48px;margin-bottom:12px">' + icon('zap', 48) + '</div>';
    body += '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Genera Partite Round Robin</div>';
    body += '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px">';
    body += 'Verranno create <strong>' + matchCount + ' partite</strong> per il girone <strong>' + escapeHtml(groupObj ? groupObj.name : '') + '</strong>';
    body += '<br>' + teamCount + ' squadre si affronteranno tutte contro tutte';
    body += '</div>';

    if (existingMatches.length > 0) {
        body += '<div style="font-size:12px;color:var(--color-warning);padding:8px 12px;background:rgba(217,119,6,0.1);border-radius:8px;margin-bottom:12px">';
        body += icon('warning', 14) + ' Esistono già ' + existingMatches.length + ' partite per questo girone. Verranno eliminate.';
        body += '</div>';
    }
    body += '</div>';

    var footer = '<button class="btn btn-outline" onclick="closeModal()">Annulla</button>';
    footer += '<button class="btn btn-primary" onclick="mGenerateRoundRobin(' + (existingMatches.length > 0) + ')">';
    footer += icon('zap', 16) + ' Genera ' + matchCount + ' Partite</button>';

    showModal('Conferma Generazione', body, footer);
}

async function mGenerateRoundRobin(force) {
    var c = _createForm;
    closeModal();

    showToast('Generazione partite in corso...', 'info');

    try {
        var payload = { group_id: c.gid };
        if (force) payload.force = 1;

        var res = await apiPost('groups/generate_round_robin.php', payload);
        showToast(res.message || 'Partite generate con successo', 'success');

        var mEndpoint = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
        var mRes = await apiGet(mEndpoint);
        _mMatches = Array.isArray(mRes) ? mRes : (mRes.data || []);
        renderMatchesSection();
    } catch (e) {
        var msg = e.message || 'Errore nella generazione';
        if (msg.includes('force=1')) {
            var forceConfirm = await confirmDialog('Sovrascrivere?', 'Esistono già partite per questo girone. Vuoi eliminarle e rigenerare?');
            if (forceConfirm) {
                try {
                    var res2 = await apiPost('groups/generate_round_robin.php', { group_id: c.gid, force: 1 });
                    showToast(res2.message || 'Partite rigenerate con successo', 'success');
                    var mEndpoint2 = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
                    var mRes2 = await apiGet(mEndpoint2);
                    _mMatches = Array.isArray(mRes2) ? mRes2 : (mRes2.data || []);
                    renderMatchesSection();
                } catch (e2) { showToast('Errore: ' + (e2.message || 'Errore nella generazione'), 'error'); }
            }
        } else {
            showToast('Errore: ' + msg, 'error');
        }
    }
}

/* ══════════════════════════════════════════
   DELETE
   ══════════════════════════════════════════ */

async function deleteMatch(id) {
    if (await confirmDialog('Elimina Partita', 'Sei sicuro di voler eliminare questa partita?')) {
        try {
            await apiDelete('matches/delete.php?id=' + id);
            showToast('Partita eliminata', 'success');
            if (_selMatchId == id) { _selMatchId = null; _selMatch = null; }
            var mEndpoint = App.isOrganizer() ? 'matches/read.php?tournament_id=' + App.userTournamentId : 'matches/read.php';
            var mRes = await apiGet(mEndpoint);
            _mMatches = Array.isArray(mRes) ? mRes : (mRes.data || []);
            renderMatchesSection();
            renderResultSection();
        } catch (e) { showToast('Errore nell\'eliminazione', 'error'); }
    }
}
