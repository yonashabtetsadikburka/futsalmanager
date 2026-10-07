<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
// CORS handled by cors.php

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Connessione database non disponibile"
    ]);
    exit;
}

$tournamentId = $_GET['tournament_id'] ?? null;

if ($tournamentId) {
    requireTournamentOwnership(intval($tournamentId));
}

try {
    if ($tournamentId) {
        $query = "SELECT id, first_name, last_name
                  FROM users
                  WHERE role = 'coach' AND tournament_id = :tournament_id
                  ORDER BY last_name ASC, first_name ASC";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    } else {
        $query = "SELECT id, first_name, last_name FROM users WHERE role = 'coach' ORDER BY last_name ASC, first_name ASC";
        $stmt = $conn->prepare($query);
    }
    $stmt->execute();
    $coaches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $coaches
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore database"
    ]);
}
?>
