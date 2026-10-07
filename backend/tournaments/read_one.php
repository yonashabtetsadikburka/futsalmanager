<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
// CORS handled by cors.php

require_once __DIR__ . "/../config/database.php";

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Connessione database non disponibile"
    ]);
    exit;
}

$id = $_GET['id'] ?? null;

if (!$id) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "ID torneo mancante"
    ]);
    exit;
}

try {
    $query = "SELECT id, name, logo_url, location, start_date, end_date, description, type, format, status, teams_per_group, qualified_per_group, has_knockout, created_at FROM tournaments WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":id", $id, PDO::PARAM_INT);
    $stmt->execute();
    $tournament = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tournament) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Torneo non trovato"
        ]);
        exit;
    }

    // Conta squadre nel torneo
    $teamsCount = $conn->prepare("SELECT COUNT(*) FROM teams WHERE tournament_id = :id");
    $teamsCount->bindParam(":id", $id, PDO::PARAM_INT);
    $teamsCount->execute();
    $tournament['teams_count'] = (int) $teamsCount->fetchColumn();

    // Conta partite nel torneo
    $matchesCount = $conn->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = :id");
    $matchesCount->bindParam(":id", $id, PDO::PARAM_INT);
    $matchesCount->execute();
    $tournament['matches_count'] = (int) $matchesCount->fetchColumn();

    // Conta partite completate
    $finishedCount = $conn->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = :id AND status = 'finished'");
    $finishedCount->bindParam(":id", $id, PDO::PARAM_INT);
    $finishedCount->execute();
    $tournament['finished_matches_count'] = (int) $finishedCount->fetchColumn();

    // Conta giocatori nel torneo (via squadre)
    $playersCount = $conn->prepare("SELECT COUNT(*) FROM players p INNER JOIN teams t ON p.team_id = t.id WHERE t.tournament_id = :id");
    $playersCount->bindParam(":id", $id, PDO::PARAM_INT);
    $playersCount->execute();
    $tournament['players_count'] = (int) $playersCount->fetchColumn();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $tournament
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
