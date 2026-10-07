<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

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

try {

    $stmt = $conn->prepare("
        UPDATE matches m
        INNER JOIN group_teams gt1 ON gt1.team_id = m.home_team_id
        INNER JOIN group_teams gt2 ON gt2.team_id = m.away_team_id AND gt2.group_id = gt1.group_id
        SET m.group_id = gt1.group_id
        WHERE m.group_id IS NULL
    ");

    $stmt->execute();
    $updated = $stmt->rowCount();

    echo json_encode([
        "success" => true,
        "message" => "Aggiornate $updated partite con group_id corretto",
        "updated" => $updated
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);

}
?>
