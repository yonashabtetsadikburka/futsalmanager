<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
// CORS handled by cors.php

require_once __DIR__ . "/../config/database.php";

if (!$conn) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Connessione database non disponibile"]);
    exit;
}

$teamId = $_GET['team_id'] ?? null;
$free = $_GET['free'] ?? null;
$tournamentId = $_GET['tournament_id'] ?? null;

try {
    if ($tournamentId) {
        $query = "
            SELECT players.*, teams.name AS team_name, tournaments.name AS tournament_name
            FROM players
            LEFT JOIN teams ON players.team_id = teams.id
            LEFT JOIN tournaments ON teams.tournament_id = tournaments.id
            WHERE players.tournament_id = :tournament_id
            ORDER BY players.last_name ASC, players.first_name ASC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":tournament_id", $tournamentId, PDO::PARAM_INT);
    } elseif ($teamId) {
        $query = "
            SELECT players.*, teams.name AS team_name, tournaments.name AS tournament_name
            FROM players
            LEFT JOIN teams ON players.team_id = teams.id
            LEFT JOIN tournaments ON teams.tournament_id = tournaments.id
            WHERE players.team_id = :team_id
            ORDER BY players.created_at DESC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":team_id", $teamId, PDO::PARAM_INT);
    } elseif ($free) {
        $query = "
            SELECT players.*, NULL AS team_name, NULL AS tournament_name
            FROM players
            WHERE players.team_id IS NULL
            ORDER BY players.last_name ASC, players.first_name ASC
        ";
        $stmt = $conn->prepare($query);
    } else {
        $query = "
            SELECT players.*, teams.name AS team_name, tournaments.name AS tournament_name
            FROM players
            LEFT JOIN teams ON players.team_id = teams.id
            LEFT JOIN tournaments ON teams.tournament_id = tournaments.id
            ORDER BY tournaments.name ASC, players.last_name ASC, players.first_name ASC
        ";
        $stmt = $conn->prepare($query);
    }
    $stmt->execute();
    $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode(["success" => true, "data" => $players]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore database"]);
}
?>
