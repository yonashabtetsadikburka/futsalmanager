# FutsalManager

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)

Web app per la gestione di tornei di futsal: gironi, knockout automatico,
classifiche live, statistiche giocatori, pannello admin/organizzatore e PWA offline.

**Live demo:** https://futsal.burkasolutions.dev
**Autore:** Yonas Habtetsadik Burka — ITS Umbria Academy (Data Management & Coding)

## Stack

- Frontend: Vanilla JavaScript SPA (hash router), PWA con service worker
- Backend: PHP 8.1 (no framework), API REST JSON
- DB: MySQL 8.0 + Redis cache
- Server: Apache 2.4 su Oracle Cloud VPS, Cloudflare DNS + CDN
- Deploy: GitHub Actions via SSH su ogni push su `main`

## Struttura repo

```
frontend/   # SPA pubblica (index.html, css/, js/, assets/, manifest.json, sw.js)
backend/    # API PHP (config/, tournaments/, teams/, players/, groups/, matches/, users/, stats/, migrations/)
.github/workflows/deploy.yml  # deploy automatico sul VPS
```

## Avvio in locale

1. `cp backend/.env.example backend/.env` e compila `DB_USER`, `DB_PASS`, `FUTSAL_TOKEN_SECRET`
2. Crea DB `futsal` e importa `backend/migrations/*.sql`
3. `php -S localhost:8000 -t frontend/` + Apache/PHP per `backend/` su `/api/`
4. Apri `http://localhost:8000`

## API principali

- `GET /api/tournaments/read.php` — lista tornei
- `GET /api/tournaments/standings.php` — classifica
- `POST /api/matches/finish.php` (auth) — chiudi partita e aggiorna classifiche
- `POST /api/groups/generate_knockout.php` (auth) — genera tabellone

## Note

- `frontend/assets/uploads/` contiene solo placeholder: le foto caricate dagli utenti restano sul server e non sono versionate.
- Il file `.env` reale esiste solo sul VPS, mai su GitHub.

## Licenza

Distribuito sotto licenza MIT — vedi [LICENSE](LICENSE).
