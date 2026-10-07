const CACHE_NAME = "futsal-manager-v20";
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/variables.css',
    '/css/base.css',
    '/css/components.css',
    '/css/screens.css',
    '/js/api.js',
    '/js/app.js',
    '/js/router.js',
    '/js/components.js',
    '/js/icons.js',
    '/js/screens/home.js',
    '/js/screens/tournaments.js',
    '/js/screens/tournamentDetail.js',
    '/js/screens/teams.js',
    '/js/screens/teamDetail.js',
    '/js/screens/players.js',
    '/js/screens/playerDetail.js',
    '/js/screens/standings.js',
    '/js/screens/stats.js',
    '/js/screens/news.js',
    '/js/screens/about.js',
    '/js/screens/contact.js',
    '/js/screens/login.js',
    '/js/screens/organizer-register.js',
    '/js/screens/pdfExport.js',
    '/js/screens/admin/dashboard.js',
    '/js/screens/admin/tournaments.js',
    '/js/screens/admin/teams.js',
    '/js/screens/admin/groups.js',
    '/js/screens/admin/standings.js',
    '/js/screens/admin/matches.js',
    '/js/screens/admin/players.js',
    '/js/screens/admin/coaches.js',
    '/js/screens/admin/manual.js',
    '/js/screens/admin/forms.js',
    '/assets/Fut.webp'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.pathname.includes('/api/') && !url.pathname.includes('/assets/')) {
        const PUBLIC_API_PATHS = [
            '/tournaments/read.php',
            '/tournaments/read_one.php',
            '/tournaments/standings.php',
            '/tournaments/matches.php',
            '/tournaments/albo_doro.php',
            '/teams/read.php',
            '/teams/standings.php',
            '/players/read.php',
            '/matches/read.php',
            '/matches/scheduled.php',
            '/groups/read.php',
            '/groups/standings.php',
            '/groups/teams.php',
            '/groups/matches.php',
            '/groups/knockout_matches.php',
            '/stats/summary.php',
            '/stats/player_stats.php',
        ];

        const isPublicApi = PUBLIC_API_PATHS.some(path => url.pathname.includes(path));
        const isAuthRequest = request.headers.has('Authorization');

        if (isPublicApi && !isAuthRequest && request.method === 'GET') {
            event.respondWith(
                fetch(request)
                    .then(response => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                        }
                        return response;
                    })
                    .catch(() => caches.match(request))
            );
            return;
        }

        event.respondWith(fetch(request));
        return;
    }

    event.respondWith(
        caches.match(request)
            .then(cached => {
                if (cached) {
                    event.waitUntil(
                        fetch(request)
                            .then(response => {
                                if (response.ok) {
                                    caches.open(CACHE_NAME).then(cache => cache.put(request, response));
                                }
                            })
                            .catch(() => {})
                    );
                    return cached;
                }
                return fetch(request)
                    .then(response => {
                        if (response.ok && url.origin === self.location.origin) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                        }
                        return response;
                    })
                    .catch(() => {
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});
