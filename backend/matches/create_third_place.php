<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->tournament_id)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "tournament_id obbligatorio"]);
    exit;
}

requireTournamentOwnership(intval($data->tournament_id));

$tournamentId = intval($data->tournament_id);

try {
    // Verifica che non esista già una partita di terzo posto
    $checkStmt = $conn->prepare("SELECT id FROM matches WHERE tournament_id = :tid AND round = 'terzo_posto'");
    $checkStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $checkStmt->execute();
    if ($checkStmt->fetch()) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "La partita per il 3° Posto esiste già"]);
        exit;
    }

    // Trova le semifinali terminate
    $sfStmt = $conn->prepare("
        SELECT m.id, m.home_team_id, m.away_team_id, m.home_score, m.away_score,
               m.home_extra_time, m.away_extra_time, m.home_penalties, m.away_penalties
        FROM matches m
        WHERE m.tournament_id = :tid AND m.round = 'semifinale' AND m.status = 'finished'
        ORDER BY m.id ASC
    ");
    $sfStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $sfStmt->execute();
    $semifinals = $sfStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($semifinals) < 2) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Servono 2 semifinali terminate per creare la partita di 3° Posto"]);
        exit;
    }

    // Determina i perdenti di entrambe le semifinali
    $losers = [];
    foreach ($semifinals as $sf) {
        $homeScore = intval($sf['home_score']);
        $awayScore = intval($sf['away_score']);

        if ($homeScore === $awayScore && $sf['home_extra_time'] !== null && $sf['away_extra_time'] !== null) {
            $homeScore = intval($sf['home_extra_time']);
            $awayScore = intval($sf['away_extra_time']);
        }
        if ($homeScore === $awayScore && $sf['home_penalties'] !== null && $sf['away_penalties'] !== null) {
            $homeScore = intval($sf['home_penalties']);
            $awayScore = intval($sf['away_penalties']);
        }

        $loserId = $homeScore > $awayScore ? $sf['away_team_id'] : $sf['home_team_id'];
        $losers[] = $loserId;
    }

    if (count($losers) < 2 || in_array(null, $losers) || in_array(0, $losers)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Impossibile determinare i perdenti delle semifinali"]);
        exit;
    }

    // Cerca la data della finale per pianificare il terzo posto prima
    $finaleStmt = $conn->prepare("SELECT match_date FROM matches WHERE tournament_id = :tid AND round = 'finale' LIMIT 1");
    $finaleStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $finaleStmt->execute();
    $finale = $finaleStmt->fetch(PDO::FETCH_ASSOC);

    if ($finale && $finale['match_date']) {
        $thirdPlaceDate = date('Y-m-d H:i:s', strtotime($finale['match_date'] . ' -1 day'));
    } else {
        $thirdPlaceDate = date('Y-m-d H:i:s', strtotime('+5 days'));
    }

    // Crea la partita di terzo posto
    $insertStmt = $conn->prepare("
        INSERT INTO matches (tournament_id, group_id, round, home_team_id, away_team_id, match_date, status)
        VALUES (:tid, NULL, 'terzo_posto', :home, :away, :date, 'scheduled')
    ");
    $insertStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $insertStmt->bindParam(":home", $losers[0], PDO::PARAM_INT);
    $insertStmt->bindParam(":away", $losers[1], PDO::PARAM_INT);
    $insertStmt->bindValue(":date", $thirdPlaceDate, PDO::PARAM_STR);
    $insertStmt->execute();

    $newMatchId = $conn->lastInsertId();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Partita per il 3° Posto creata con successo",
        "match_id" => $newMatchId
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
