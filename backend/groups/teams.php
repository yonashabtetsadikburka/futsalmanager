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

$groupId = $_GET['group_id'] ?? null;

if (!$groupId) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "group_id mancante"]);
    exit;
}

try {
    $query = "
        SELECT t.*,
               CONCAT(u.first_name, ' ', u.last_name) AS coach_name,
               tournaments.name AS tournament_name
        FROM teams t
        JOIN group_teams gt ON gt.team_id = t.id
        LEFT JOIN users u ON t.coach_id = u.id
        LEFT JOIN tournaments ON t.tournament_id = tournaments.id
        WHERE gt.group_id = :group_id
        ORDER BY t.name ASC
    ";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":group_id", $groupId, PDO::PARAM_INT);
    $stmt->execute();
    $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode(["success" => true, "data" => $teams]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>