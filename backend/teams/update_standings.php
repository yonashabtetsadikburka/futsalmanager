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

if (empty($data->id)) {
    echo json_encode(["success" => false, "message" => "ID squadra mancante"]);
    exit;
}

try {
    $teamId = $data->id;

    $checkQuery = "SELECT id FROM teams WHERE id = :id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(":id", $teamId, PDO::PARAM_INT);
    $checkStmt->execute();

    if (!$checkStmt->fetch()) {
        echo json_encode(["success" => false, "message" => "Squadra non trovata"]);
        exit;
    }

    $fields = [];
    $params = [":id" => $teamId];

    $allowedFields = ['points', 'wins', 'draws', 'losses', 'goals_scored', 'goals_conceded'];

    foreach ($allowedFields as $field) {
        if (isset($data->$field)) {
            $val = (int) $data->$field;
            if ($val < 0) {
                $labelMap = [
                    'points' => 'Punti',
                    'wins' => 'Vittorie',
                    'draws' => 'Pareggi',
                    'losses' => 'Sconfitte',
                    'goals_scored' => 'Gol fatti',
                    'goals_conceded' => 'Gol subiti'
                ];
                $label = $labelMap[$field] ?? $field;
                echo json_encode(["success" => false, "message" => "Il valore di $label non puo essere negativo"]);
                exit;
            }
            $fields[] = "$field = :$field";
            $params[":$field"] = $val;
        }
    }

    if (empty($fields)) {
        echo json_encode(["success" => false, "message" => "Nessun campo da aggiornare"]);
        exit;
    }

    $query = "UPDATE teams SET " . implode(", ", $fields) . " WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->execute($params);

    echo json_encode(["success" => true, "message" => "Classifica aggiornata con successo"]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>