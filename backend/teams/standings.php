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
    $query = "
        SELECT *,
        (goals_scored - goals_conceded) AS goal_difference
        FROM teams
        ORDER BY
        points DESC,
        goal_difference DESC,
        goals_scored DESC
    ";

    $stmt = $conn->prepare($query);
    $stmt->execute();
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

