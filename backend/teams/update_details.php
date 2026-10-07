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

if (isset($data->name) && strlen($data->name) > 100) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Nome troppo lungo (max 100 caratteri)"]);
    exit;
}

if (empty($data->id)) {
    echo json_encode(["success" => false, "message" => "ID squadra mancante"]);
    exit;
}

try {
    $teamId = (int) $data->id;

    // Verifica che la squadra esista
    $checkQuery = "SELECT id, name, coach_id, tournament_id FROM teams WHERE id = :id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindValue(":id", $teamId, PDO::PARAM_INT);
    $checkStmt->execute();
    $team = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$team) {
        echo json_encode(["success" => false, "message" => "Squadra non trovata"]);
        exit;
    }

    requireTournamentOwnership(intval($team['tournament_id']));

    $conn->beginTransaction();

    // Determina il torneo effettivo (quello nuovo se fornito, altrimenti quello attuale)
    $effectiveTournamentId = $team['tournament_id'];
    if (isset($data->tournament_id) && $data->tournament_id !== null) {
        $newTournamentId = (int) $data->tournament_id;

        // Verifica che il torneo esista
        $tournamentCheck = $conn->prepare("SELECT id FROM tournaments WHERE id = :id");
        $tournamentCheck->bindValue(":id", $newTournamentId, PDO::PARAM_INT);
        $tournamentCheck->execute();
        if (!$tournamentCheck->fetch()) {
            $conn->rollBack();
            echo json_encode(["success" => false, "message" => "Torneo non trovato"]);
            exit;
        }

        // Aggiorna il torneo della squadra
        $updateTournament = $conn->prepare("UPDATE teams SET tournament_id = :tournament_id WHERE id = :id");
        $updateTournament->bindValue(":tournament_id", $newTournamentId, PDO::PARAM_INT);
        $updateTournament->bindValue(":id", $teamId, PDO::PARAM_INT);
        $updateTournament->execute();

        $effectiveTournamentId = $newTournamentId;
    }

    // Aggiorna nome se fornito
    if (isset($data->name) && trim($data->name) !== '') {
        $newName = trim($data->name);

        // Verifica unicit del nome nel torneo effettivo
        $nameCheck = $conn->prepare("
            SELECT id FROM teams 
            WHERE name = :name AND tournament_id = :tournament_id AND id != :id
        ");
        $nameCheck->bindValue(":name", $newName);
        $nameCheck->bindValue(":tournament_id", $effectiveTournamentId, PDO::PARAM_INT);
        $nameCheck->bindValue(":id", $teamId, PDO::PARAM_INT);
        $nameCheck->execute();

        if ($nameCheck->fetch()) {
            $conn->rollBack();
            echo json_encode(["success" => false, "message" => "Esiste già una squadra con questo nome in questo torneo"]);
            exit;
        }

        $updateName = $conn->prepare("UPDATE teams SET name = :name WHERE id = :id");
        $updateName->bindValue(":name", $newName);
        $updateName->bindValue(":id", $teamId, PDO::PARAM_INT);
        $updateName->execute();
    }

    // Aggiorna allenatore se fornito
    if (isset($data->coach_id) && $data->coach_id !== null) {
        $updateCoach = $conn->prepare("UPDATE teams SET coach_id = :coach_id WHERE id = :id");
        $updateCoach->bindValue(":coach_id", (int) $data->coach_id, PDO::PARAM_INT);
        $updateCoach->bindValue(":id", $teamId, PDO::PARAM_INT);
        $updateCoach->execute();
    }

    // Aggiorna giocatori se forniti
    if (isset($data->players) && is_array($data->players)) {
        // Rimuovi tutti i giocatori attuali da questa squadra
        $removePlayers = $conn->prepare("UPDATE players SET team_id = NULL WHERE team_id = :team_id");
        $removePlayers->bindValue(":team_id", $teamId, PDO::PARAM_INT);
        $removePlayers->execute();

        // Verifica che nessun giocatore selezionato sia già in un'altra squadra dello stesso torneo
        if (!empty($data->players)) {
            $namedParams = [];
            foreach ($data->players as $i => $pid) {
                $namedParams[':pid' . $i] = (int) $pid;
            }
            $placeholders = implode(',', array_keys($namedParams));

            $checkPlayers = $conn->prepare("
                SELECT p.id, p.first_name, p.last_name FROM players p
                JOIN teams t ON p.team_id = t.id
                WHERE p.id IN ($placeholders) AND p.team_id IS NOT NULL AND p.team_id != :team_id AND t.tournament_id = :tournament_id
            ");
            foreach ($namedParams as $key => $val) {
                $checkPlayers->bindValue($key, $val, PDO::PARAM_INT);
            }
            $checkPlayers->bindValue(":team_id", $teamId, PDO::PARAM_INT);
            $checkPlayers->bindValue(":tournament_id", $effectiveTournamentId, PDO::PARAM_INT);
            $checkPlayers->execute();
            $assigned = $checkPlayers->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($assigned)) {
                $conn->rollBack();
                $names = array_map(function($p) { return $p['first_name'] . ' ' . $p['last_name']; }, $assigned);
                echo json_encode([
                    "success" => false,
                    "message" => "Giocatori già in un'altra squadra di questo torneo: " . implode(', ', $names)
                ]);
                exit;
            }

            // Assegna i giocatori
            $assignPlayer = $conn->prepare("UPDATE players SET team_id = :team_id WHERE id = :player_id");
            foreach ($data->players as $pid) {
                $assignPlayer->bindValue(":team_id", $teamId, PDO::PARAM_INT);
                $assignPlayer->bindValue(":player_id", (int) $pid, PDO::PARAM_INT);
                $assignPlayer->execute();
            }
        }
    }

    $conn->commit();

    echo json_encode(["success" => true, "message" => "Squadra aggiornata con successo"]);

} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>