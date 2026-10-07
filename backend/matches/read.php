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
    $tournamentId = $_GET['tournament_id'] ?? null;

    if ($tournamentId) {
        $query = "
            SELECT
                matches.*,
                home.name AS home_team,
                away.name AS away_team,
                home.logo_url AS home_logo_url,
                away.logo_url AS away_logo_url,
                g.name AS group_name
            FROM matches
            INNER JOIN teams AS home ON matches.home_team_id = home.id
            INNER JOIN teams AS away ON matches.away_team_id = away.id
            LEFT JOIN `groups` g ON g.id = matches.group_id
            WHERE matches.tournament_id = :tournament_id
            ORDER BY g.name ASC, matches.match_date DESC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    } else {
        $query = "
            SELECT
                matches.*,
                home.name AS home_team,
                away.name AS away_team,
                home.logo_url AS home_logo_url,
                away.logo_url AS away_logo_url,
                g.name AS group_name
            FROM matches
            INNER JOIN teams AS home ON matches.home_team_id = home.id
            INNER JOIN teams AS away ON matches.away_team_id = away.id
            LEFT JOIN `groups` g ON g.id = matches.group_id
            ORDER BY g.name ASC, matches.match_date DESC
        ";
        $stmt = $conn->prepare($query);
    }

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