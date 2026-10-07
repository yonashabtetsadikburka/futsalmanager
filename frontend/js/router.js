/* ========== HASH-BASED ROUTER ========== */
const Router = {
    routes: {},
    current: null,
    history: [],

    register(path, renderFn) {
        this.routes[path] = renderFn;
    },

    navigate(path, skipPush) {
        if (this.current) this.history.push(this.current);
        this.current = path;
        if (!skipPush) window.location.hash = path;
        this.render();
        window.scrollTo(0, 0);
    },

    back() {
        if (this.history.length > 0) {
            const prev = this.history.pop();
            this.current = prev;
            window.location.hash = prev;
            this.render();
            window.scrollTo(0, 0);
        } else {
            this.navigate('/home', true);
        }
    },

    matchRoute(path) {
        if (this.routes[path]) return this.routes[path];
        for (const route in this.routes) {
            const routeParts = route.split('/');
            const pathParts = path.split('/');
            if (routeParts.length !== pathParts.length) continue;
            let match = true;
            for (let i = 0; i < routeParts.length; i++) {
                if (routeParts[i].startsWith(':')) continue;
                if (routeParts[i] !== pathParts[i]) { match = false; break; }
            }
            if (match) return this.routes[route];
        }
        return null;
    },

    render() {
        const path = this.current || '/home';
        const main = document.getElementById('main-content');
        const renderFn = this.matchRoute(path);
        if (renderFn) {
            main.innerHTML = '';
            renderFn(main);
        } else {
            main.innerHTML = '<div class="screen-content"><h2>Pagina non trovata</h2></div>';
        }
        this.updateNav();
    },

    updateNav() {
        document.querySelectorAll('.header-link, .bottom-tab').forEach(el => {
            const route = el.dataset.route;
            if (route) el.classList.toggle('active', route === this.current || (route === '/home' && this.current === '/'));
        });
    },

    init() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || '/home';
            if (hash !== this.current) {
                this.navigate(hash, true);
            }
        });
        const hash = window.location.hash.slice(1) || '/home';
        this.navigate(hash, true);
    }
};
