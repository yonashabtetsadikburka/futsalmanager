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
    $tournamentId = $_GET['id'] ?? null;

    // Try cache first
    $cacheKey = $tournamentId ? "tournaments:id:$tournamentId" : "tournaments:all";
    $tournaments = RedisCache::get($cacheKey);

    if ($tournaments === null) {
        // Cache miss - query database
        if ($tournamentId) {
            $query = "SELECT id, name, logo_url, location, start_date, end_date, description, type, format, status, teams_per_group, qualified_per_group, has_knockout, created_at FROM tournaments WHERE id = :id";
            $stmt = $conn->prepare($query);
            $stmt->bindParam(":id", $tournamentId, PDO::PARAM_INT);
        } else {
            $query = "SELECT id, name, logo_url, location, start_date, end_date, description, type, format, status, teams_per_group, qualified_per_group, has_knockout, created_at FROM tournaments ORDER BY created_at DESC";
            $stmt = $conn->prepare($query);
        }
        $stmt->execute();
        $tournaments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Save to cache (60 seconds TTL)
        RedisCache::set($cacheKey, $tournaments, 60);
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $tournaments
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
