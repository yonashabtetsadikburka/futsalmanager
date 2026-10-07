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

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID giocatore mancante']);
    exit;
}

try {
    $check = $conn->prepare("SELECT id, team_id FROM players WHERE id = :id");
    $check->bindParam(":id", $data->id, PDO::PARAM_INT);
    $check->execute();
    $player = $check->fetch(PDO::FETCH_ASSOC);

    if (!$player) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Giocatore non trovato']);
        exit;
    }

    if ($player['team_id'] === null) {
        echo json_encode(['success' => true, 'message' => 'Giocatore non è in nessuna squadra']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE players SET team_id = NULL WHERE id = :id");
    $stmt->bindParam(":id", $data->id, PDO::PARAM_INT);
    $stmt->execute();

    RedisCache::invalidate("teams:*");
    RedisCache::invalidate("stats:*");

    echo json_encode(['success' => true, 'message' => 'Giocatore rimosso dalla squadra']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Errore database']);
}
?>
