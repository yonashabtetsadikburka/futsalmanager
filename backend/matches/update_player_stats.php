<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->match_id) && $data->match_id !== 0) {
    echo json_encode([
        "success" => false,
        "message" => "ID partita mancante"
    ]);
    exit;
}

if (empty($data->players) || !is_array($data->players)) {
    echo json_encode([
        "success" => false,
        "message" => "Nessun giocatore fornito"
    ]);
    exit;
}

try {
    // Verifica che la partita esista e sia terminata
    $checkQuery = "SELECT id, status, home_team_id, away_team_id, home_score, away_score, home_extra_time, away_extra_time FROM matches WHERE id = :id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindValue(":id", $data->match_id, PDO::PARAM_INT);
    $checkStmt->execute();

    $match = $checkStmt->fetch(PDO::FETCH_ASSOC);
    if (!$match) {
        echo json_encode([
            "success" => false,
            "message" => "Partita non trovata"
        ]);
        exit;
    }

    if ($match['status'] !== 'finished') {
        echo json_encode([
            "success" => false,
            "message" => "La partita non è ancora terminata"
        ]);
        exit;
    }

    // Validazione: la somma dei gol deve corrispondere al risultato
    $homeTeamId = (int)$match['home_team_id'];
    $awayTeamId = (int)$match['away_team_id'];
    $homeScore = (int)$match['home_score'];
    $awayScore = (int)$match['away_score'];

    // Per partite KO, i gol totali = gol regolare + gol supplementari (rigori esclusi)
    if ($match['home_extra_time'] !== null && $match['away_extra_time'] !== null) {
        $homeScore += (int)$match['home_extra_time'];
        $awayScore += (int)$match['away_extra_time'];
    }

    $teamPlayersQuery = "SELECT id, team_id FROM players WHERE team_id IN (:home_id, :away_id)";
    $teamPlayersStmt = $conn->prepare($teamPlayersQuery);
    $teamPlayersStmt->bindParam(":home_id", $homeTeamId, PDO::PARAM_INT);
    $teamPlayersStmt->bindParam(":away_id", $awayTeamId, PDO::PARAM_INT);
    $teamPlayersStmt->execute();
    $teamPlayers = $teamPlayersStmt->fetchAll(PDO::FETCH_ASSOC);

    $homePlayerIds = [];
    $awayPlayerIds = [];
    foreach ($teamPlayers as $tp) {
        if ((int)$tp['team_id'] === $homeTeamId) {
            $homePlayerIds[] = (int)$tp['id'];
        } else {
            $awayPlayerIds[] = (int)$tp['id'];
        }
    }

    $homeGoalsSum = 0;
    $awayGoalsSum = 0;
    foreach ($data->players as $player) {
        $playerId = isset($player->player_id) ? (int)$player->player_id : 0;
        $goals = isset($player->goals) ? (int)$player->goals : 0;
        if (in_array($playerId, $homePlayerIds)) {
            $homeGoalsSum += $goals;
        } elseif (in_array($playerId, $awayPlayerIds)) {
            $awayGoalsSum += $goals;
        }
    }

    if ($homeGoalsSum !== $homeScore) {
        echo json_encode([
            "success" => false,
            "message" => "La somma dei gol dei giocatori di casa ($homeGoalsSum) non corrisponde al risultato ($homeScore)"
        ]);
        exit;
    }

    if ($awayGoalsSum !== $awayScore) {
        echo json_encode([
            "success" => false,
            "message" => "La somma dei gol dei giocatori fuori ($awayGoalsSum) non corrisponde al risultato ($awayScore)"
        ]);
        exit;
    }

    $conn->beginTransaction();

    // Prima recupera le stats vecchie per calcolare la differenza
    $oldStats = [];
    foreach ($data->players as $player) {
        $playerId = isset($player->player_id) ? (int) $player->player_id : 0;
        if ($playerId <= 0) continue;

        $checkOld = $conn->prepare("SELECT goals, assists FROM match_players WHERE match_id = :match_id AND player_id = :player_id");
        $checkOld->bindValue(":match_id", (int) $data->match_id, PDO::PARAM_INT);
        $checkOld->bindValue(":player_id", $playerId, PDO::PARAM_INT);
        $checkOld->execute();
        $oldRow = $checkOld->fetch(PDO::FETCH_ASSOC);
        $oldStats[$playerId] = $oldRow ? ['goals' => (int)$oldRow['goals'], 'assists' => (int)$oldRow['assists']] : ['goals' => 0, 'assists' => 0];
    }

    foreach ($data->players as $player) {
        $playerId = isset($player->player_id) ? (int) $player->player_id : 0;
        if ($playerId <= 0) continue;

        $goals = isset($player->goals) ? (int) $player->goals : 0;
        $assists = isset($player->assists) ? (int) $player->assists : 0;

        $upsertQuery = "
        INSERT INTO match_players (match_id, player_id, goals, assists)
        VALUES (:match_id, :player_id, :goals, :assists)
        ON DUPLICATE KEY UPDATE goals = VALUES(goals), assists = VALUES(assists)
        ";
        $stmt = $conn->prepare($upsertQuery);
        $stmt->bindValue(":match_id", (int) $data->match_id, PDO::PARAM_INT);
        $stmt->bindValue(":player_id", $playerId, PDO::PARAM_INT);
        $stmt->bindValue(":goals", $goals, PDO::PARAM_INT);
        $stmt->bindValue(":assists", $assists, PDO::PARAM_INT);
        $stmt->execute();

        // Aggiorna i totali nella tabella players con la differenza
        $old = $oldStats[$playerId] ?? ['goals' => 0, 'assists' => 0];
        $diffGoals = $goals - $old['goals'];
        $diffAssists = $assists - $old['assists'];

        if ($diffGoals != 0 || $diffAssists != 0) {
            $updatePlayer = "
            UPDATE players
            SET goals = goals + :goals, assists = assists + :assists
            WHERE id = :id
            ";
            $stmt = $conn->prepare($updatePlayer);
            $stmt->bindValue(":goals", $diffGoals, PDO::PARAM_INT);
            $stmt->bindValue(":assists", $diffAssists, PDO::PARAM_INT);
            $stmt->bindValue(":id", $playerId, PDO::PARAM_INT);
            $stmt->execute();
        }
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Statistiche aggiornate con successo"
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
?>