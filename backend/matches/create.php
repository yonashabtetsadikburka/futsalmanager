<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->tournament_id)) {
    requireTournamentOwnership(intval($data->tournament_id));
}

if(
    empty($data->home_team_id) ||
    empty($data->away_team_id) ||
    empty($data->match_date)
){
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Compila tutti i campi"
    ]);
    exit;
}

if($data->home_team_id == $data->away_team_id){
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Le squadre devono essere diverse"
    ]);
    exit;
}

// Verifica che entrambe le squadre appartengano al torneo
if (!empty($data->tournament_id)) {
    $checkQuery = "
        SELECT id, tournament_id FROM teams 
        WHERE id IN (:home_id, :away_id)
    ";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(":home_id", $data->home_team_id, PDO::PARAM_INT);
    $checkStmt->bindParam(":away_id", $data->away_team_id, PDO::PARAM_INT);
    $checkStmt->execute();
    $teams = $checkStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($teams as $t) {
        if ($t['tournament_id'] != $data->tournament_id) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Una o entrambe le squadre non appartengono al torneo selezionato"
            ]);
            exit;
        }
    }

    // Verifica che entrambe le squadre abbiano abbastanza giocatori
    $typeQuery = "SELECT type FROM tournaments WHERE id = :tid LIMIT 1";
    $typeStmt = $conn->prepare($typeQuery);
    $typeStmt->bindParam(":tid", $data->tournament_id, PDO::PARAM_INT);
    $typeStmt->execute();
    $tournament = $typeStmt->fetch(PDO::FETCH_ASSOC);
    $minPlayers = ($tournament && $tournament['type'] === '7v7') ? 7 : 5;

    $countQuery = "SELECT team_id, COUNT(*) as cnt FROM players WHERE team_id IN (:home_id, :away_id) GROUP BY team_id";
    $countStmt = $conn->prepare($countQuery);
    $countStmt->bindParam(":home_id", $data->home_team_id, PDO::PARAM_INT);
    $countStmt->bindParam(":away_id", $data->away_team_id, PDO::PARAM_INT);
    $countStmt->execute();
    $playerCounts = $countStmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $homeCount = isset($playerCounts[$data->home_team_id]) ? (int)$playerCounts[$data->home_team_id] : 0;
    $awayCount = isset($playerCounts[$data->away_team_id]) ? (int)$playerCounts[$data->away_team_id] : 0;

    if ($homeCount < $minPlayers) {
        $homeNameQuery = "SELECT name FROM teams WHERE id = :id LIMIT 1";
        $homeNameStmt = $conn->prepare($homeNameQuery);
        $homeNameStmt->bindParam(":id", $data->home_team_id, PDO::PARAM_INT);
        $homeNameStmt->execute();
        $homeName = $homeNameStmt->fetchColumn();
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "La squadra " . ($homeName || 'Casa') . " ha solo $homeCount giocatori, ne servono almeno $minPlayers per torneo " . ($tournament['type'] ?? '5v5')
        ]);
        exit;
    }

    if ($awayCount < $minPlayers) {
        $awayNameQuery = "SELECT name FROM teams WHERE id = :id LIMIT 1";
        $awayNameStmt = $conn->prepare($awayNameQuery);
        $awayNameStmt->bindParam(":id", $data->away_team_id, PDO::PARAM_INT);
        $awayNameStmt->execute();
        $awayName = $awayNameStmt->fetchColumn();
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "La squadra " . ($awayName || 'Ospite') . " ha solo $awayCount giocatori, ne servono almeno $minPlayers per torneo " . ($tournament['type'] ?? '5v5')
        ]);
        exit;
    }

    // Verifica che le due squadre non si siano già affrontate in questo torneo
    $dupeQuery = "
        SELECT id FROM matches 
        WHERE tournament_id = :tournament_id 
        AND status = 'finished'
        AND (
            (home_team_id = :home1 AND away_team_id = :away1)
            OR
            (home_team_id = :home2 AND away_team_id = :away2)
        )
    ";
    $dupeStmt = $conn->prepare($dupeQuery);
    $dupeStmt->bindParam(":tournament_id", $data->tournament_id, PDO::PARAM_INT);
    $dupeStmt->bindParam(":home1", $data->home_team_id, PDO::PARAM_INT);
    $dupeStmt->bindParam(":away1", $data->away_team_id, PDO::PARAM_INT);
    $dupeStmt->bindParam(":home2", $data->away_team_id, PDO::PARAM_INT);
    $dupeStmt->bindParam(":away2", $data->home_team_id, PDO::PARAM_INT);
    $dupeStmt->execute();

    if ($dupeStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Le due squadre si sono già affrontate in questo torneo"
        ]);
        exit;
    }

    // Se è una partita di girone, verifica che entrambe le squadre appartengano al girone
    if (!empty($data->group_id)) {
        $groupCheck = $conn->prepare("
            SELECT COUNT(*) as cnt FROM group_teams
            WHERE group_id = :gid AND team_id IN (:home_id, :away_id)
        ");
        $groupCheck->bindParam(":gid", $data->group_id, PDO::PARAM_INT);
        $groupCheck->bindParam(":home_id", $data->home_team_id, PDO::PARAM_INT);
        $groupCheck->bindParam(":away_id", $data->away_team_id, PDO::PARAM_INT);
        $groupCheck->execute();
        $groupData = $groupCheck->fetch(PDO::FETCH_ASSOC);

        if ($groupData['cnt'] < 2) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Entrambe le squadre devono appartenere allo stesso girone"
            ]);
            exit;
        }
    }
}

$group_id = $data->group_id ?? null;
$round = $group_id ? 'girone' : ($data->round ?? 'girone');

$query = "
INSERT INTO matches
(
    home_team_id,
    away_team_id,
    tournament_id,
    group_id,
    round,
    match_date
)

VALUES
(
    :home_team_id,
    :away_team_id,
    :tournament_id,
    :group_id,
    :round,
    :match_date
)
";

$stmt = $conn->prepare($query);

$stmt->bindParam(":home_team_id", $data->home_team_id);
$stmt->bindParam(":away_team_id", $data->away_team_id);
$stmt->bindParam(":tournament_id", $data->tournament_id);
if ($group_id !== null) {
    $stmt->bindValue(":group_id", (int)$group_id, PDO::PARAM_INT);
} else {
    $stmt->bindValue(":group_id", null, PDO::PARAM_NULL);
}
$stmt->bindValue(":round", $round, PDO::PARAM_STR);
$stmt->bindParam(":match_date", $data->match_date);

if($stmt->execute()){

    echo json_encode([
        "success" => true,
        "message" => "Partita creata"
    ]);

    // Invalidate caches
    RedisCache::invalidate('groups:*');
    RedisCache::invalidate('matches:*');
    RedisCache::invalidate('stats:*');

} else {

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore creazione partita"
    ]);
}
?>
