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
$photoUrl = !empty($data->photo_url) ? trim($data->photo_url) : null;

try {
    $query = "
        INSERT INTO players (first_name, last_name, age, role, team_id, tournament_id, photo_url)
        VALUES (:first_name, :last_name, :age, :role, :team_id, :tournament_id, :photo_url)
    ";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":first_name", $firstName);
    $stmt->bindParam(":last_name", $lastName);
    $stmt->bindParam(":age", $age, PDO::PARAM_INT);
    $stmt->bindParam(":role", $role);
    $stmt->bindParam(":team_id", $teamId, PDO::PARAM_INT);
    $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    $stmt->bindParam(":photo_url", $photoUrl);
    $stmt->execute();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Giocatore creato con successo",
        "id" => $conn->lastInsertId()
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    error_log('Player create error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Errore database: ' . $e->getMessage()]);
}
?>
