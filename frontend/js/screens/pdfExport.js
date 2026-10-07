/* ========== PDF EXPORT PAGE ========== */

var PDF_EXPORT = {
    tournaments: [],
    selectedTournament: null,
    exportType: null,
    loading: false
};

var PDF_HEADER_COLOR = '#FF6B2B';
var PDF_TODAY = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
});

function renderPdfExport(container) {
    PDF_EXPORT.selectedTournament = null;
    PDF_EXPORT.exportType = null;

    container.innerHTML =
        '<div class="screen active">' +
            '<div class="screen-header screen-header-admin">' +
                '<span>Esporta PDF</span>' +
            '</div>' +
            '<div class="screen-content">' +
                '<div class="pdf-export-wrap" id="pdf-export-content">' +
                    '<div class="pdf-loading" id="pdf-loading">' + showLoading() + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

    loadPdfExportTournaments();
}

async function loadPdfExportTournaments() {
    var el = document.getElementById('pdf-export-content');
    try {
        if (App.isOrganizer() && App.userTournamentId) {
            var res = await apiGet('tournaments/read_one.php?id=' + App.userTournamentId);
            var t = res.data || res;
            PDF_EXPORT.tournaments = Array.isArray(t) ? t : [t];
            PDF_EXPORT.selectedTournament = PDF_EXPORT.tournaments[0] || null;
        } else {
            var res = await apiGet('tournaments/read.php');
            PDF_EXPORT.tournaments = Array.isArray(res) ? res : (res.data || []);
        }
    } catch (e) {
        PDF_EXPORT.tournaments = [];
    }
    renderPdfExportForm();
}

