/* ========== NEWS SCREEN ========== */
async function renderNews(container) {
    let html = '<div class="screen active">';
    html += '<div class="screen-header">';
    html += '<button class="back-btn" onclick="Router.back()">' + icon('arrow-left', 24) + '</button>';
    html += ' Notizie</div>';
    html += '<div class="screen-content">';
    html += '<div class="empty-state" style="padding:60px 20px">';
    html += icon('hammer-wrench', 64);
    html += '<h3>In produzione</h3>';
    html += '<p>La sezione Notizie sar&agrave; disponibile prossimamente.</p>';
    html += '</div>';
    html += '</div></div>';
    container.innerHTML = html;
    hideFAB();
}
