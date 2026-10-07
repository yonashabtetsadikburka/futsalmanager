<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "ID mancante"
    ]);
    exit;
}

try {
    $coachId = (int) $data->id;

    // Check if coach is assigned to any team
    $checkStmt = $conn->prepare("SELECT id, name FROM teams WHERE coach_id = :id");
    $checkStmt->bindParam(":id", $coachId, PDO::PARAM_INT);
    $checkStmt->execute();
    $teams = $checkStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($teams) > 0) {
        $teamNames = array_column($teams, 'name');
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Impossibile eliminare: l'allenatore è assegnato alla/e squadra/e (" . implode(', ', $teamNames) . "). Rimuovilo prima dalle squadre."
        ]);
        exit;
    }

    $deleteStmt = $conn->prepare("DELETE FROM users WHERE id = :id AND role = 'coach'");
    $deleteStmt->bindParam(":id", $coachId, PDO::PARAM_INT);
    $deleteStmt->execute();

    if ($deleteStmt->rowCount() > 0) {
        echo json_encode([
            "success" => true,
            "message" => "Allenatore eliminato"
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Allenatore non trovato"
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
