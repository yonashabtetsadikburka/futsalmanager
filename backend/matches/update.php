<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->match_id) && $data->match_id != 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "ID partita mancante"
    ]);
    exit;
}

if (empty($data->home_team_id) || empty($data->away_team_id) || empty($data->match_date)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Compila tutti i campi"
    ]);
    exit;
}

if ($data->home_team_id == $data->away_team_id) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Le squadre devono essere diverse"
    ]);
    exit;
}

try {
    // Verifica che la partita esista e sia pianificata
    $checkQuery = "SELECT id, tournament_id, status FROM matches WHERE id = :id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(":id", $data->match_id, PDO::PARAM_INT);
    $checkStmt->execute();
    $match = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Partita non trovata"
        ]);
        exit;
    }

    if ($match['status'] !== 'scheduled') {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Impossibile modificare una partita terminata"
        ]);
        exit;
    }

    // Verifica che le squadre appartengano al torneo della partita
    $tournamentId = $match['tournament_id'];

    $homeCheck = $conn->prepare("SELECT id FROM teams WHERE id = :id AND tournament_id = :tournament_id");
    $homeCheck->bindParam(":id", $data->home_team_id, PDO::PARAM_INT);
    $homeCheck->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    $homeCheck->execute();

    if (!$homeCheck->fetch()) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "La squadra casa non appartiene al torneo"
        ]);
        exit;
    }

    $awayCheck = $conn->prepare("SELECT id FROM teams WHERE id = :id AND tournament_id = :tournament_id");
    $awayCheck->bindParam(":id", $data->away_team_id, PDO::PARAM_INT);
    $awayCheck->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    $awayCheck->execute();

    if (!$awayCheck->fetch()) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "La squadra ospite non appartiene al torneo"
        ]);
        exit;
    }

    // Aggiorna la partita
    $updateQuery = "
    UPDATE matches
    SET
        home_team_id = :home_team_id,
        away_team_id = :away_team_id,
        match_date = :match_date
    WHERE id = :id
    ";

    $stmt = $conn->prepare($updateQuery);
    $stmt->bindParam(":home_team_id", $data->home_team_id, PDO::PARAM_INT);
    $stmt->bindParam(":away_team_id", $data->away_team_id, PDO::PARAM_INT);
    $stmt->bindParam(":match_date", $data->match_date);
    $stmt->bindParam(":id", $data->match_id, PDO::PARAM_INT);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Partita aggiornata con successo"
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Errore aggiornamento partita"
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
?>
