/* ========== APP INIT ========== */
const App = {
    isAdmin: false,
    userRole: null,
    userTournamentId: null,
    isAdminPanel: false,
    theme: 'dark',

    init() {
        this.isAdminPanel = !!window.__ADMIN_PANEL;
        this.theme = localStorage.getItem('futsal-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        this.checkAuth();
        this.renderHeader();
        this.registerRoutes();
        this.updateNav();
        this.updateBottomTabs();
        if (this.isAdminPanel && !window.location.hash.slice(1)) {
            window.location.hash = this.isAdmin ? '/admin' : '/login';
        }
        Router.init();
    },

    checkAuth() {
        const token = localStorage.getItem('admin_token');
        const role = localStorage.getItem('user_role');
        const tournamentId = localStorage.getItem('user_tournament_id');

        let tokenValid = false;
        if (token) {
            try {
                const parts = token.split('.');
                if (parts.length === 2) {
                    const payload = JSON.parse(atob(parts[0]));
                    tokenValid = payload.exp && payload.exp > Math.floor(Date.now() / 1000);
                }
            } catch (e) {
                tokenValid = false;
            }
        }

        if (!tokenValid && token) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('user_tournament_id');
            localStorage.removeItem('user_name');
        }

        this.isAdmin = tokenValid;
        this.userRole = tokenValid ? role : null;
        this.userTournamentId = tokenValid && tournamentId ? parseInt(tournamentId) : null;

        this.updateNav();
        this.updateBottomTabs();
    },

    login(token, role, tournamentId) {
        localStorage.setItem('admin_token', token);
        this.isAdmin = true;
        this.userRole = role || 'admin';
        this.userTournamentId = tournamentId || null;
        localStorage.setItem('user_role', this.userRole);
        if (tournamentId) localStorage.setItem('user_tournament_id', tournamentId);
        this.updateNav();
        this.updateBottomTabs();
    },

    logout() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_tournament_id');
        localStorage.removeItem('user_name');
        if ('caches' in window) {
            caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
        }
        this.isAdmin = false;
        this.userRole = null;
        this.userTournamentId = null;
        this.updateNav();
        this.updateBottomTabs();
        if (this.isAdminPanel) {
            Router.navigate('/login');
        } else {
            Router.navigate('/home');
        }
        showToast('Logout effettuato', 'info');
    },

    isOrganizer() {
        return this.isAdmin && this.userRole === 'organizer';
    },

    renderHeader() {
        const header = document.getElementById('header-nav');
        const themeIcon = App.theme === 'bright' ? 'moon' : 'sun';
        const themeAction = this.isAdminPanel ? 'toggleThemeAdmin()' : 'toggleTheme()';
        header.innerHTML = `
            <img src="${this.isAdminPanel ? '../assets/Fut.webp' : 'assets/Fut.webp'}" class="header-logo" alt="Futsal Manager">
            <nav class="header-nav-links" id="header-nav-links"></nav>
            <div class="header-logout" id="header-logout" onclick="App.logout()" style="display:none">${icon('logout', 18)}<span>Logout</span></div>
            <button class="header-theme-toggle" onclick="${themeAction}" aria-label="Cambia tema">${icon(themeIcon, 20)}</button>
        `;
    },

    renderBottomTabs() {
        this.updateBottomTabs();
    },

    updateBottomTabs() {
        const tabs = document.getElementById('bottom-tabs');
        if (!tabs) return;

        if (this.isAdminPanel) {
            const adminTabs = this.getAdminTabs();
            tabs.innerHTML = adminTabs.map(t =>
                '<div class="bottom-tab" data-route="' + t.route + '" onclick="Router.navigate(\'' + t.route + '\')">' + icon(t.icon, 22) + '<span>' + t.label + '</span></div>'
            ).join('');
        } else {
            const publicTabs = [
                { route: '/home', icon: 'home', label: 'Home' },
                { route: '/tornei', icon: 'medal', label: 'Tornei' },
                { route: '/squadre', icon: 'shield', label: 'Squadre' },
                { route: '/giocatori', icon: 'account-multiple', label: 'Giocatori' },
                { route: '/classifiche', icon: 'format-list-numbered', label: 'Classifica' },
                { route: '/statistiche', icon: 'chart', label: 'Statistiche' }
            ];
            tabs.innerHTML = publicTabs.map(t =>
                '<div class="bottom-tab" data-route="' + t.route + '" onclick="Router.navigate(\'' + t.route + '\')">' + icon(t.icon, 22) + '<span>' + t.label + '</span></div>'
            ).join('');
        }
        Router.updateNav();
    },

    getAdminTabs() {
        if (!this.isAdmin) {
            return [{ route: '/login', icon: 'lock', label: 'Login' }];
        }
        if (this.isOrganizer()) {
            return [
                { route: '/admin', icon: 'home', label: 'Dashboard' },
                { route: '/admin/squadre', icon: 'shield', label: 'Squadre' },
                { route: '/admin/allenatori', icon: 'account', label: 'Allenatori' },
                { route: '/admin/gruppi', icon: 'google-circles', label: 'Gironi' },
                { route: '/admin/partite', icon: 'whistle', label: 'Partite' },
                { route: '/admin/giocatori', icon: 'account-multiple', label: 'Giocatori' },
                { route: '/admin/manuale', icon: 'book-open-variant', label: 'Manuale' }
            ];
        }
        return [
            { route: '/admin', icon: 'home', label: 'Dashboard' },
            { route: '/admin/tornei', icon: 'medal', label: 'Tornei' },
            { route: '/admin/squadre', icon: 'shield', label: 'Squadre' },
            { route: '/admin/gruppi', icon: 'google-circles', label: 'Gironi' },
            { route: '/admin/partite', icon: 'whistle', label: 'Partite' },
            { route: '/admin/giocatori', icon: 'account-multiple', label: 'Giocatori' }
        ];
    },

    updateNav() {
        if (this.isAdminPanel) {
            this.updateAdminNav();
        } else {
            this.updatePublicNav();
        }
    },

    updatePublicNav() {
        const publicLinks = [
            { route: '/home', icon: 'home', label: 'Home' },
            { route: '/tornei', icon: 'medal', label: 'Tornei' },
            { route: '/squadre', icon: 'shield', label: 'Squadre' },
            { route: '/giocatori', icon: 'account-multiple', label: 'Giocatori' },
            { route: '/classifiche', icon: 'format-list-numbered', label: 'Classifiche' },
            { route: '/statistiche', icon: 'chart', label: 'Statistiche' }
        ];

        let navHtml = '';
        publicLinks.forEach(l => {
            navHtml += '<div class="header-link" data-route="' + l.route + '" onclick="Router.navigate(\'' + l.route + '\')">' + '<span>' + l.label + '</span></div>';
        });

        const nav = document.getElementById('header-nav-links');
        if (nav) nav.innerHTML = navHtml;
        Router.updateNav();
    },

    updateAdminNav() {
        let navHtml = '';
        const logoutEl = document.getElementById('header-logout');
        if (logoutEl) logoutEl.style.display = 'none';

        if (!this.isAdmin) {
            navHtml += '<div class="header-link" data-route="/login" onclick="Router.navigate(\'/login\')">' + '<span>Login</span></div>';
            navHtml += '<div class="header-link" data-route="/register-organizer" onclick="Router.navigate(\'/register-organizer\')">' + '<span>Registrati</span></div>';
        } else if (this.isOrganizer()) {
            const orgLinks = [
                { route: '/admin', icon: 'home', label: 'Dashboard' },
                { route: '/admin/squadre', icon: 'shield', label: 'Squadre' },
                { route: '/admin/gruppi', icon: 'google-circles', label: 'Gironi' },
                { route: '/admin/classifiche', icon: 'format-list-numbered', label: 'Classifiche' },
                { route: '/admin/partite', icon: 'whistle', label: 'Partite' },
                { route: '/admin/giocatori', icon: 'account-multiple', label: 'Giocatori' },
                { route: '/admin/allenatori', icon: 'account-multiple-plus', label: 'Allenatori' },
                { route: '/admin/manuale', icon: 'book-open-variant', label: 'Manuale' },
                { route: '/admin/export-pdf', icon: 'file-pdf-box', label: 'PDF' }
            ];
            orgLinks.forEach(l => {
                navHtml += '<div class="header-link" data-route="' + l.route + '" onclick="Router.navigate(\'' + l.route + '\')">' + '<span>' + l.label + '</span></div>';
            });
            if (logoutEl) logoutEl.style.display = 'flex';
        } else {
            const adminLinks = [
                { route: '/admin', icon: 'shield-star', label: 'Dashboard' },
                { route: '/admin/tornei', icon: 'medal', label: 'Tornei' },
                { route: '/admin/squadre', icon: 'shield', label: 'Squadre' },
                { route: '/admin/gruppi', icon: 'google-circles', label: 'Gironi' },
                { route: '/admin/classifiche', icon: 'format-list-numbered', label: 'Classifiche' },
                { route: '/admin/partite', icon: 'whistle', label: 'Partite' },
                { route: '/admin/giocatori', icon: 'account-multiple', label: 'Giocatori' },
                { route: '/admin/allenatori', icon: 'account-multiple-plus', label: 'Allenatori' }
            ];
            adminLinks.forEach(l => {
                navHtml += '<div class="header-link" data-route="' + l.route + '" onclick="Router.navigate(\'' + l.route + '\')">' + '<span>' + l.label + '</span></div>';
            });
            if (logoutEl) logoutEl.style.display = 'flex';
        }

        const nav = document.getElementById('header-nav-links');
        if (nav) nav.innerHTML = navHtml;
        Router.updateNav();
    },

    registerRoutes() {
        if (this.isAdminPanel) {
            Router.register('/login', renderLogin);
            Router.register('/register-organizer', renderOrganizerRegister);
            Router.register('/admin', renderAdminDashboard);
            Router.register('/admin/tornei', renderAdminTournaments);
            Router.register('/admin/squadre', renderAdminTeams);
            Router.register('/admin/gruppi', renderAdminGroups);
            Router.register('/admin/classifiche', renderAdminStandings);
            Router.register('/admin/partite', renderAdminMatches);
            Router.register('/admin/giocatori', renderAdminPlayers);
            Router.register('/admin/allenatori', renderAdminCoaches);
            Router.register('/admin/manuale', renderAdminManual);
            Router.register('/admin/export-pdf', renderPdfExport);
        } else {
            Router.register('/home', renderHome);
            Router.register('/tornei', renderTournaments);
            Router.register('/torneo/:id', renderTournamentDetail);
            Router.register('/squadre', renderTeams);
            Router.register('/squadra/:id', renderTeamDetail);
            Router.register('/giocatori', renderPlayers);
            Router.register('/giocatore/:id', renderPlayerDetail);
            Router.register('/classifiche', renderStandings);
            Router.register('/statistiche', renderStats);
            Router.register('/notizie', renderNews);
            Router.register('/chi-siamo', renderAbout);
            Router.register('/contattaci', renderContact);
        }
    }
};

/* ========== THEME TOGGLE ========== */
function toggleTheme() {
    App.theme = App.theme === 'dark' ? 'bright' : 'dark';
    localStorage.setItem('futsal-theme', App.theme);
    document.documentElement.setAttribute('data-theme', App.theme);
    Router.navigate('/home');
}

function toggleThemeAdmin() {
    App.theme = App.theme === 'dark' ? 'bright' : 'dark';
    localStorage.setItem('futsal-theme', App.theme);
    document.documentElement.setAttribute('data-theme', App.theme);
    Router.navigate('/admin');
}

/* ========== URL PARAM HELPERS ========== */
function getRouteParam() {
    const hash = window.location.hash.slice(1);
    const parts = hash.split('/');
    return parts[parts.length - 1];
}

document.addEventListener('DOMContentLoaded', () => App.init());
