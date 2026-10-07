<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
// CORS handled by cors.php


$groupId = $_GET['group_id'] ?? null;
$tournamentId = $_GET['tournament_id'] ?? null;

if (!$groupId && !$tournamentId) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "group_id o tournament_id mancante"]);
    exit;
}

try {
    // Try cache first
    $cacheKey = $groupId ? "standings:group:$groupId" : "standings:tournament:$tournamentId";
    $standings = RedisCache::get($cacheKey);

    if ($standings === null) {
        if ($groupId) {
        // Classifica per un singolo girone
        $query = "
            SELECT
                t.id,
                t.name,
                t.logo_url,
                g.name AS group_name,
                t.wins,
                t.draws,
                t.losses,
                t.goals_scored,
                t.goals_conceded,
                (t.goals_scored - t.goals_conceded) AS diff_reti,
                (t.wins * 3 + t.draws) AS punti
            FROM teams t
            JOIN group_teams gt ON gt.team_id = t.id
            JOIN `groups` g ON g.id = gt.group_id
            WHERE g.id = :group_id
            ORDER BY punti DESC, diff_reti DESC, t.goals_scored DESC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":group_id", $groupId, PDO::PARAM_INT);
    } else {
        // Classifica per tutti i gironi di un torneo
        $query = "
            SELECT
                t.id,
                t.name,
                t.logo_url,
                g.name AS group_name,
                g.id AS group_id,
                t.wins,
                t.draws,
                t.losses,
                t.goals_scored,
                t.goals_conceded,
                (t.goals_scored - t.goals_conceded) AS diff_reti,
                (t.wins * 3 + t.draws) AS punti
            FROM teams t
            JOIN group_teams gt ON gt.team_id = t.id
            JOIN `groups` g ON g.id = gt.group_id
            WHERE g.tournament_id = :tournament_id
            ORDER BY g.name ASC, punti DESC, diff_reti DESC, t.goals_scored DESC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    }

    $stmt->execute();
    $standings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Save to cache (60 seconds TTL)
    RedisCache::set($cacheKey, $standings, 60);
    }

    http_response_code(200);
    echo json_encode(["success" => true, "data" => $standings]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
