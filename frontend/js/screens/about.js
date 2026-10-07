/* ========== ABOUT SCREEN ========== */
async function renderAbout(container) {
    let html = '<div class="screen active">';
    html += '<div class="screen-header">';
    html += '<button class="back-btn" onclick="Router.back()">' + icon('arrow-left', 24) + '</button>';
    html += ' Chi Siamo</div>';
    html += '<div class="screen-content">';

    html += '<div style="text-align:center;margin-bottom:32px">';
    html += '<img src="assets/Fut.webp" class="about-logo" alt="Futsal Manager">';
    html += '<p style="font-size:14px;color:var(--color-text-secondary)">La piattaforma per gestire i tuoi tornei di calcetto</p>';
    html += '</div>';

    html += '<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:20px;margin-bottom:16px">';
    html += '<h2 style="font-size:18px;font-weight:700;margin-bottom:12px">La Nostra Storia</h2>';
    html += '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:12px">';
    html += 'Futsal Manager nasce dalla passione per il calcetto a 5. Abbiamo creato questa piattaforma per semplificare la gestione dei tornei amatoriali e professionali, offrendo agli organizzatori uno strumento completo e intuitivo.';
    html += '</p>';
    html += '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:12px">';
    html += 'Dalla creazione dei gironi all\'inserimento dei risultati, dalle statistiche dei giocatori alle classifiche in tempo reale: tutto quello che serve per gestire un torneo, in un unico posto.';
    html += '</p>';
    html += '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">';
    html += 'Il nostro obiettivo &egrave; rendere la gestione dei tornei semplice, veloce e divertente per tutti.';
    html += '</p>';
    html += '</div>';

    html += '<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:20px;margin-bottom:16px">';
    html += '<h2 style="font-size:18px;font-weight:700;margin-bottom:12px">Funzionalit&agrave;</h2>';
    html += '<div style="display:flex;flex-direction:column;gap:12px">';
    var features = [
        { icon: 'flag-checkered', text: 'Gestione completa dei tornei' },
        { icon: 'shield-account', text: 'Squadre e giocatori' },
        { icon: 'soccer-field', text: 'Partite con risultati in tempo reale' },
        { icon: 'medal', text: 'Classifiche e statistiche' },
        { icon: 'lightning-bolt', text: 'Eliminazione diretta automatica' },
        { icon: 'chart', text: 'Statistiche dettagliate' }
    ];
    features.forEach(function(f) {
        html += '<div style="display:flex;align-items:center;gap:12px">';
        html += '<div style="width:36px;height:36px;border-radius:10px;background:var(--color-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon(f.icon, 18) + '</div>';
        html += '<span style="font-size:14px">' + f.text + '</span>';
        html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '</div></div>';
    container.innerHTML = html;
    hideFAB();
}
