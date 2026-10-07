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

try {
    // Try cache first
    $cacheKey = $tournamentId ? "stats:summary:tournament:$tournamentId" : "stats:summary:global";
    $data = RedisCache::get($cacheKey);

    if ($data === null) {
        // Cache miss - query database
        if ($tournamentId) {
            $tournamentId = (int) $tournamentId;

            $stmt = $conn->prepare("SELECT COUNT(*) FROM players p INNER JOIN teams t ON p.team_id = t.id WHERE t.tournament_id = ?");
            $stmt->execute([$tournamentId]);
            $players = $stmt->fetchColumn();

            $stmt = $conn->prepare("SELECT COUNT(*) FROM teams WHERE tournament_id = ?");
            $stmt->execute([$tournamentId]);
            $teams = $stmt->fetchColumn();

            $stmt = $conn->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = ?");
            $stmt->execute([$tournamentId]);
            $matches = $stmt->fetchColumn();

            $stmt = $conn->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = ? AND status = 'finished'");
            $stmt->execute([$tournamentId]);
            $finished = $stmt->fetchColumn();

            $stmt = $conn->prepare("SELECT COUNT(DISTINCT u.id) FROM users u INNER JOIN teams t ON t.coach_id = u.id WHERE u.role = 'coach' AND t.tournament_id = ?");
            $stmt->execute([$tournamentId]);
            $coaches = $stmt->fetchColumn();
        } else {
            $players    = $conn->query("SELECT COUNT(*) FROM players")->fetchColumn();
            $teams      = $conn->query("SELECT COUNT(*) FROM teams")->fetchColumn();
            $matches    = $conn->query("SELECT COUNT(*) FROM matches")->fetchColumn();
            $finished   = $conn->query("SELECT COUNT(*) FROM matches WHERE status = 'finished'")->fetchColumn();
            $coaches    = $conn->query("SELECT COUNT(*) FROM users WHERE role = 'coach'")->fetchColumn();
            $tournaments = $conn->query("SELECT COUNT(*) FROM tournaments")->fetchColumn();
        }

        $data = [
            "success" => true,
            "data" => [
                "players"    => (int) $players,
                "teams"      => (int) $teams,
                "matches"    => (int) $matches,
                "finished"   => (int) $finished,
                "coaches"    => (int) $coaches
            ]
        ];

        if (!$tournamentId) {
            $data["data"]["tournaments"] = (int) $conn->query("SELECT COUNT(*) FROM tournaments")->fetchColumn();
        }

        // Save to cache (120 seconds TTL for stats)
        RedisCache::set($cacheKey, $data, 120);
    }

    http_response_code(200);
    echo json_encode($data);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Errore database"
    ]);

}
