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
        SELECT
            m.id,
            m.tournament_id,
            m.group_id,
            m.match_date,
            m.status,
            m.round,
            ht.name AS home_team,
            at.name AS away_team,
            COALESCE(g.name, (
                SELECT g2.name FROM `groups` g2
                INNER JOIN group_teams gt1 ON gt1.group_id = g2.id AND gt1.team_id = m.home_team_id
                INNER JOIN group_teams gt2 ON gt2.group_id = g2.id AND gt2.team_id = m.away_team_id
                LIMIT 1
            )) AS group_name
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        LEFT JOIN `groups` g ON g.id = m.group_id
        WHERE m.status = 'scheduled'
        ORDER BY m.match_date ASC
    ";

    $stmt = $conn->prepare($query);
    $stmt->execute();

    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);

    echo json_encode([
        "success" => true,
        "data" => $matches
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);

}