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

if (empty($data->tournament_id) || empty($data->name)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "tournament_id e name sono obbligatori"]);
    exit;
}

requireTournamentOwnership(intval($data->tournament_id));

$name = trim($data->name);
$tournamentId = intval($data->tournament_id);

try {
    // Verifica che il torneo esista
    $check = $conn->prepare("SELECT id FROM tournaments WHERE id = :id");
    $check->bindParam(":id", $tournamentId, PDO::PARAM_INT);
    $check->execute();
    if ($check->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Torneo non trovato"]);
        exit;
    }

    // Verifica che il nome non sia duplicato per lo stesso torneo
    $dup = $conn->prepare("SELECT id FROM `groups` WHERE tournament_id = :tid AND name = :name");
    $dup->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $dup->bindParam(":name", $name, PDO::PARAM_STR);
    $dup->execute();
    if ($dup->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Esiste già un girone con questo nome in questo torneo"]);
        exit;
    }

    $query = "INSERT INTO `groups` (tournament_id, name) VALUES (:tournament_id, :name)";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    $stmt->bindParam(":name", $name, PDO::PARAM_STR);
    $stmt->execute();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Girone creato con successo",
        "id" => $conn->lastInsertId()
    ]);

    // Invalidate caches
    RedisCache::invalidate('groups:*');

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
