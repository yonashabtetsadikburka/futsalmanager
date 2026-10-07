<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
// CORS handled by cors.php


$groupId = $_GET['group_id'] ?? null;

if (!$groupId) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "group_id mancante"]);
    exit;
}

try {
    $query = "
        SELECT
            m.id,
            m.home_team_id,
            m.away_team_id,
            ht.name AS home_team,
            at.name AS away_team,
            m.home_score,
            m.away_score,
            m.home_extra_time,
            m.away_extra_time,
            m.home_penalties,
            m.away_penalties,
            m.match_date,
            m.status,
            m.round
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE m.group_id = :group_id
        ORDER BY m.match_date ASC
    ";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":group_id", $groupId, PDO::PARAM_INT);
    $stmt->execute();
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode(["success" => true, "data" => $matches]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
