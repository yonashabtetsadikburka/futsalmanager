<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

try {
    $conn->beginTransaction();

    // Reset tutte le stats delle squadre
    $conn->exec("UPDATE teams SET points = 0, wins = 0, draws = 0, losses = 0, goals_scored = 0, goals_conceded = 0");

    // Ricalcola da tutte le partite terminate di girone
    $query = "SELECT home_team_id, away_team_id, home_score, away_score FROM matches WHERE status = 'finished' AND round = 'girone'";
    $stmt = $conn->query($query);
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($matches as $m) {
        $homeId = $m['home_team_id'];
        $awayId = $m['away_team_id'];
        $hs = intval($m['home_score']);
        $as = intval($m['away_score']);

        // Goal
        $conn->prepare("UPDATE teams SET goals_scored = goals_scored + ?, goals_conceded = goals_conceded + ? WHERE id = ?")->execute([$hs, $as, $homeId]);
        $conn->prepare("UPDATE teams SET goals_scored = goals_scored + ?, goals_conceded = goals_conceded + ? WHERE id = ?")->execute([$as, $hs, $awayId]);

        if ($hs > $as) {
            $conn->prepare("UPDATE teams SET points = points + 3, wins = wins + 1 WHERE id = ?")->execute([$homeId]);
            $conn->prepare("UPDATE teams SET losses = losses + 1 WHERE id = ?")->execute([$awayId]);
        } elseif ($as > $hs) {
            $conn->prepare("UPDATE teams SET points = points + 3, wins = wins + 1 WHERE id = ?")->execute([$awayId]);
            $conn->prepare("UPDATE teams SET losses = losses + 1 WHERE id = ?")->execute([$homeId]);
        } else {
            $conn->prepare("UPDATE teams SET points = points + 1, draws = draws + 1 WHERE id = ?")->execute([$homeId]);
            $conn->prepare("UPDATE teams SET points = points + 1, draws = draws + 1 WHERE id = ?")->execute([$awayId]);
        }
    }

    // Sincronizza matches_played per i giocatori
    $conn->exec("UPDATE players SET matches_played = 0");
    $playerQuery = "
        SELECT mp.player_id, COUNT(*) as cnt
        FROM match_players mp
        INNER JOIN matches m ON m.id = mp.match_id
        WHERE m.status = 'finished'
        GROUP BY mp.player_id
    ";
    $pStmt = $conn->query($playerQuery);
    while ($p = $pStmt->fetch(PDO::FETCH_ASSOC)) {
        $conn->prepare("UPDATE players SET matches_played = ? WHERE id = ?")->execute([$p['cnt'], $p['player_id']]);
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Stats sincronizzate con successo. " . count($matches) . " partite elaborate."
    ]);

} catch (Exception $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
