<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Connessione database non disponibile"
    ]);
    exit;
}

$tournamentId = $_GET['tournament_id'] ?? null;

if (!$tournamentId) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "tournament_id obbligatorio"
    ]);
    exit;
}

try {
    $result = [
        "champion" => null,
        "runner_up" => null,
        "third_place" => null,
        "fourth_place" => null,
        "top_scorer" => null,
        "top_assist" => null,
        "best_goalkeeper" => null
    ];

    // 1. Campione e Finalista (finale match)
    $finaleQuery = "SELECT ht.name AS home_team, at.name AS away_team,
                    m.home_score, m.away_score,
                    m.home_extra_time, m.away_extra_time,
                    m.home_penalties, m.away_penalties
                    FROM matches m
                    JOIN teams ht ON ht.id = m.home_team_id
                    JOIN teams at ON at.id = m.away_team_id
                    WHERE m.tournament_id = :tid AND m.round = 'finale' AND m.status = 'finished'
                    LIMIT 1";
    $finaleStmt = $conn->prepare($finaleQuery);
    $finaleStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $finaleStmt->execute();
    $finale = $finaleStmt->fetch(PDO::FETCH_ASSOC);

    if ($finale) {
        $h = intval($finale['home_score']);
        $a = intval($finale['away_score']);

        if ($h === $a && $finale['home_extra_time'] !== null && $finale['away_extra_time'] !== null) {
            $h = intval($finale['home_extra_time']);
            $a = intval($finale['away_extra_time']);
        }
        if ($h === $a && $finale['home_penalties'] !== null && $finale['away_penalties'] !== null) {
            $h = intval($finale['home_penalties']);
            $a = intval($finale['away_penalties']);
        }

        $result['champion'] = $h > $a ? $finale['home_team'] : $finale['away_team'];
        $result['runner_up'] = $h > $a ? $finale['away_team'] : $finale['home_team'];
    }

    // 2. 3° e 4° Posto (terzo_posto match)
    $terzoQuery = "SELECT ht.name AS home_team, at.name AS away_team,
                   m.home_score, m.away_score,
                   m.home_extra_time, m.away_extra_time,
                   m.home_penalties, m.away_penalties
                   FROM matches m
                   JOIN teams ht ON ht.id = m.home_team_id
                   JOIN teams at ON at.id = m.away_team_id
                   WHERE m.tournament_id = :tid AND m.round = 'terzo_posto' AND m.status = 'finished'
                   LIMIT 1";
    $terzoStmt = $conn->prepare($terzoQuery);
    $terzoStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $terzoStmt->execute();
    $terzo = $terzoStmt->fetch(PDO::FETCH_ASSOC);

    if ($terzo) {
        $h = intval($terzo['home_score']);
        $a = intval($terzo['away_score']);

        if ($h === $a && $terzo['home_extra_time'] !== null && $terzo['away_extra_time'] !== null) {
            $h = intval($terzo['home_extra_time']);
            $a = intval($terzo['away_extra_time']);
        }
        if ($h === $a && $terzo['home_penalties'] !== null && $terzo['away_penalties'] !== null) {
            $h = intval($terzo['home_penalties']);
            $a = intval($terzo['away_penalties']);
        }

        $result['third_place'] = $h > $a ? $terzo['home_team'] : $terzo['away_team'];
        $result['fourth_place'] = $h > $a ? $terzo['away_team'] : $terzo['home_team'];
    }

    // 3. Capocannoniere
    $scorerQuery = "SELECT p.first_name, p.last_name, t.name AS team_name, SUM(pm.goals) AS total_goals
                    FROM match_players pm
                    JOIN players p ON p.id = pm.player_id
                    JOIN teams t ON t.id = p.team_id
                    JOIN matches m ON m.id = pm.match_id
                    WHERE m.tournament_id = :tid AND m.status = 'finished'
                    GROUP BY p.id
                    ORDER BY total_goals DESC
                    LIMIT 1";
    $scorerStmt = $conn->prepare($scorerQuery);
    $scorerStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $scorerStmt->execute();
    $scorer = $scorerStmt->fetch(PDO::FETCH_ASSOC);

    if ($scorer && intval($scorer['total_goals']) > 0) {
        $result['top_scorer'] = [
            "name" => trim($scorer['first_name'] . ' ' . $scorer['last_name']),
            "team" => $scorer['team_name'],
            "goals" => intval($scorer['total_goals'])
        ];
    }

    // 4. Capoassist
    $assistQuery = "SELECT p.first_name, p.last_name, t.name AS team_name, SUM(pm.assists) AS total_assists
                    FROM match_players pm
                    JOIN players p ON p.id = pm.player_id
                    JOIN teams t ON t.id = p.team_id
                    JOIN matches m ON m.id = pm.match_id
                    WHERE m.tournament_id = :tid AND m.status = 'finished'
                    GROUP BY p.id
                    ORDER BY total_assists DESC
                    LIMIT 1";
    $assistStmt = $conn->prepare($assistQuery);
    $assistStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $assistStmt->execute();
    $assist = $assistStmt->fetch(PDO::FETCH_ASSOC);

    if ($assist && intval($assist['total_assists']) > 0) {
        $result['top_assist'] = [
            "name" => trim($assist['first_name'] . ' ' . $assist['last_name']),
            "team" => $assist['team_name'],
            "assists" => intval($assist['total_assists'])
        ];
    }

    // 5. Miglior portiere (calcolato da match con 0 gol subiti dal team del portiere)
    $gkQuery = "SELECT p.first_name, p.last_name, t.name AS team_name,
                    COUNT(*) AS clean_sheets
                FROM players p
                JOIN teams t ON t.id = p.team_id
                JOIN match_players pm ON pm.player_id = p.id
                JOIN matches m ON m.id = pm.match_id
                WHERE m.tournament_id = :tid AND m.status = 'finished'
                    AND p.role = 'Portiere'
                    AND (
                        (p.team_id = m.home_team_id AND m.away_score = 0)
                        OR (p.team_id = m.away_team_id AND m.home_score = 0)
                    )
                GROUP BY p.id
                ORDER BY clean_sheets DESC
                LIMIT 1";
    $gkStmt = $conn->prepare($gkQuery);
    $gkStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $gkStmt->execute();
    $gk = $gkStmt->fetch(PDO::FETCH_ASSOC);

    if ($gk) {
        $result['best_goalkeeper'] = [
            "name" => trim($gk['first_name'] . ' ' . $gk['last_name']),
            "team" => $gk['team_name'],
            "clean_sheets" => intval($gk['clean_sheets'])
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $result
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