function renderPdfExportForm() {
    var el = document.getElementById('pdf-export-content');
    if (!el) return;

    var tournaments = PDF_EXPORT.tournaments;
    var sel = PDF_EXPORT.selectedTournament;
    var expType = PDF_EXPORT.exportType;

    var html = '<div class="pdf-export-card">';

    html += '<div class="pdf-export-title">' + icon('file-pdf-box', 28) + '<div><h2>Esporta Report PDF</h2><p class="pdf-export-subtitle">' + (App.isOrganizer() ? 'Esporta i dati del tuo torneo' : 'Seleziona il torneo e il tipo di esportazione') + '</p></div></div>';

    /* Tournament selector */
    if (App.isOrganizer() && sel) {
        html += '<div class="pdf-section">';
        html += '<div class="pdf-section-label">Torneo</div>';
        html += '<div class="pdf-tournament-disabled">' + icon('trophy', 18) + '<span>' + escapeHtml(sel.name) + '</span></div>';
        html += '</div>';
    } else {
        html += '<div class="pdf-section">';
        html += '<div class="pdf-section-label">1. Scegli il Torneo</div>';
        html += '<select class="form-select pdf-tournament-select" id="pdf-tournament-select" onchange="onPdfTournamentChange(this.value)">';
        html += '<option value="">Seleziona un torneo...</option>';
        for (var i = 0; i < tournaments.length; i++) {
            var t = tournaments[i];
            var selected = (sel && sel.id == t.id) ? ' selected' : '';
            html += '<option value="' + t.id + '"' + selected + '>' + escapeHtml(t.name) + '</option>';
        }
        html += '</select>';
        html += '</div>';
    }

    /* Export type selector */
    html += '<div class="pdf-section">';
    html += '<div class="pdf-section-label">2. Tipo di Esportazione</div>';
    html += '<div class="pdf-type-grid">';

    var types = [
        { key: 'standings', icon: 'format-list-numbered', label: 'Classifica', desc: 'Classifiche aggiornate di tutti i gironi' },
        { key: 'stats', icon: 'chart', label: 'Statistiche', desc: 'Gol, assist, presenze dei giocatori' },
        { key: 'calendar', icon: 'calendar', label: 'Calendario', desc: 'Tutte le partite programmate e giocate' },
        { key: 'full', icon: 'flag-checkered', label: 'Tutto', desc: 'Report completo: classifica + statistiche + calendario' }
    ];

    for (var j = 0; j < types.length; j++) {
        var tp = types[j];
        var activeClass = (expType === tp.key) ? ' active' : '';
        var disabledClass = (!sel) ? ' disabled' : '';
        html += '<div class="pdf-type-card' + activeClass + disabledClass + '" onclick="onPdfTypeChange(\'' + tp.key + '\')">';
        html += '<div class="pdf-type-icon">' + icon(tp.icon, 28) + '</div>';
        html += '<div class="pdf-type-label">' + tp.label + '</div>';
        html += '<div class="pdf-type-desc">' + tp.desc + '</div>';
        html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    /* Export button */
    var btnDisabled = (!sel || !expType) ? ' disabled' : '';
    html += '<div class="pdf-section">';
    html += '<button class="btn btn-primary btn-lg pdf-export-btn"' + btnDisabled + ' onclick="generatePdfExport()">';
    html += icon('file-pdf-box', 20) + '<span>Genera PDF</span>';
    html += '</button>';
    html += '</div>';

    html += '</div>'; /* pdf-export-card */

    el.innerHTML = html;
}

function onPdfTournamentChange(val) {
    if (!val) {
        PDF_EXPORT.selectedTournament = null;
    } else {
        for (var i = 0; i < PDF_EXPORT.tournaments.length; i++) {
            if (PDF_EXPORT.tournaments[i].id == val) {
                PDF_EXPORT.selectedTournament = PDF_EXPORT.tournaments[i];
                break;
            }
        }
    }
    renderPdfExportForm();
}

function onPdfTypeChange(key) {
    if (!PDF_EXPORT.selectedTournament) return;
    PDF_EXPORT.exportType = key;
    renderPdfExportForm();
}

/* ══════════════════════════════════════════
   PDF GENERATION
   ══════════════════════════════════════════ */

function pdfBuildBaseStyles() {
    return '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #333; }' +
        'h1 { font-size: 22px; color: ' + PDF_HEADER_COLOR + '; margin-bottom: 4px; }' +
        'h2 { font-size: 16px; color: #333; margin: 18px 0 8px; border-bottom: 2px solid ' + PDF_HEADER_COLOR + '; padding-bottom: 4px; }' +
        'h3 { font-size: 13px; color: #555; margin: 12px 0 6px; }' +
        '.section-subtitle { font-size: 14px; color: ' + PDF_HEADER_COLOR + '; margin: 16px 0 8px; font-weight: 700; border-bottom: 1px solid ' + PDF_HEADER_COLOR + '; padding-bottom: 3px; }' +
        '.group-label { font-size: 12px; color: #555; margin: 10px 0 6px; font-weight: 600; }' +
        '.subtitle { font-size: 12px; color: #888; margin-bottom: 14px; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }' +
        'th { background: ' + PDF_HEADER_COLOR + '; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }' +
        'td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }' +
        'tr:nth-child(even) { background: #f8f9fb; }' +
        '.footer { margin-top: 20px; text-align: center; font-size: 10px; color: #aaa; }' +
        '.no-data { text-align: center; color: #bbb; padding: 20px; font-size: 13px; }' +
    '</style>';
}

function pdfBuildHeader(tournamentName) {
    return '<div style="text-align:center; margin-bottom:16px;">' +
        '<h1>Futsal Manager</h1>' +
        '<div class="subtitle">' + tournamentName + '</div>' +
    '</div>';
}

function pdfBuildFooter() {
    return '<div class="footer">Generato il ' + PDF_TODAY + ' - Futsal Manager</div>';
}

/* ── Classifica ── */
function pdfBuildStandingsHtml(standings, tournamentName) {
    var grouped = {};
    for (var i = 0; i < standings.length; i++) {
        var s = standings[i];
        var g = s.group_name || 'Generale';
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(s);
    }

    var tables = '';
    for (var groupName in grouped) {
        var rows = grouped[groupName];
        rows.sort(function(a, b) { return (b.punti || 0) - (a.punti || 0); });
        tables += '<h3>Girone ' + groupName + '</h3>';
        tables += '<table><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>P</th><th>S</th><th>DR</th><th>Pt</th></tr>';
        for (var j = 0; j < rows.length; j++) {
            var r = rows[j];
            var gp = (r.wins || 0) + (r.draws || 0) + (r.losses || 0);
            var diff = (r.goals_scored || 0) - (r.goals_conceded || 0);
            tables += '<tr><td>' + (j + 1) + '</td><td><strong>' + escapeHtml(r.name || '') + '</strong></td>';
            tables += '<td>' + gp + '</td><td>' + (r.wins || 0) + '</td><td>' + (r.draws || 0) + '</td>';
            tables += '<td>' + (r.losses || 0) + '</td><td>' + (diff > 0 ? '+' + diff : diff) + '</td>';
            tables += '<td><strong>' + (r.punti || 0) + '</strong></td></tr>';
        }
        tables += '</table>';
    }

    if (!tables) tables = '<div class="no-data">Nessuna classifica disponibile</div>';

    return '<html><head>' + pdfBuildBaseStyles() + '</head><body>' +
        pdfBuildHeader(tournamentName) +
        '<h2>Classifica</h2>' + tables +
        pdfBuildFooter() +
    '</body></html>';
}

/* ── Statistiche giocatori ── */
function pdfBuildStatsHtml(playerStats, tournamentName) {
    var sorted = playerStats.slice().sort(function(a, b) { return (parseInt(b.gol) || 0) - (parseInt(a.gol) || 0); });

    var rows = '';
    if (sorted.length > 0) {
        for (var i = 0; i < sorted.length; i++) {
            var p = sorted[i];
            rows += '<tr><td>' + (i + 1) + '</td>';
            rows += '<td><strong>' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</strong></td>';
            rows += '<td>' + escapeHtml(p.team_name || '') + '</td>';
            rows += '<td>' + (p.presenze != null ? p.presenze : 0) + '</td>';
            rows += '<td>' + (p.gol != null ? p.gol : 0) + '</td>';
            rows += '<td>' + (p.assist != null ? p.assist : 0) + '</td></tr>';
        }
    } else {
        rows = '<tr><td colspan="6" class="no-data">Nessuna statistica disponibile</td></tr>';
    }

    return '<html><head>' + pdfBuildBaseStyles() + '</head><body>' +
        pdfBuildHeader(tournamentName) +
        '<h2>Statistiche Giocatori</h2>' +
        '<table><tr><th>#</th><th>Giocatore</th><th>Squadra</th><th>Presenze</th><th>Gol</th><th>Assist</th></tr>' +
        rows + '</table>' +
        pdfBuildFooter() +
    '</body></html>';
}

/* ── Calendario partite ── */
var PDF_ROUND_LABELS = {
    ottavi: 'Ottavi di Finale',
    quarti: 'Quarti di Finale',
    semifinale: 'Semifinale',
    finale: 'Finale',
    terzo_posto: 'Terzo Posto'
};

var PDF_ROUND_ORDER = ['Ottavi di Finale', 'Quarti di Finale', 'Semifinale', 'Terzo Posto', 'Finale'];

function pdfBuildCalendarHtml(matches, tournamentName) {
    var groupMatches = {};
    var knockoutMatches = {};

    for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        if (m.round && m.round !== 'girone') {
            var label = PDF_ROUND_LABELS[m.round] || m.round;
            if (!knockoutMatches[label]) knockoutMatches[label] = [];
            knockoutMatches[label].push(m);
        } else {
            var g = m.group_name || 'Altre';
            if (!groupMatches[g]) groupMatches[g] = [];
            groupMatches[g].push(m);
        }
    }

    var tables = '';

    var groupKeys = Object.keys(groupMatches).sort();
    if (groupKeys.length > 0) {
        tables += '<h3 class="section-subtitle">Gironi</h3>';
        for (var gi = 0; gi < groupKeys.length; gi++) {
            var groupName = groupKeys[gi];
            var rows = groupMatches[groupName];
            rows.sort(function(a, b) { return new Date(a.match_date) - new Date(b.match_date); });
            tables += '<h3 class="group-label">Girone ' + groupName + '</h3>';
            tables += '<table><tr><th>Data</th><th>Casa</th><th></th><th>Ospite</th><th>Risultato</th></tr>';
            for (var k = 0; k < rows.length; k++) {
                var match = rows[k];
                var date = match.match_date ? new Date(match.match_date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                var score = match.status === 'finished' ? (match.home_score != null ? match.home_score : 0) + ' - ' + (match.away_score != null ? match.away_score : 0) : (match.status || 'Programmata');
                tables += '<tr><td>' + date + '</td><td><strong>' + escapeHtml(match.home_team || '') + '</strong></td>';
                tables += '<td>VS</td><td><strong>' + escapeHtml(match.away_team || '') + '</strong></td>';
                tables += '<td>' + score + '</td></tr>';
            }
            tables += '</table>';
        }
    }

    var koKeys = Object.keys(knockoutMatches);
    koKeys.sort(function(a, b) {
        var ia = PDF_ROUND_ORDER.indexOf(a);
        var ib = PDF_ROUND_ORDER.indexOf(b);
        return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
    });

    if (koKeys.length > 0) {
        tables += '<h3 class="section-subtitle">Eliminazione Diretta</h3>';
        for (var ki = 0; ki < koKeys.length; ki++) {
            var roundName = koKeys[ki];
            var koRows = knockoutMatches[roundName];
            koRows.sort(function(a, b) { return new Date(a.match_date) - new Date(b.match_date); });
            tables += '<h3 class="group-label">' + roundName + '</h3>';
            tables += '<table><tr><th>Data</th><th>Casa</th><th></th><th>Ospite</th><th>Risultato</th></tr>';
            for (var kr = 0; kr < koRows.length; kr++) {
                var km = koRows[kr];
                var kDate = km.match_date ? new Date(km.match_date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                var kScore = km.status === 'finished' ? (km.home_score != null ? km.home_score : 0) + ' - ' + (km.away_score != null ? km.away_score : 0) : (km.status || 'Programmata');
                tables += '<tr><td>' + kDate + '</td><td><strong>' + escapeHtml(km.home_team || '') + '</strong></td>';
                tables += '<td>VS</td><td><strong>' + escapeHtml(km.away_team || '') + '</strong></td>';
                tables += '<td>' + kScore + '</td></tr>';
            }
            tables += '</table>';
        }
    }

    if (!tables) tables = '<div class="no-data">Nessuna partita trovata</div>';

    return '<html><head>' + pdfBuildBaseStyles() + '</head><body>' +
        pdfBuildHeader(tournamentName) +
        '<h2>Calendario Partite</h2>' + tables +
        pdfBuildFooter() +
    '</body></html>';
}

/* ── Tutto ── */
function pdfBuildFullHtml(standings, playerStats, matches, tournamentName) {
    var grouped = {};
    for (var i = 0; i < standings.length; i++) {
        var s = standings[i];
        var g = s.group_name || 'Generale';
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(s);
    }

    var standingsTables = '';
    for (var gn in grouped) {
        var gRows = grouped[gn];
        gRows.sort(function(a, b) { return (b.punti || 0) - (a.punti || 0); });
        standingsTables += '<h3>Girone ' + gn + '</h3>';
        standingsTables += '<table><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>P</th><th>S</th><th>DR</th><th>Pt</th></tr>';
        for (var j = 0; j < gRows.length; j++) {
            var r = gRows[j];
            var gp = (r.wins || 0) + (r.draws || 0) + (r.losses || 0);
            var diff = (r.goals_scored || 0) - (r.goals_conceded || 0);
            standingsTables += '<tr><td>' + (j + 1) + '</td><td><strong>' + escapeHtml(r.name || '') + '</strong></td>';
            standingsTables += '<td>' + gp + '</td><td>' + (r.wins || 0) + '</td><td>' + (r.draws || 0) + '</td>';
            standingsTables += '<td>' + (r.losses || 0) + '</td><td>' + (diff > 0 ? '+' + diff : diff) + '</td>';
            standingsTables += '<td><strong>' + (r.punti || 0) + '</strong></td></tr>';
        }
        standingsTables += '</table>';
    }

    var statsSorted = playerStats.slice().sort(function(a, b) { return (parseInt(b.gol) || 0) - (parseInt(a.gol) || 0); });
    var statsRows = '';
    if (statsSorted.length > 0) {
        for (var si = 0; si < statsSorted.length; si++) {
            var p = statsSorted[si];
            statsRows += '<tr><td>' + (si + 1) + '</td><td><strong>' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</strong></td>';
            statsRows += '<td>' + escapeHtml(p.team_name || '') + '</td><td>' + (p.presenze != null ? p.presenze : 0) + '</td>';
            statsRows += '<td>' + (p.gol != null ? p.gol : 0) + '</td><td>' + (p.assist != null ? p.assist : 0) + '</td></tr>';
        }
    } else {
        statsRows = '<tr><td colspan="6" class="no-data">Nessuna statistica</td></tr>';
    }

    var groupMatches = {};
    var knockoutMatches = {};
    for (var mi = 0; mi < matches.length; mi++) {
        var m = matches[mi];
        if (m.round && m.round !== 'girone') {
            var label = PDF_ROUND_LABELS[m.round] || m.round;
            if (!knockoutMatches[label]) knockoutMatches[label] = [];
            knockoutMatches[label].push(m);
        } else {
            var mg = m.group_name || 'Altre';
            if (!groupMatches[mg]) groupMatches[mg] = [];
            groupMatches[mg].push(m);
        }
    }

    var matchTables = '';
    var mGroupKeys = Object.keys(groupMatches).sort();
    if (mGroupKeys.length > 0) {
        matchTables += '<h3 class="section-subtitle">Gironi</h3>';
        for (var mgi = 0; mgi < mGroupKeys.length; mgi++) {
            var mgn = mGroupKeys[mgi];
            var mRows = groupMatches[mgn];
            mRows.sort(function(a, b) { return new Date(a.match_date) - new Date(b.match_date); });
            matchTables += '<h3 class="group-label">Girone ' + mgn + '</h3>';
            matchTables += '<table><tr><th>Data</th><th>Casa</th><th></th><th>Ospite</th><th>Risultato</th></tr>';
            for (var mr = 0; mr < mRows.length; mr++) {
                var mm = mRows[mr];
                var mDate = mm.match_date ? new Date(mm.match_date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                var mScore = mm.status === 'finished' ? (mm.home_score != null ? mm.home_score : 0) + ' - ' + (mm.away_score != null ? mm.away_score : 0) : (mm.status || 'Programmata');
                matchTables += '<tr><td>' + mDate + '</td><td><strong>' + escapeHtml(mm.home_team || '') + '</strong></td>';
                matchTables += '<td>VS</td><td><strong>' + escapeHtml(mm.away_team || '') + '</strong></td>';
                matchTables += '<td>' + mScore + '</td></tr>';
            }
            matchTables += '</table>';
        }
    }

    var mKoKeys = Object.keys(knockoutMatches);
    mKoKeys.sort(function(a, b) {
        var ia = PDF_ROUND_ORDER.indexOf(a);
        var ib = PDF_ROUND_ORDER.indexOf(b);
        return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
    });

    if (mKoKeys.length > 0) {
        matchTables += '<h3 class="section-subtitle">Eliminazione Diretta</h3>';
        for (var mki = 0; mki < mKoKeys.length; mki++) {
            var mkn = mKoKeys[mki];
            var mKoRows = knockoutMatches[mkn];
            mKoRows.sort(function(a, b) { return new Date(a.match_date) - new Date(b.match_date); });
            matchTables += '<h3 class="group-label">' + mkn + '</h3>';
            matchTables += '<table><tr><th>Data</th><th>Casa</th><th></th><th>Ospite</th><th>Risultato</th></tr>';
            for (var mkj = 0; mkj < mKoRows.length; mkj++) {
                var mk = mKoRows[mkj];
                var mkDate = mk.match_date ? new Date(mk.match_date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                var mkScore = mk.status === 'finished' ? (mk.home_score != null ? mk.home_score : 0) + ' - ' + (mk.away_score != null ? mk.away_score : 0) : (mk.status || 'Programmata');
                matchTables += '<tr><td>' + mkDate + '</td><td><strong>' + escapeHtml(mk.home_team || '') + '</strong></td>';
                matchTables += '<td>VS</td><td><strong>' + escapeHtml(mk.away_team || '') + '</strong></td>';
                matchTables += '<td>' + mkScore + '</td></tr>';
            }
            matchTables += '</table>';
        }
    }

    return '<html><head>' + pdfBuildBaseStyles() + '</head><body>' +
        pdfBuildHeader(tournamentName) +
        '<h2>Classifica</h2>' + (standingsTables || '<div class="no-data">Nessuna classifica</div>') +
        '<h2>Statistiche Giocatori</h2>' +
        '<table><tr><th>#</th><th>Giocatore</th><th>Squadra</th><th>Presenze</th><th>Gol</th><th>Assist</th></tr>' +
        statsRows + '</table>' +
        '<h2>Calendario Partite</h2>' + (matchTables || '<div class="no-data">Nessuna partita</div>') +
        pdfBuildFooter() +
    '</body></html>';
}

/* ══════════════════════════════════════════
   MAIN EXPORT FUNCTION
   ══════════════════════════════════════════ */

async function generatePdfExport() {
    var sel = PDF_EXPORT.selectedTournament;
    var expType = PDF_EXPORT.exportType;
    if (!sel || !expType) return;

    var btn = document.querySelector('.pdf-export-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span><span>Generazione...</span>';
    }

    try {
        var tid = sel.id;
        var tName = sel.name;
        var html = '';

        if (expType === 'standings') {
            var standings = await pdfFetchStandings(tid);
            html = pdfBuildStandingsHtml(standings, tName);
        } else if (expType === 'stats') {
            var stats = await pdfFetchStats(tid);
            html = pdfBuildStatsHtml(stats, tName);
        } else if (expType === 'calendar') {
            var matches = await pdfFetchMatches(tid);
            html = pdfBuildCalendarHtml(matches, tName);
        } else {
            var results = await Promise.all([
                pdfFetchStandings(tid),
                pdfFetchStats(tid),
                pdfFetchMatches(tid)
            ]);
            html = pdfBuildFullHtml(results[0], results[1], results[2], tName);
        }

        pdfOpenPrintWindow(html);
        showToast('PDF generato con successo', 'success');
    } catch (e) {
        showToast('Errore nella generazione del PDF', 'error');
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = icon('file-pdf-box', 20) + '<span>Genera PDF</span>';
    }
}

function pdfOpenPrintWindow(html) {
    var w = window.open('', '_blank');
    if (!w) {
        showToast('Popup bloccato. Abilita i popup per questo sito.', 'warning');
        return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 500);
}

/* ── Fetch helpers ── */
async function pdfFetchStandings(tournamentId) {
    var res = await apiGet('groups/standings.php?tournament_id=' + tournamentId);
    return Array.isArray(res) ? res : (res.data || []);
}

async function pdfFetchStats(tournamentId) {
    var res = await apiGet('stats/player_stats.php?tournament_id=' + tournamentId);
    return Array.isArray(res) ? res : (res.data || []);
}

async function pdfFetchMatches(tournamentId) {
    var res = await apiGet('tournaments/matches.php?tournament_id=' + tournamentId);
    return Array.isArray(res) ? res : (res.data || []);
}
