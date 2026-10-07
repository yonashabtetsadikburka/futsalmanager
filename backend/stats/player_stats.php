<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
// CORS handled by cors.php


require_once __DIR__ . "/../config/database.php";

$tournamentId = $_GET['tournament_id'] ?? null;
$matchId = $_GET['match_id'] ?? null;
$groupId = $_GET['group_id'] ?? null;

if (!$tournamentId && !$matchId) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "ID torneo o ID partita mancante"
    ]);
    exit;
}

try {
    // Try cache for tournament-level stats (most expensive)
    $cacheKey = null;
    if (!$matchId && $tournamentId) {
        $cacheKey = $groupId ? "stats:players:group:$groupId:tournament:$tournamentId" : "stats:players:tournament:$tournamentId";
        $cached = RedisCache::get($cacheKey);
        if ($cached !== null) {
            http_response_code(200);
            echo json_encode(["success" => true, "data" => $cached, "cached" => true]);
            exit;
        }
    }

    if ($matchId) {
        // Stats per singola partita
        $query = "
        SELECT 
            p.id,
            p.first_name,
            p.last_name,
            p.role,
            t.name as team_name,
            mp.goals as gol,
            mp.assists as assist
        FROM match_players mp
        JOIN players p ON mp.player_id = p.id
        JOIN teams t ON p.team_id = t.id
        WHERE mp.match_id = :match_id
        ORDER BY mp.goals DESC, mp.assists DESC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":match_id", $matchId, PDO::PARAM_INT);
    } else {
        // Stats aggregate per torneo (opzionalmente filtrato per girone)
        if ($groupId) {
            // Stats per girone specifico
            $query = "
            SELECT 
                p.id,
                p.first_name,
                p.last_name,
                p.role,
                t.id as team_id,
                t.name as team_name,
                gt.group_id,
                g.name as group_name,
                COUNT(mp.id) as presenze,
                COALESCE(SUM(mp.goals), 0) as gol,
                COALESCE(SUM(mp.assists), 0) as assist,
                (COALESCE(SUM(mp.goals), 0) + COALESCE(SUM(mp.assists), 0)) as gol_assist,
                0 as clean_sheets
            FROM group_teams gt
            JOIN players p ON p.team_id = gt.team_id
            JOIN teams t ON t.id = gt.team_id
            JOIN `groups` g ON g.id = gt.group_id
            LEFT JOIN match_players mp ON mp.player_id = p.id
            LEFT JOIN matches m ON mp.match_id = m.id AND m.tournament_id = :tournament_id AND m.group_id = :group_id
            WHERE gt.group_id = :group_id
            GROUP BY p.id, p.first_name, p.last_name, p.role, t.id, t.name, gt.group_id, g.name
            ORDER BY gol DESC, assist DESC, presenze DESC
            ";
            $stmt = $conn->prepare($query);
            $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
            $stmt->bindParam(":group_id", $groupId, PDO::PARAM_INT);
        } else {
            // Stats per torneo intero
            $query = "
            SELECT 
                p.id,
                p.first_name,
                p.last_name,
                p.role,
                t.id as team_id,
                t.name as team_name,
                gt.group_id,
                g.name as group_name,
                COUNT(mp.id) as presenze,
                COALESCE(SUM(mp.goals), 0) as gol,
                COALESCE(SUM(mp.assists), 0) as assist,
                (COALESCE(SUM(mp.goals), 0) + COALESCE(SUM(mp.assists), 0)) as gol_assist,
                0 as clean_sheets
            FROM teams t
            JOIN players p ON p.team_id = t.id
            LEFT JOIN group_teams gt ON gt.team_id = t.id
            LEFT JOIN `groups` g ON g.id = gt.group_id
            LEFT JOIN match_players mp ON mp.player_id = p.id
            LEFT JOIN matches m ON mp.match_id = m.id AND m.tournament_id = :tournament_id
            WHERE t.tournament_id = :tournament_id
            GROUP BY p.id, p.first_name, p.last_name, p.role, t.id, t.name, gt.group_id, g.name
            ORDER BY gol DESC, assist DESC, presenze DESC
            ";
            $stmt = $conn->prepare($query);
            $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
        }
    }
    $stmt->execute();

    $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calcola clean sheets per i portieri - query aggregata singola (no N+1)
    if (!$matchId && $tournamentId) {
        $csQuery = "
            SELECT team_id, COUNT(*) as clean_sheets
            FROM (
                SELECT m.home_team_id AS team_id
                FROM matches m
                WHERE m.tournament_id = :tid
                AND m.status = 'finished'
                AND m.away_score = 0
                " . ($groupId ? "AND m.group_id = :gid" : "") . "
                UNION ALL
                SELECT m.away_team_id AS team_id
                FROM matches m
                WHERE m.tournament_id = :tid2
                AND m.status = 'finished'
                AND m.home_score = 0
                " . ($groupId ? "AND m.group_id = :gid2" : "") . "
            ) cs
            GROUP BY team_id
        ";
        $csStmt = $conn->prepare($csQuery);
        $csStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
        $csStmt->bindParam(":tid2", $tournamentId, PDO::PARAM_INT);
        if ($groupId) {
            $csStmt->bindParam(":gid", $groupId, PDO::PARAM_INT);
            $csStmt->bindParam(":gid2", $groupId, PDO::PARAM_INT);
        }
        $csStmt->execute();
        $cleanSheetsMap = [];
        while ($csRow = $csStmt->fetch(PDO::FETCH_ASSOC)) {
            $cleanSheetsMap[$csRow['team_id']] = intval($csRow['clean_sheets']);
        }

        foreach ($players as &$player) {
            if ($player['role'] === 'Portiere') {
                $player['clean_sheets'] = $cleanSheetsMap[$player['team_id']] ?? 0;
            }
        }
        unset($player);
    }

    // Save to cache (120 seconds TTL for tournament stats)
    if ($cacheKey) {
        RedisCache::set($cacheKey, $players, 120);
    }

    echo json_encode([
        "success" => true,
        "data" => $players
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
?>
