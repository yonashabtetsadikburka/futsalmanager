<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
// CORS handled by cors.php

require_once __DIR__ . "/../config/database.php";

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Connessione database non disponibile"
    ]);
    exit;
}

try {
    $tournamentId = isset($_GET['tournament_id']) ? $_GET['tournament_id'] : null;

    // Try cache first
    $cacheKey = $tournamentId ? "teams:tournament:$tournamentId" : "teams:all";
    $teams = RedisCache::get($cacheKey);

    if ($teams === null) {
        // Cache miss - query database
        if ($tournamentId) {
            $query = "
                SELECT
                    teams.*,
                    CONCAT(users.first_name, ' ', users.last_name) AS coach_name,
                    tournaments.name AS tournament_name
                FROM teams
                LEFT JOIN users ON teams.coach_id = users.id
                LEFT JOIN tournaments ON teams.tournament_id = tournaments.id
                WHERE teams.tournament_id = :tournament_id
                ORDER BY teams.id DESC
            ";
            $stmt = $conn->prepare($query);
            $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
        } else {
            $query = "
                SELECT
                    teams.*,
                    CONCAT(users.first_name, ' ', users.last_name) AS coach_name,
                    tournaments.name AS tournament_name
                FROM teams
                LEFT JOIN users ON teams.coach_id = users.id
                LEFT JOIN tournaments ON teams.tournament_id = tournaments.id
                ORDER BY teams.id DESC
            ";
            $stmt = $conn->prepare($query);
        }

        $stmt->execute();
        $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Save to cache (60 seconds TTL)
        RedisCache::set($cacheKey, $teams, 60);
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $teams
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}