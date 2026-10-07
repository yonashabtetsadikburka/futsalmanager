<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$id = $_GET['id'] ?? null;
if (!$id) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "ID girone mancante"]);
    exit;
}

$id = intval($id);

try {
    // Verifica esistenza
    $check = $conn->prepare("SELECT id, name FROM `groups` WHERE id = :id");
    $check->bindParam(":id", $id, PDO::PARAM_INT);
    $check->execute();
    if ($check->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Girone non trovato"]);
        exit;
    }

    // group_teams viene eliminato via CASCADE
    // matches.group_id viene settato a NULL via ON DELETE SET NULL

    $query = "DELETE FROM `groups` WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":id", $id, PDO::PARAM_INT);
    $stmt->execute();

    http_response_code(200);
    echo json_encode(["success" => true, "message" => "Girone eliminato con successo"]);

    // Invalidate caches
    RedisCache::invalidate('groups:*');
    RedisCache::invalidate('matches:*');

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
