<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Connessione database non disponibile"
    ]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->tournament_id)) {
    requireTournamentOwnership(intval($data->tournament_id));
}

if (!empty($data->name) && strlen($data->name) > 100) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Nome troppo lungo (max 100 caratteri)"]);
    exit;
}
if (property_exists($data, 'logo_url') && !empty($data->logo_url) && strlen($data->logo_url) > 500) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "URL logo troppo lungo (max 500 caratteri)"]);
    exit;
}

// Validate logo_url safety
if (property_exists($data, 'logo_url') && !empty($data->logo_url)) {
    $logoUrl = trim($data->logo_url);
    // Block dangerous URI schemes
    if (preg_match('/^(javascript|data|vbscript):/i', $logoUrl)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "URL del logo non valido"]);
        exit;
    }
    // Ensure it's a relative path or starts with /uploads/
    if (!empty($logoUrl) && !preg_match('/^(\/|uploads\/|https?:\/\/)/', $logoUrl)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "URL del logo non valido"]);
        exit;
    }
}

if (empty($data->id)) {
    echo json_encode([
        "success" => false,
        "message" => "ID squadra mancante"
    ]);
    exit;
}

try {
    $teamId = $data->id;

    // Verifica che la squadra esista
    $checkQuery = "SELECT id, tournament_id FROM teams WHERE id = :id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(":id", $teamId, PDO::PARAM_INT);
    $checkStmt->execute();
    $team = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$team) {
        echo json_encode([
            "success" => false,
            "message" => "Squadra non trovata"
        ]);
        exit;
    }

    // Se si sta rimuovendo dal torneo (tournament_id = null)
    if (isset($data->tournament_id) && $data->tournament_id === null) {
        // Permetti la rimozione anche con partite terminate
        // La classifica verrà ripristinata dalla delete delle partite se necessario
    }

    // Se si sta assegnando a un torneo (non rimozione)
    if (isset($data->tournament_id) && $data->tournament_id !== null) {
        $newTournamentId = $data->tournament_id;

        // Verifica che il torneo esista
        $tournamentQuery = "SELECT id, type FROM tournaments WHERE id = :tournament_id";
        $tournamentStmt = $conn->prepare($tournamentQuery);
        $tournamentStmt->bindParam(":tournament_id", $newTournamentId, PDO::PARAM_INT);
        $tournamentStmt->execute();
        $tournament = $tournamentStmt->fetch(PDO::FETCH_ASSOC);

        if (!$tournament) {
            echo json_encode([
                "success" => false,
                "message" => "Torneo non trovato"
            ]);
            exit;
        }

        // Se il torneo è diverso, verifica che non ci siano partite terminate
        if ($team['tournament_id'] !== null && $team['tournament_id'] != $newTournamentId) {
            $activeQuery = "SELECT id FROM matches WHERE (home_team_id = :team_id OR away_team_id = :team_id) AND tournament_id = :old_tournament_id AND status = 'finished'";
            $activeStmt = $conn->prepare($activeQuery);
            $activeStmt->bindParam(":team_id", $teamId, PDO::PARAM_INT);
            $activeStmt->bindParam(":old_tournament_id", $team['tournament_id'], PDO::PARAM_INT);
            $activeStmt->execute();
            $hasFinishedMatches = $activeStmt->fetch();

            if ($hasFinishedMatches) {
                echo json_encode([
                    "success" => false,
                    "message" => "La squadra ha partite terminate nel torneo attuale. Impossibile trasferire."
                ]);
                exit;
            }
        }
    }

    // Aggiorna la squadra
    $updateFields = ["tournament_id = :tournament_id"];
    $updateParams = [":tournament_id" => $data->tournament_id ?? null, ":id" => $teamId];

    if (property_exists($data, 'logo_url')) {
        $updateFields[] = "logo_url = :logo_url";
        $updateParams[":logo_url"] = $data->logo_url;
    }
    if (!empty($data->name)) {
        $updateFields[] = "name = :name";
        $updateParams[":name"] = $data->name;
    }
    if (property_exists($data, 'coach_id')) {
        $updateFields[] = "coach_id = :coach_id";
        $updateParams[":coach_id"] = $data->coach_id;
    }
    if (property_exists($data, 'photo_url')) {
        $updateFields[] = "photo_url = :photo_url";
        $updateParams[":photo_url"] = !empty($data->photo_url) ? trim($data->photo_url) : null;
    }

    $query = "UPDATE teams SET " . implode(", ", $updateFields) . " WHERE id = :id";
    $stmt = $conn->prepare($query);

    if ($stmt->execute($updateParams)) {
        RedisCache::invalidate("teams:*");
        RedisCache::invalidate("stats:*");
        echo json_encode([
            "success" => true,
            "message" => "Squadra aggiornata con successo"
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Errore aggiornamento squadra"
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