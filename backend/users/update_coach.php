<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER["REQUEST_METHOD"] !== "PUT") {
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

if (empty($data->id) || empty($data->first_name) || empty($data->last_name)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "ID, nome e cognome sono obbligatori"
    ]);
    exit;
}

$coachId = (int) $data->id;
$first_name = trim($data->first_name);
$last_name = trim($data->last_name);

try {
    // Check if coach exists
    $checkStmt = $conn->prepare("SELECT id FROM users WHERE id = :id AND role = 'coach'");
    $checkStmt->bindParam(":id", $coachId, PDO::PARAM_INT);
    $checkStmt->execute();

    if (!$checkStmt->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Allenatore non trovato"
        ]);
        exit;
    }

    // Generate new username
    $newUsername = strtolower($first_name . '.' . $last_name);
    $newEmail = $newUsername . '@futsalmanager.local';

    // Check if new username conflicts with another user
    $usernameCheck = $conn->prepare("SELECT id FROM users WHERE username = :username AND id != :id");
    $usernameCheck->bindParam(":username", $newUsername);
    $usernameCheck->bindParam(":id", $coachId, PDO::PARAM_INT);
    $usernameCheck->execute();

    if ($usernameCheck->fetch(PDO::FETCH_ASSOC)) {
        $newUsername = $newUsername . '1';
        $newEmail = $newUsername . '@futsalmanager.local';
    }

    $updateStmt = $conn->prepare("
        UPDATE users
        SET first_name = :first_name, last_name = :last_name, username = :username, email = :email
        WHERE id = :id
    ");
    $updateStmt->bindParam(":first_name", $first_name);
    $updateStmt->bindParam(":last_name", $last_name);
    $updateStmt->bindParam(":username", $newUsername);
    $updateStmt->bindParam(":email", $newEmail);
    $updateStmt->bindParam(":id", $coachId, PDO::PARAM_INT);

    $updateStmt->execute();

    echo json_encode([
        "success" => true,
        "message" => "Allenatore aggiornato con successo"
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
