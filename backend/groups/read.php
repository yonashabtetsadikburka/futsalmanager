<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
// CORS handled by cors.php

require_once __DIR__ . "/../config/database.php";

if (!$conn) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Connessione database non disponibile"]);
    exit;
}

$tournamentId = $_GET['tournament_id'] ?? null;

try {
    // Try cache first
    $cacheKey = $tournamentId ? "groups:tournament:$tournamentId" : "groups:all";
    $groups = RedisCache::get($cacheKey);

    if ($groups === null) {
        // Cache miss - query database
        if ($tournamentId) {
        $query = "
            SELECT g.*,
                   COUNT(DISTINCT gt.team_id) as teams_count
            FROM `groups` g
            LEFT JOIN group_teams gt ON gt.group_id = g.id
            WHERE g.tournament_id = :tournament_id
            GROUP BY g.id
            ORDER BY g.name ASC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    } else {
        $query = "
            SELECT g.*,
                   t.name as tournament_name,
                   COUNT(DISTINCT gt.team_id) as teams_count
            FROM `groups` g
            LEFT JOIN tournaments t ON t.id = g.tournament_id
            LEFT JOIN group_teams gt ON gt.group_id = g.id
            GROUP BY g.id
            ORDER BY t.name ASC, g.name ASC
        ";
        $stmt = $conn->prepare($query);
    }
    $stmt->execute();
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Save to cache (60 seconds TTL)
    RedisCache::set($cacheKey, $groups, 60);
    }

    http_response_code(200);
    echo json_encode(["success" => true, "data" => $groups]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
