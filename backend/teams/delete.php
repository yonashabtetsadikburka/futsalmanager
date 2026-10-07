<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    echo json_encode([
        "success" => false,
        "message" => "ID mancante"
    ]);
    exit;
}

try {
    $conn->beginTransaction();

    $teamId = (int) $data->id;

    $delMatchPlayers = $conn->prepare("
        DELETE mp FROM match_players mp
        INNER JOIN matches m ON mp.match_id = m.id
        WHERE m.home_team_id = :id OR m.away_team_id = :id
    ");
    $delMatchPlayers->bindParam(":id", $teamId, PDO::PARAM_INT);
    $delMatchPlayers->execute();

    $delMatches = $conn->prepare("DELETE FROM matches WHERE home_team_id = :id OR away_team_id = :id");
    $delMatches->bindParam(":id", $teamId, PDO::PARAM_INT);
    $delMatches->execute();

    $unlinkPlayers = $conn->prepare("UPDATE players SET team_id = NULL WHERE team_id = :id");
    $unlinkPlayers->bindParam(":id", $teamId, PDO::PARAM_INT);
    $unlinkPlayers->execute();

    $deleteTeam = $conn->prepare("DELETE FROM teams WHERE id = :id");
    $deleteTeam->bindParam(":id", $teamId, PDO::PARAM_INT);
    $deleteTeam->execute();

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Squadra eliminata"
    ]);

} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
