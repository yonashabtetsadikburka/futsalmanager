/* ========== ADMIN MANUAL ========== */
async function renderAdminManual(container) {
    if (!App.isAdmin) { Router.navigate('/login'); return; }

    const steps = [
        {
            num: 1,
            title: 'Crea gli Allenatori',
            desc: 'Inizia creando gli allenatori. Inserisci Nome e Cognome.',
            route: '/admin/allenatori',
            color: '#be185d',
            icon: 'whistle'
        },
        {
            num: 2,
            title: 'Crea le Squadre',
            desc: 'Crea le squadre del torneo e assegna ad ognuna un allenatore. Compila i dettagli come nome squadra e logo(opzionale).',
            route: '/admin/squadre',
            color: '#6366f1',
            icon: 'shield'
        },
        {
            num: 3,
            title: 'Aggiungi i Giocatori',
            desc: 'Aggiungi i giocatori alle rispettive squadre. Ogni giocatore deve avere nome, cognome, eta, ruolo (Portiere, Difensore, Centrocampista, Attaccante) e seleziona la sua quadra.',
            route: '/admin/giocatori',
            color: '#0891b2',
            icon: 'account-multiple'
        },
        {
            num: 4,
            title: 'Crea i Gironi',
            desc: 'Crea i gironi del torneo e assegna le squadre ad ogni girone. Ogni girone deve avere almeno due squadre.',
            route: '/admin/gruppi',
            color: '#7c3aed',
            icon: 'medal'
        },
        {
            num: 5,
            title: 'Crea le Partite',
            desc: 'Crea manualmente le partite di ogni girone, inserendo squadra di casa, squadra fuori, data e orario. Completa le partite inserendo i risultati e le statistiche dei giocatori(Gol e Assist).',
            route: '/admin/partite',
            color: 'var(--color-warning)',
            icon: 'soccer-field'
        },
        {
            num: 6,
            title: 'Gestisci le Classifiche',
            desc: 'Le classifiche si aggiornano automaticamente con i risultati delle partite. Se necessario, puoi modificare i dati manualmente dalla pagina Classifiche.',
            route: '/admin/classifiche',
            color: 'var(--color-success)',
            icon: 'format-list-numbered'
        },
        {
            num: 7,
            title: 'Avvia la Fase a Eliminazione',
            desc: 'Dopo aver concluso le partite di girone, genera gli scontri diretti: quarti di finale, semifinale e finale.',
            route: '/admin/gruppi',
            color: '#ea580c',
            icon: 'medal'
        },
        {
            num: 8,
            title: 'Esporta il PDF',
            desc: 'Esporta il riepilogo parziale/completo del torneo in formato PDF con classifiche, risultati e statistiche.',
            route: '/admin/export-pdf',
            color: ' #ef4444',
            icon: 'file-pdf-box'
        }
    ];

    let html = '<div class="screen active">';
    html += '<div class="screen-header screen-header-admin">' + ' Manuale Organizzatore</div>';
    html += '<div class="screen-content">';

    html += '<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px;margin-bottom:24px">';
    html += '<p style="color:var(--color-text-secondary);font-size:14px;margin:0">Segui questi passaggi in ordine per organizzare il tuo torneo dall\'inizio alla fine.</p>';
    html += '</div>';

    steps.forEach(function(step) {
        const clickAttr = step.route ? ' onclick="Router.navigate(\'' + step.route + '\')"' : '';
        const cursorStyle = step.route ? 'cursor:pointer' : 'opacity:0.6';

        html += '<div class="manual-step" style="' + cursorStyle + ';border-left-color:' + step.color + '" ' + clickAttr + '>';
        html += '<div class="manual-step-header">';
        html += '<div class="manual-step-num" style="background:' + step.color + '">' + step.num + '</div>';
        html += '<div class="manual-step-title">' + step.title + '</div>';
        html += '</div>';
        html += '<div class="manual-step-desc">' + step.desc + '</div>';

        if (step.route) {
            html += '<div class="manual-step-link" style="color:' + step.color + '">Vai a ' + step.title.split(' ').pop() + ' ' + icon('arrow-right', 14) + '</div>';
        } else {
            html += '<div class="manual-step-badge">Prossimamente</div>';
        }

        html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;
    hideFAB();
}
