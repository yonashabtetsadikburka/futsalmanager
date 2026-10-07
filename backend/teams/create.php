<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo non consentito']);
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
if (!empty($data->logo_url) && strlen($data->logo_url) > 500) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "URL logo troppo lungo (max 500 caratteri)"]);
    exit;
}

// Validate logo_url safety
if (!empty($data->logo_url)) {
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

if (
    empty($data->name) ||
    empty($data->coach_id)
) {

    echo json_encode([
        "success" => false,
        "message" => "Nome squadra e allenatore obbligatori"
    ]);

    exit;
}

try {

    $conn->beginTransaction();

    // Se viene specificato un torneo, verifica limiti
    if (!empty($data->tournament_id)) {
        // 1. Verifica che la squadra non sia già in un altro torneo attivo
        $checkQuery = "
            SELECT t.id, t.name, tut.name as tournament_name
            FROM teams t
            INNER JOIN tournaments tut ON t.tournament_id = tut.id
            WHERE t.name = :name 
            AND t.tournament_id != :tournament_id
            AND tut.status = 'active'
            LIMIT 1
        ";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->bindParam(":name", $data->name);
        $checkStmt->bindParam(":tournament_id", $data->tournament_id, PDO::PARAM_INT);
        $checkStmt->execute();

        if ($checkStmt->fetch()) {
            $conn->rollBack();
            echo json_encode([
                "success" => false,
                "message" => "Una squadra con questo nome partecipa già a un altro torneo attivo"
            ]);
            exit;
        }

        // 2. Verifica limite giocatori per tipo torneo
        $typeQuery = "SELECT type FROM tournaments WHERE id = :id";
        $typeStmt = $conn->prepare($typeQuery);
        $typeStmt->bindParam(":id", $data->tournament_id, PDO::PARAM_INT);
        $typeStmt->execute();
        $tournament = $typeStmt->fetch(PDO::FETCH_ASSOC);

        if ($tournament && !empty($data->players)) {
            $maxPlayers = $tournament['type'] === '5v5' ? 6 : 8;
            if (count($data->players) > $maxPlayers) {
                $conn->rollBack();
                echo json_encode([
                    "success" => false,
                    "message" => "Troppi giocatori: massimo $maxPlayers per torneo " . $tournament['type']
                ]);
                exit;
            }
        }
    }

    // CREA SQUADRA
    $query = "
    INSERT INTO teams
    (name, coach_id, tournament_id, logo_url, photo_url)
    VALUES
    (:name, :coach_id, :tournament_id, :logo_url, :photo_url)
    ";

    $stmt = $conn->prepare($query);

    $stmt->bindParam(":name", $data->name);
    $stmt->bindParam(":coach_id", $data->coach_id);
    $stmt->bindParam(":tournament_id", $data->tournament_id);
    $logoUrl = $data->logo_url ?? null;
    $stmt->bindParam(":logo_url", $logoUrl);
    $photoUrl = $data->photo_url ?? null;
    $stmt->bindParam(":photo_url", $photoUrl);

    $stmt->execute();

    $teamId = $conn->lastInsertId();

    // AGGIORNA GIOCATORI
    if(!empty($data->players)){

        // Verifica che nessun giocatore sia già in un'altra squadra
        $placeholders = implode(',', array_fill(0, count($data->players), '?'));
        $checkPlayersQuery = "
            SELECT id, first_name, last_name, team_id 
            FROM players 
            WHERE id IN ($placeholders) AND team_id IS NOT NULL
        ";
        $checkPlayersStmt = $conn->prepare($checkPlayersQuery);
        foreach ($data->players as $i => $playerId) {
            $checkPlayersStmt->bindValue($i + 1, $playerId, PDO::PARAM_INT);
        }
        $checkPlayersStmt->execute();
        $assignedPlayers = $checkPlayersStmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($assignedPlayers)) {
            $names = array_map(function($p) { return $p['first_name'] . ' ' . $p['last_name']; }, $assignedPlayers);
            $conn->rollBack();
            echo json_encode([
                "success" => false,
                "message" => "I seguenti giocatori sono già assegnati a un'altra squadra: " . implode(', ', $names)
            ]);
            exit;
        }

        foreach($data->players as $playerId){

            $updatePlayer = "
            UPDATE players
            SET team_id = :team_id
            WHERE id = :player_id
            ";

            $playerStmt = $conn->prepare($updatePlayer);

            $playerStmt->bindParam(":team_id", $teamId);
            $playerStmt->bindParam(":player_id", $playerId);

            $playerStmt->execute();
        }
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Squadra creata con successo"
    ]);

} catch(PDOException $e){

    $conn->rollBack();

    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
?>
