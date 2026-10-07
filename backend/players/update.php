<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo non consentito']);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->tournament_id)) {
    requireTournamentOwnership(intval($data->tournament_id));
}

if (!empty($data->first_name) && strlen($data->first_name) > 100) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Nome troppo lungo (max 100 caratteri)"]);
    exit;
}
if (!empty($data->last_name) && strlen($data->last_name) > 100) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Cognome troppo lungo (max 100 caratteri)"]);
    exit;
}
if (!empty($data->role) && strlen($data->role) > 50) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Ruolo troppo lungo (max 50 caratteri)"]);
    exit;
}

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID giocatore mancante']);
    exit;
}

if (empty($data->first_name) || empty($data->last_name)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nome e cognome sono obbligatori']);
    exit;
}

$firstName = trim($data->first_name);
$lastName = trim($data->last_name);
$age = !empty($data->age) ? (int)$data->age : null;
$role = !empty($data->role) ? trim($data->role) : null;
$teamId = !empty($data->team_id) ? (int)$data->team_id : null;
$tournamentId = !empty($data->tournament_id) ? (int)$data->tournament_id : null;

try {
    $updateFields = [
        "first_name = :first_name",
        "last_name = :last_name",
        "age = :age",
        "role = :role",
        "team_id = :team_id",
        "tournament_id = :tournament_id"
    ];
    $updateParams = [
        ":first_name" => $firstName,
        ":last_name" => $lastName,
        ":age" => $age,
        ":role" => $role,
        ":team_id" => $teamId,
        ":tournament_id" => $tournamentId,
        ":id" => $data->id
    ];

    if (property_exists($data, 'photo_url')) {
        $updateFields[] = "photo_url = :photo_url";
        $updateParams[":photo_url"] = !empty($data->photo_url) ? trim($data->photo_url) : null;
    }

    $query = "UPDATE players SET " . implode(", ", $updateFields) . " WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->execute($updateParams);

    echo json_encode(['success' => true, 'message' => 'Giocatore aggiornato']);

} catch (PDOException $e) {
    http_response_code(500);
    error_log('Player update error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Errore database: ' . $e->getMessage()]);
}
?>
