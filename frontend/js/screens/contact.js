    /* ========== CONTACT SCREEN ========== */
async function renderContact(container) {
    let html = '<div class="screen active">';
    html += '<div class="screen-header">';
    html += '<button class="back-btn" onclick="Router.back()">' + icon('arrow-left', 24) + '</button>';
    html += ' Contattaci</div>';
    html += '<div class="screen-content">';

    html += '<div style="margin-bottom:24px">';
    html += '<p style="font-size:14px;color:var(--color-text-secondary)">Hai domande, suggerimenti o hai bisogno di aiuto? Compila il form qui sotto e ti risponderemo al pi&ugrave; presto.</p>';
    html += '</div>';

    html += '<div class="card"><div class="card-body">';
    html += '<form id="contact-form" onsubmit="return false;">';

    html += '<div class="form-group"><label class="form-label">Nome</label>';
    html += '<input class="form-input" type="text" id="contact-name" placeholder="Il tuo nome" maxlength="50" required></div>';

    html += '<div class="form-group"><label class="form-label">Email</label>';
    html += '<input class="form-input" type="email" id="contact-email" placeholder="La tua email" maxlength="100" required></div>';

    html += '<div class="form-group"><label class="form-label">Messaggio</label>';
    html += '<textarea class="form-input" id="contact-message" rows="5" placeholder="Il tuo messaggio..." maxlength="2000" minlength="10" style="resize:vertical" required></textarea></div>';

    /* Honeypot - nascosto con CSS, i bot lo compilano */
    html += '<div style="position:absolute;left:-9999px" aria-hidden="true">';
    html += '<input type="text" id="contact-website" name="website" tabindex="-1" autocomplete="off">';
    html += '</div>';

    /* Timestamp anti-bot */
    html += '<input type="hidden" id="contact-timestamp" value="">';

    html += '<button class="btn btn-primary btn-block" id="contact-submit" onclick="sendContactForm()">' + icon('send', 16) + ' Invia</button>';
    html += '</form>';
    html += '</div></div>';

    html += '</div></div>';
    container.innerHTML = html;

    /* Imposta timestamp al caricamento del form */
    document.getElementById('contact-timestamp').value = Date.now();

    hideFAB();
}

function sendContactForm() {
    var btn = document.getElementById('contact-submit');
    var name = document.getElementById('contact-name').value.trim();
    var email = document.getElementById('contact-email').value.trim();
    var message = document.getElementById('contact-message').value.trim();
    var honeypot = document.getElementById('contact-website').value;
    var timestamp = parseInt(document.getElementById('contact-timestamp').value || '0');

    /* Honeypot check - i bot compilano il campo nascosto */
    if (honeypot) return;

    /* Anti-bot: deve aver impiegato almeno 5 secondi a compilare */
    if (!timestamp || (Date.now() - timestamp) < 5000) {
        showToast('Compila il form con calma', 'error');
        return;
    }

    /* Validazione nome */
    if (!name || name.length < 2) {
        showToast('Nome troppo corto (min 2 caratteri)', 'error');
        return;
    }
    if (name.length > 50) {
        showToast('Nome troppo lungo (max 50 caratteri)', 'error');
        return;
    }

    /* Validazione email - regex RFC 5322 semplificata */
    var emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!email || !emailRegex.test(email)) {
        showToast('Inserisci un\'email valida', 'error');
        return;
    }
    if (email.length > 100) {
        showToast('Email troppo lunga (max 100 caratteri)', 'error');
        return;
    }

    /* Validazione messaggio */
    if (message.length < 10) {
        showToast('Messaggio troppo corto (min 10 caratteri)', 'error');
        return;
    }
    if (message.length > 2000) {
        showToast('Messaggio troppo lungo (max 2000 caratteri)', 'error');
        return;
    }

    /* Debounce: se il bottone è già disabilitato, esci */
    if (btn.disabled) return;

    /* Disable bottone + spinner durante invio */
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Invio...';

    /* Per ora il form è un placeholder - mostra successo */
    setTimeout(function() {
        showToast('Messaggio inviato! Grazie per averci contattato.', 'success');
        document.getElementById('contact-name').value = '';
        document.getElementById('contact-email').value = '';
        document.getElementById('contact-message').value = '';
        document.getElementById('contact-timestamp').value = Date.now();
        btn.disabled = false;
        btn.innerHTML = icon('send', 16) + ' Invia';
    }, 1000);

    /* TODO: quando il backend sarà pronto, sostituire il setTimeout con:
    apiPost('contact.php', {
        name: name,
        email: email,
        message: message,
        honeypot: honeypot,
        timestamp: timestamp
    }, { auth: false }).then(function(res) {
        showToast('Messaggio inviato! Grazie per averci contattato.', 'success');
        document.getElementById('contact-name').value = '';
        document.getElementById('contact-email').value = '';
        document.getElementById('contact-message').value = '';
        document.getElementById('contact-timestamp').value = Date.now();
    }).catch(function(e) {
        showToast(e.message || 'Errore nell\'invio del messaggio', 'error');
    }).finally(function() {
        btn.disabled = false;
        btn.innerHTML = icon('send', 16) + ' Invia';
    });
    */
}
