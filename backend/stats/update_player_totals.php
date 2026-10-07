<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if (!$conn) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Connessione database non disponibile"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->player_id)) {
    echo json_encode(["success" => false, "message" => "ID giocatore mancante"]);
    exit;
}

if (!isset($data->goals) || !isset($data->assists)) {
    echo json_encode(["success" => false, "message" => "Valori goals e assists obbligatori"]);
    exit;
}

try {
    $playerId = (int) $data->player_id;
    $newGoals = (int) $data->goals;
    $newAssists = (int) $data->assists;

    $checkQuery = "SELECT id, goals, assists FROM players WHERE id = :id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(":id", $playerId, PDO::PARAM_INT);
    $checkStmt->execute();
    $player = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$player) {
        echo json_encode(["success" => false, "message" => "Giocatore non trovato"]);
        exit;
    }

    $oldGoals = isset($player['goals']) ? (int) $player['goals'] : 0;
    $oldAssists = isset($player['assists']) ? (int) $player['assists'] : 0;

    $diffGoals = $newGoals - $oldGoals;
    $diffAssists = $newAssists - $oldAssists;

    $conn->beginTransaction();

    $updatePlayer = $conn->prepare("
        UPDATE players SET goals = :goals, assists = :assists WHERE id = :id
    ");
    $updatePlayer->bindParam(":goals", $newGoals, PDO::PARAM_INT);
    $updatePlayer->bindParam(":assists", $newAssists, PDO::PARAM_INT);
    $updatePlayer->bindParam(":id", $playerId, PDO::PARAM_INT);
    $updatePlayer->execute();

    if ($diffGoals != 0 || $diffAssists != 0) {
        $lastMatchStmt = $conn->prepare("
            SELECT mp.id, mp.goals, mp.assists
            FROM match_players mp
            JOIN matches m ON mp.match_id = m.id
            WHERE mp.player_id = :player_id AND m.status = 'finished'
            ORDER BY m.match_date DESC
            LIMIT 1
        ");
        $lastMatchStmt->bindParam(":player_id", $playerId, PDO::PARAM_INT);
        $lastMatchStmt->execute();
        $lastRecord = $lastMatchStmt->fetch(PDO::FETCH_ASSOC);

        if ($lastRecord) {
            $adjustedGoals = max(0, (int) $lastRecord['goals'] + $diffGoals);
            $adjustedAssists = max(0, (int) $lastRecord['assists'] + $diffAssists);

            $updateMP = $conn->prepare("
                UPDATE match_players SET goals = :goals, assists = :assists WHERE id = :id
            ");
            $updateMP->bindParam(":goals", $adjustedGoals, PDO::PARAM_INT);
            $updateMP->bindParam(":assists", $adjustedAssists, PDO::PARAM_INT);
            $updateMP->bindParam(":id", $lastRecord['id'], PDO::PARAM_INT);
            $updateMP->execute();
        }
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Statistiche aggiornate con successo",
        "data" => [
            "goals" => $newGoals,
            "assists" => $newAssists
        ]
    ]);

} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>