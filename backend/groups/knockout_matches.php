<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
// CORS handled by cors.php


$tournamentId = $_GET['tournament_id'] ?? null;

if (!$tournamentId) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "tournament_id mancante"]);
    exit;
}

try {
    $query = "
        SELECT
            m.id,
            m.round,
            ht.name AS home_team,
            ht.id AS home_team_id,
            ht.logo_url AS home_logo_url,
            at.name AS away_team,
            at.id AS away_team_id,
            at.logo_url AS away_logo_url,
            m.home_score,
            m.away_score,
            m.home_extra_time,
            m.away_extra_time,
            m.home_penalties,
            m.away_penalties,
            m.match_date,
            m.status
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE m.tournament_id = :tid AND m.round != 'girone'
        ORDER BY
            FIELD(m.round, 'ottavi', 'quarti', 'semifinale', 'finale', 'terzo_posto'),
            m.match_date ASC
    ";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $stmt->execute();
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode(["success" => true, "data" => $matches]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
