<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo non consentito']);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID giocatore mancante']);
    exit;
}

try {
    $stmt = $conn->prepare("DELETE FROM players WHERE id = :id");
    $stmt->bindParam(":id", $data->id, PDO::PARAM_INT);
    $stmt->execute();

    echo json_encode(['success' => true, 'message' => 'Giocatore eliminato']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Errore database']);
}
?>
