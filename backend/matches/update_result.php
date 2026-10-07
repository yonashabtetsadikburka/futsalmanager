<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->match_id) && $data->match_id != 0) {
    echo json_encode(["success" => false, "message" => "ID partita mancante"]);
    exit;
}

if (!isset($data->home_score) || !isset($data->away_score)) {
    echo json_encode(["success" => false, "message" => "Risultato mancante"]);
    exit;
}

try {
    $conn->beginTransaction();

    // Get current match
    $matchStmt = $conn->prepare("SELECT * FROM matches WHERE id = :id");
    $matchStmt->bindParam(":id", $data->match_id);
    $matchStmt->execute();
    $match = $matchStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        throw new Exception("Partita non trovata");
    }

    if ($match['status'] !== 'finished') {
        throw new Exception("La partita non è terminata");
    }

    $isKnockout = ($match['round'] !== 'girone');
    $homeTeam = $match['home_team_id'];
    $awayTeam = $match['away_team_id'];

    // --- REVERSE OLD STATS ---

    // Reverse goals_scored/goals_conceded
    $reverseGoals = "
        UPDATE teams
        SET
            goals_scored = goals_scored - :gf,
            goals_conceded = goals_scored - :gf + goals_conceded
        WHERE id = :id
    ";
    // Actually, simpler: subtract what was added
    $reverseGoals = "
        UPDATE teams
        SET
            goals_scored = goals_scored - :gf,
            goals_conceded = goals_conceded - :ga
        WHERE id = :id
    ";

    $oldHomeScore = intval($match['home_score']);
    $oldAwayScore = intval($match['away_score']);

    $homeRev = $conn->prepare($reverseGoals);
    $homeRev->bindParam(":gf", $oldHomeScore, PDO::PARAM_INT);
    $homeRev->bindParam(":ga", $oldAwayScore, PDO::PARAM_INT);
    $homeRev->bindParam(":id", $homeTeam, PDO::PARAM_INT);
    $homeRev->execute();

    $awayRev = $conn->prepare($reverseGoals);
    $awayRev->bindParam(":gf", $oldAwayScore, PDO::PARAM_INT);
    $awayRev->bindParam(":ga", $oldHomeScore, PDO::PARAM_INT);
    $awayRev->bindParam(":id", $awayTeam, PDO::PARAM_INT);
    $awayRev->execute();

    // Reverse wins/losses/draws (girone only)
    if (!$isKnockout) {
        if ($oldHomeScore > $oldAwayScore) {
            $stmt = $conn->prepare("UPDATE teams SET points = points - 3, wins = wins - 1 WHERE id = :id");
            $stmt->bindParam(":id", $homeTeam, PDO::PARAM_INT);
            $stmt->execute();
            $stmt = $conn->prepare("UPDATE teams SET losses = losses - 1 WHERE id = :id");
            $stmt->bindParam(":id", $awayTeam, PDO::PARAM_INT);
            $stmt->execute();
        } elseif ($oldAwayScore > $oldHomeScore) {
            $stmt = $conn->prepare("UPDATE teams SET points = points - 3, wins = wins - 1 WHERE id = :id");
            $stmt->bindParam(":id", $awayTeam, PDO::PARAM_INT);
            $stmt->execute();
            $stmt = $conn->prepare("UPDATE teams SET losses = losses - 1 WHERE id = :id");
            $stmt->bindParam(":id", $homeTeam, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $conn->prepare("UPDATE teams SET points = points - 1, draws = draws - 1 WHERE id = :id");
            $stmt->bindParam(":id", $homeTeam, PDO::PARAM_INT);
            $stmt->execute();
            $stmt = $conn->prepare("UPDATE teams SET points = points - 1, draws = draws - 1 WHERE id = :id");
            $stmt->bindParam(":id", $awayTeam, PDO::PARAM_INT);
            $stmt->execute();
        }
    }

    // --- UPDATE MATCH ---
    $newHomeScore = intval($data->home_score);
    $newAwayScore = intval($data->away_score);

    if ($isKnockout) {
        $updateStmt = $conn->prepare("
            UPDATE matches
            SET
                home_score = :hs,
                away_score = :as,
                home_extra_time = :het,
                away_extra_time = :aet,
                home_penalties = :hp,
                away_penalties = :ap
            WHERE id = :id
        ");
        $updateStmt->bindParam(":hs", $newHomeScore, PDO::PARAM_INT);
        $updateStmt->bindParam(":as", $newAwayScore, PDO::PARAM_INT);
        $updateStmt->bindValue(":het", isset($data->home_extra_time) ? intval($data->home_extra_time) : null, PDO::PARAM_INT);
        $updateStmt->bindValue(":aet", isset($data->away_extra_time) ? intval($data->away_extra_time) : null, PDO::PARAM_INT);
        $updateStmt->bindValue(":hp", isset($data->home_penalties) ? intval($data->home_penalties) : null, PDO::PARAM_INT);
        $updateStmt->bindValue(":ap", isset($data->away_penalties) ? intval($data->away_penalties) : null, PDO::PARAM_INT);
        $updateStmt->bindParam(":id", $data->match_id, PDO::PARAM_INT);
        $updateStmt->execute();
    } else {
        $updateStmt = $conn->prepare("
            UPDATE matches
            SET home_score = :hs, away_score = :as
            WHERE id = :id
        ");
        $updateStmt->bindParam(":hs", $newHomeScore, PDO::PARAM_INT);
        $updateStmt->bindParam(":as", $newAwayScore, PDO::PARAM_INT);
        $updateStmt->bindParam(":id", $data->match_id, PDO::PARAM_INT);
        $updateStmt->execute();
    }

    // --- APPLY NEW STATS ---

    // Goals scored/conceded
    $applyGoals = "
        UPDATE teams
        SET
            goals_scored = goals_scored + :gf,
            goals_conceded = goals_conceded + :ga
        WHERE id = :id
    ";

    $homeApply = $conn->prepare($applyGoals);
    $homeApply->bindParam(":gf", $newHomeScore, PDO::PARAM_INT);
    $homeApply->bindParam(":ga", $newAwayScore, PDO::PARAM_INT);
    $homeApply->bindParam(":id", $homeTeam, PDO::PARAM_INT);
    $homeApply->execute();

    $awayApply = $conn->prepare($applyGoals);
    $awayApply->bindParam(":gf", $newAwayScore, PDO::PARAM_INT);
    $awayApply->bindParam(":ga", $newHomeScore, PDO::PARAM_INT);
    $awayApply->bindParam(":id", $awayTeam, PDO::PARAM_INT);
    $awayApply->execute();

    // Wins/losses/draws (girone only)
    if (!$isKnockout) {
        if ($newHomeScore > $newAwayScore) {
            $stmt = $conn->prepare("UPDATE teams SET points = points + 3, wins = wins + 1 WHERE id = :id");
            $stmt->bindParam(":id", $homeTeam, PDO::PARAM_INT);
            $stmt->execute();
            $stmt = $conn->prepare("UPDATE teams SET losses = losses + 1 WHERE id = :id");
            $stmt->bindParam(":id", $awayTeam, PDO::PARAM_INT);
            $stmt->execute();
        } elseif ($newAwayScore > $newHomeScore) {
            $stmt = $conn->prepare("UPDATE teams SET points = points + 3, wins = wins + 1 WHERE id = :id");
            $stmt->bindParam(":id", $awayTeam, PDO::PARAM_INT);
            $stmt->execute();
            $stmt = $conn->prepare("UPDATE teams SET losses = losses + 1 WHERE id = :id");
            $stmt->bindParam(":id", $homeTeam, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $conn->prepare("UPDATE teams SET points = points + 1, draws = draws + 1 WHERE id = :id");
            $stmt->bindParam(":id", $homeTeam, PDO::PARAM_INT);
            $stmt->execute();
            $stmt = $conn->prepare("UPDATE teams SET points = points + 1, draws = draws + 1 WHERE id = :id");
            $stmt->bindParam(":id", $awayTeam, PDO::PARAM_INT);
            $stmt->execute();
        }
    }

    $conn->commit();

    // Invalidate caches
    RedisCache::invalidate('teams:*');
    RedisCache::invalidate('stats:*');
    RedisCache::invalidate('tournaments:*');
    RedisCache::invalidate('groups:*');
    RedisCache::invalidate('matches:*');

    echo json_encode(["success" => true, "message" => "Risultato aggiornato"]);

} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>