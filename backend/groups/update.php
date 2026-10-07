<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->name) && strlen($data->name) > 100) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Nome troppo lungo (max 100 caratteri)"]);
    exit;
}

if (empty($data->id) || empty($data->name)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "id e name sono obbligatori"]);
    exit;
}

$id = intval($data->id);
$name = trim($data->name);

try {
    // Verifica esistenza
    $check = $conn->prepare("SELECT id, tournament_id FROM `groups` WHERE id = :id");
    $check->bindParam(":id", $id, PDO::PARAM_INT);
    $check->execute();
    $group = $check->fetch(PDO::FETCH_ASSOC);
    if (!$group) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Girone non trovato"]);
        exit;
    }

    // Verifica duplicato nome nello stesso torneo
    $dup = $conn->prepare("SELECT id FROM `groups` WHERE tournament_id = :tid AND name = :name AND id != :id");
    $dup->bindParam(":tid", $group['tournament_id'], PDO::PARAM_INT);
    $dup->bindParam(":name", $name, PDO::PARAM_STR);
    $dup->bindParam(":id", $id, PDO::PARAM_INT);
    $dup->execute();
    if ($dup->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Esiste già un girone con questo nome in questo torneo"]);
        exit;
    }

    $query = "UPDATE `groups` SET name = :name WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":name", $name, PDO::PARAM_STR);
    $stmt->bindParam(":id", $id, PDO::PARAM_INT);
    $stmt->execute();

    http_response_code(200);
    echo json_encode(["success" => true, "message" => "Girone aggiornato con successo"]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
