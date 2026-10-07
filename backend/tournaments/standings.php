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

$tournamentId = $_GET['tournament_id'] ?? null;

try {
    $query = "
        SELECT
            t.*,
            (t.goals_scored - t.goals_conceded) AS goal_difference
        FROM teams t
    ";

    $params = [];

    if ($tournamentId) {
        $query .= " WHERE t.tournament_id = :tournament_id";
        $params[":tournament_id"] = $tournamentId;
    }

    $query .= " ORDER BY t.points DESC, goal_difference DESC, t.goals_scored DESC";

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $standings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $standings
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
