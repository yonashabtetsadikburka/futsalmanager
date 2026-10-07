<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Metodo non consentito"
    ]);
    exit;
}

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Connessione database non disponibile"
    ]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

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

if (
    empty($data->first_name) ||
    empty($data->last_name)
) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Nome e cognome sono obbligatori"
    ]);
    exit;
}

$first_name = trim($data->first_name);
$last_name = trim($data->last_name);
$tournamentId = !empty($data->tournament_id) ? (int)$data->tournament_id : null;

if ($tournamentId !== null) {
    requireTournamentOwnership($tournamentId);
}

$role = "coach";

// Genera username dal nome e cognome
$username = strtolower($first_name . '.' . $last_name);
$email = $username . '@futsalmanager.local';

// Genera password casuale sicura
$rawPassword = bin2hex(random_bytes(8));
$password = password_hash($rawPassword, PASSWORD_BCRYPT);

try {

    // Controllo username già esistente
    $checkQuery = "
        SELECT id
        FROM users
        WHERE username = :username
        LIMIT 1
    ";

    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(":username", $username);
    $checkStmt->execute();

    if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {
        // Aggiungi un numero se lo username esiste già
        $username = $username . '1';
        $email = $username . '@futsalmanager.local';
    }

    $query = "
        INSERT INTO users
        (username, email, password, role, first_name, last_name, tournament_id)
        VALUES
        (:username, :email, :password, :role, :first_name, :last_name, :tournament_id)
    ";

    $stmt = $conn->prepare($query);

    $stmt->bindParam(":username", $username);
    $stmt->bindParam(":email", $email);
    $stmt->bindParam(":password", $password);
    $stmt->bindParam(":role", $role);
    $stmt->bindParam(":first_name", $first_name);
    $stmt->bindParam(":last_name", $last_name);
    $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);

    $stmt->execute();

    http_response_code(201);

    echo json_encode([
        "success" => true,
        "message" => "Allenatore creato con successo",
        "id" => $conn->lastInsertId(),
        "username" => $username,
        "temp_password" => $rawPassword
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);

}
