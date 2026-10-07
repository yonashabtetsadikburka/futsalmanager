<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if(
    empty($data->match_id) &&
    $data->match_id != 0
){

    echo json_encode([
        "success" => false,
        "message" => "ID partita mancante"
    ]);

    exit;
}

try {

    $conn->beginTransaction();

    // MATCH
    $matchQuery = "
    SELECT *
    FROM matches
    WHERE id = :id
    ";

    $matchStmt = $conn->prepare($matchQuery);

    $matchStmt->bindParam(":id", $data->match_id);

    $matchStmt->execute();

    $match = $matchStmt->fetch(PDO::FETCH_ASSOC);

    if(!$match){

        throw new Exception("Partita non trovata");
    }

    $isKnockout = ($match['round'] !== 'girone');

    // UPDATE MATCH (con extra_time e penalties per knockout)
    if ($isKnockout) {
        $updateMatch = "
        UPDATE matches
        SET
            home_score = :home_score,
            away_score = :away_score,
            home_extra_time = :home_extra_time,
            away_extra_time = :away_extra_time,
            home_penalties = :home_penalties,
            away_penalties = :away_penalties,
            status = 'finished'
        WHERE id = :id
        ";

        $stmt = $conn->prepare($updateMatch);

        $stmt->bindParam(":home_score", $data->home_score);
        $stmt->bindParam(":away_score", $data->away_score);
        $stmt->bindValue(":home_extra_time", isset($data->home_extra_time) ? $data->home_extra_time : null, PDO::PARAM_INT);
        $stmt->bindValue(":away_extra_time", isset($data->away_extra_time) ? $data->away_extra_time : null, PDO::PARAM_INT);
        $stmt->bindValue(":home_penalties", isset($data->home_penalties) ? $data->home_penalties : null, PDO::PARAM_INT);
        $stmt->bindValue(":away_penalties", isset($data->away_penalties) ? $data->away_penalties : null, PDO::PARAM_INT);
        $stmt->bindParam(":id", $data->match_id);

        $stmt->execute();
    } else {
        $updateMatch = "
        UPDATE matches
        SET
            home_score = :home_score,
            away_score = :away_score,
            status = 'finished'
        WHERE id = :id
        ";

        $stmt = $conn->prepare($updateMatch);

        $stmt->bindParam(":home_score", $data->home_score);
        $stmt->bindParam(":away_score", $data->away_score);
        $stmt->bindParam(":id", $data->match_id);

        $stmt->execute();
    }

    $homeTeam = $match['home_team_id'];
    $awayTeam = $match['away_team_id'];

    // GOAL FATTI/SUBITI (sempre, sia girone che knockout)
    $updateGoals = "
    UPDATE teams
    SET
        goals_scored = goals_scored + :gf,
        goals_conceded = goals_conceded + :ga
    WHERE id = :id
    ";

    $homeStmt = $conn->prepare($updateGoals);
    $homeStmt->bindParam(":gf", $data->home_score);
    $homeStmt->bindParam(":ga", $data->away_score);
    $homeStmt->bindParam(":id", $homeTeam);
    $homeStmt->execute();

    $awayStmt = $conn->prepare($updateGoals);
    $awayStmt->bindParam(":gf", $data->away_score);
    $awayStmt->bindParam(":ga", $data->home_score);
    $awayStmt->bindParam(":id", $awayTeam);
    $awayStmt->execute();

    // VITTORIA/PAREGGIO/SCONFITTA (solo per partite di girone)
    if (!$isKnockout) {
        if($data->home_score > $data->away_score){

            $win = "
            UPDATE teams
            SET
                points = points + 3,
                wins = wins + 1
            WHERE id = :id
            ";

            $loss = "
            UPDATE teams
            SET
                losses = losses + 1
            WHERE id = :id
            ";

            $w = $conn->prepare($win);
            $w->bindParam(":id", $homeTeam);
            $w->execute();

            $l = $conn->prepare($loss);
            $l->bindParam(":id", $awayTeam);
            $l->execute();
        }

        elseif($data->away_score > $data->home_score){

            $win = "
            UPDATE teams
            SET
                points = points + 3,
                wins = wins + 1
            WHERE id = :id
            ";

            $loss = "
            UPDATE teams
            SET
                losses = losses + 1
            WHERE id = :id
            ";

            $w = $conn->prepare($win);
            $w->bindParam(":id", $awayTeam);
            $w->execute();

            $l = $conn->prepare($loss);
            $l->bindParam(":id", $homeTeam);
            $l->execute();
        }

        else {

            $draw = "
            UPDATE teams
            SET
                points = points + 1,
                draws = draws + 1
            WHERE id = :id
            ";

            $d1 = $conn->prepare($draw);
            $d1->bindParam(":id", $homeTeam);
            $d1->execute();

            $d2 = $conn->prepare($draw);
            $d2->bindParam(":id", $awayTeam);
            $d2->execute();
        }
    }

    // INSERISCI GIOCATORI IN match_players (presenze automatiche)
    $homePlayersQuery = "SELECT id FROM players WHERE team_id = :team_id";
    $homePlayersStmt = $conn->prepare($homePlayersQuery);
    $homePlayersStmt->bindParam(":team_id", $homeTeam, PDO::PARAM_INT);
    $homePlayersStmt->execute();
    $homePlayers = $homePlayersStmt->fetchAll(PDO::FETCH_ASSOC);

    $awayPlayersQuery = "SELECT id FROM players WHERE team_id = :team_id";
    $awayPlayersStmt = $conn->prepare($awayPlayersQuery);
    $awayPlayersStmt->bindParam(":team_id", $awayTeam, PDO::PARAM_INT);
    $awayPlayersStmt->execute();
    $awayPlayers = $awayPlayersStmt->fetchAll(PDO::FETCH_ASSOC);

    $insertMP = $conn->prepare("
        INSERT INTO match_players (match_id, player_id, goals, assists) 
        VALUES (:match_id, :player_id, 0, 0)
        ON DUPLICATE KEY UPDATE goals = goals, assists = assists
    ");

    foreach ($homePlayers as $player) {
        $insertMP->bindValue(":match_id", (int) $data->match_id, PDO::PARAM_INT);
        $insertMP->bindValue(":player_id", (int) $player['id'], PDO::PARAM_INT);
        $insertMP->execute();
    }

    foreach ($awayPlayers as $player) {
        $insertMP->bindValue(":match_id", (int) $data->match_id, PDO::PARAM_INT);
        $insertMP->bindValue(":player_id", (int) $player['id'], PDO::PARAM_INT);
        $insertMP->execute();
    }

    // Aggiorna matches_played per tutti i giocatori di entrambe le squadre
    $allPlayerIds = array_merge(
        array_map(function($p) { return (int)$p['id']; }, $homePlayers),
        array_map(function($p) { return (int)$p['id']; }, $awayPlayers)
    );
    if (!empty($allPlayerIds)) {
        $placeholders = implode(',', array_fill(0, count($allPlayerIds), '?'));
        $updateMP = $conn->prepare("UPDATE players SET matches_played = matches_played + 1 WHERE id IN ($placeholders)");
        foreach ($allPlayerIds as $index => $id) {
            $updateMP->bindValue($index + 1, $id, PDO::PARAM_INT);
        }
        $updateMP->execute();
    }

    $conn->commit();

    // Invalidate all related caches after match finish
    RedisCache::invalidate('teams:*');
    RedisCache::invalidate('stats:*');
    RedisCache::invalidate('tournaments:*');
    RedisCache::invalidate('groups:*');
    RedisCache::invalidate('matches:*');

    // --- LOGICA AVANZAMENTO KNOCKOUT ---
    $advancedInfo = null;
    if ($isKnockout) {
        try {
            $advancedInfo = advanceKnockoutWinner($conn, $match, $data);
        } catch (Exception $advEx) {
            error_log("Advance knockout error (match {$match['id']}): " . $advEx->getMessage());
        }

        // Auto-recovery:填补 next-round matches with NULL teams
        try {
            $roundOrder = ['ottavi' => 1, 'quarti' => 2, 'semifinale' => 3, 'finale' => 4];
            $currentOrder = $roundOrder[$match['round']] ?? 0;
            $nextRound = null;
            foreach ($roundOrder as $name => $order) {
                if ($order === $currentOrder + 1) { $nextRound = $name; break; }
            }
            if ($nextRound) {
                $incompleteStmt = $conn->prepare("
                    SELECT id, home_team_id, away_team_id FROM matches
                    WHERE tournament_id = :tid AND round = :round
                    AND (home_team_id IS NULL OR away_team_id IS NULL)
                    AND status = 'scheduled'
                ");
                $incompleteStmt->bindParam(":tid", $match['tournament_id'], PDO::PARAM_INT);
                $incompleteStmt->bindValue(":round", $nextRound, PDO::PARAM_STR);
                $incompleteStmt->execute();
                $incompleteMatches = $incompleteStmt->fetchAll(PDO::FETCH_ASSOC);

                foreach ($incompleteMatches as $incMatch) {
                    $needsHome = $incMatch['home_team_id'] === null;
                    $needsAway = $incMatch['away_team_id'] === null;
                    if (!$needsHome && !$needsAway) continue;

                    // Find the winner from current round that should fill this slot
                    $slot = $needsHome ? 'home' : 'away';
                    $otherSlot = $needsHome ? 'away' : 'home';
                    $otherTeamId = $needsHome ? $incMatch['away_team_id'] : $incMatch['home_team_id'];

                    // Get all finished matches in current round with their winners
                    $winnersStmt = $conn->prepare("
                        SELECT m.id, m.home_team_id, m.away_team_id,
                               m.home_score, m.away_score,
                               m.home_extra_time, m.away_extra_time,
                               m.home_penalties, m.away_penalties
                        FROM matches m
                        WHERE m.tournament_id = :tid AND m.round = :round AND m.status = 'finished'
                        ORDER BY m.id ASC
                    ");
                    $winnersStmt->bindParam(":tid", $match['tournament_id'], PDO::PARAM_INT);
                    $winnersStmt->bindValue(":round", $match['round'], PDO::PARAM_STR);
                    $winnersStmt->execute();
                    $currentRoundMatches = $winnersStmt->fetchAll(PDO::FETCH_ASSOC);

                    // Get all teams already placed in next round
                    $placedStmt = $conn->prepare("
                        SELECT home_team_id, away_team_id FROM matches
                        WHERE tournament_id = :tid AND round = :round
                    ");
                    $placedStmt->bindParam(":tid", $match['tournament_id'], PDO::PARAM_INT);
                    $placedStmt->bindValue(":round", $nextRound, PDO::PARAM_STR);
                    $placedStmt->execute();
                    $placed = $placedStmt->fetchAll(PDO::FETCH_ASSOC);
                    $placedIds = [];
                    foreach ($placed as $p) {
                        if ($p['home_team_id']) $placedIds[$p['home_team_id']] = true;
                        if ($p['away_team_id']) $placedIds[$p['away_team_id']] = true;
                    }

                    // Find unplaced winner
                    foreach ($currentRoundMatches as $crm) {
                        $hFinal = intval($crm['home_score']);
                        $aFinal = intval($crm['away_score']);
                        if ($hFinal === $aFinal && $crm['home_extra_time'] !== null && $crm['away_extra_time'] !== null) {
                            $hFinal = intval($crm['home_extra_time']);
                            $aFinal = intval($crm['away_extra_time']);
                        }
                        if ($hFinal === $aFinal && $crm['home_penalties'] !== null && $crm['away_penalties'] !== null) {
                            $hFinal = intval($crm['home_penalties']);
                            $aFinal = intval($crm['away_penalties']);
                        }
                        $winnerId = $hFinal > $aFinal ? $crm['home_team_id'] : $crm['away_team_id'];
                        if ($winnerId && !isset($placedIds[$winnerId]) && $winnerId != $otherTeamId) {
                            $col = $needsHome ? 'home_team_id' : 'away_team_id';
                            $fixStmt = $conn->prepare("UPDATE matches SET $col = :tid WHERE id = :id");
                            $fixStmt->bindParam(":tid", $winnerId, PDO::PARAM_INT);
                            $fixStmt->bindParam(":id", $incMatch['id'], PDO::PARAM_INT);
                            $fixStmt->execute();
                            break;
                        }
                    }
                }
            }
        } catch (Exception $recEx) {
            error_log("Auto-recovery error (match {$match['id']}): " . $recEx->getMessage());
        }
    }

    // --- LOGICA STATUS TORNEO AUTOMATICO ---
    // Se la finale è stata giocata, chiudi il torneo
    if ($match['round'] === 'finale' || $match['round'] === 'terzo_posto') {
        $tournamentId = $match['tournament_id'];
        // Verifica che TUTTE le partite knockout siano finite
        $checkStmt = $conn->prepare("
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished
            FROM matches
            WHERE tournament_id = :tid AND round != 'girone'
        ");
        $checkStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
        $checkStmt->execute();
        $checkData = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($checkData['total'] > 0 && $checkData['total'] == $checkData['finished']) {
            $updateTournament = $conn->prepare("
                UPDATE tournaments SET status = 'finished' WHERE id = :tid AND status = 'active'
            ");
            $updateTournament->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
            $updateTournament->execute();
        }
    }

    $response = [
        "success" => true,
        "message" => "Partita conclusa"
    ];

    if ($advancedInfo) {
        $response["advanced"] = $advancedInfo;
    }

    echo json_encode($response);

} catch(Exception $e){

    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}

/**
 * Avanza il vincitore di una partita knockout al round successivo.
 * Ritorna info sulla partita creata o null.
 */
function advanceKnockoutWinner($conn, $match, $data) {
    $roundOrder = ['ottavi' => 1, 'quarti' => 2, 'semifinale' => 3, 'finale' => 4];
    $currentRound = $match['round'];
    $currentOrder = $roundOrder[$currentRound] ?? 0;

    // La finale è l'ultimo round, niente da avanzare
    if ($currentRound === 'finale' || $currentRound === 'terzo_posto') {
        return null;
    }

    // Determina il vincitore
    $homeScore = intval($data->home_score);
    $awayScore = intval($data->away_score);

    // Per knockout: prima extra_time, poi penalties se pareggio
    if ($homeScore === $awayScore && isset($data->home_extra_time) && isset($data->away_extra_time)) {
        $homeScore = intval($data->home_extra_time);
        $awayScore = intval($data->away_extra_time);
    }
    if ($homeScore === $awayScore && isset($data->home_penalties) && isset($data->away_penalties)) {
        $homeScore = intval($data->home_penalties);
        $awayScore = intval($data->away_penalties);
    }

    if ($homeScore === $awayScore) {
        // Pareggio non risolto — non avanzare (caso raro)
        return null;
    }

    $winnerId = $homeScore > $awayScore ? $match['home_team_id'] : $match['away_team_id'];
    $winnerName = $homeScore > $awayScore
        ? getTeamName($conn, $match['home_team_id'])
        : getTeamName($conn, $match['away_team_id']);

    // Se è una semifinale, avanza il perdente al terzo posto (se esiste)
    if ($currentRound === 'semifinale') {
        $loserId = $homeScore > $awayScore ? $match['away_team_id'] : $match['home_team_id'];
        $tpStmt = $conn->prepare("SELECT id, home_team_id, away_team_id FROM matches WHERE tournament_id = :tid AND round = 'terzo_posto' LIMIT 1");
        $tpStmt->bindParam(":tid", $match['tournament_id'], PDO::PARAM_INT);
        $tpStmt->execute();
        $tpMatch = $tpStmt->fetch(PDO::FETCH_ASSOC);
        if ($tpMatch) {
            if (intval($tpMatch['home_team_id']) === 0 || $tpMatch['home_team_id'] === null) {
                $updTp = $conn->prepare("UPDATE matches SET home_team_id = :tid WHERE id = :id");
                $updTp->bindParam(":tid", $loserId, PDO::PARAM_INT);
                $updTp->bindParam(":id", $tpMatch['id'], PDO::PARAM_INT);
                $updTp->execute();
            } elseif (intval($tpMatch['away_team_id']) === 0 || $tpMatch['away_team_id'] === null) {
                $updTp = $conn->prepare("UPDATE matches SET away_team_id = :tid WHERE id = :id");
                $updTp->bindParam(":tid", $loserId, PDO::PARAM_INT);
                $updTp->bindParam(":id", $tpMatch['id'], PDO::PARAM_INT);
                $updTp->execute();
            }
        }
    }

    // Determina il round successivo
    $nextRound = null;
    foreach ($roundOrder as $name => $order) {
        if ($order === $currentOrder + 1) {
            $nextRound = $name;
            break;
        }
    }

    if (!$nextRound) return null;

    // Trova il prossimo round order per creare il round dopo se serve
    $nextNextRound = null;
    foreach ($roundOrder as $name => $order) {
        if ($order === $currentOrder + 2) {
            $nextNextRound = $name;
            break;
        }
    }

    // Cerca se esiste già una partita nel round successivo che ha bisogno di questo vincitore
    // Logica: le partite del round successivo hanno 2 slot (home/away)
    // Le partite del round corrente si accoppiano: match 0+1 → next match 0, match 2+3 → next match 1, ecc.
    $tournamentId = $match['tournament_id'];

    // Conta quante partite ci sono nel round corrente
    $countStmt = $conn->prepare("
        SELECT COUNT(*) as cnt FROM matches
        WHERE tournament_id = :tid AND round = :round
    ");
    $countStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $countStmt->bindValue(":round", $currentRound, PDO::PARAM_STR);
    $countStmt->execute();
    $countData = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalInRound = intval($countData['cnt']);

    // Trova la posizione di questa partita nel round
    $posStmt = $conn->prepare("
        SELECT COUNT(*) as pos FROM matches
        WHERE tournament_id = :tid AND round = :round AND id <= :id
    ");
    $posStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $posStmt->bindValue(":round", $currentRound, PDO::PARAM_STR);
    $posStmt->bindParam(":id", $match['id'], PDO::PARAM_INT);
    $posStmt->execute();
    $posData = $posStmt->fetch(PDO::FETCH_ASSOC);
    $position = intval($posData['pos']) - 1; // 0-indexed

    // Indice della partita nel round successivo (0, 1, 2, ...)
    $nextMatchIndex = intdiv($position, 2);
    // Slot: 0 = home (prime partite), 1 = away (seconde partite)
    $slot = $position % 2;

    // Cerca la partita nel round successivo
    $nextStmt = $conn->prepare("
        SELECT * FROM matches
        WHERE tournament_id = :tid AND round = :round
        ORDER BY id ASC
    ");
    $nextStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $nextStmt->bindValue(":round", $nextRound, PDO::PARAM_STR);
    $nextStmt->execute();
    $nextMatches = $nextStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($nextMatches) > $nextMatchIndex) {
        // La partita esiste già, inserisci il vincitore nello slot corretto
        $targetMatch = $nextMatches[$nextMatchIndex];
        if ($slot === 0) {
            $updateSlot = "UPDATE matches SET home_team_id = :team_id WHERE id = :id";
        } else {
            $updateSlot = "UPDATE matches SET away_team_id = :team_id WHERE id = :id";
        }
        $slotStmt = $conn->prepare($updateSlot);
        $slotStmt->bindParam(":team_id", $winnerId, PDO::PARAM_INT);
        $slotStmt->bindParam(":id", $targetMatch['id'], PDO::PARAM_INT);
        $slotStmt->execute();

        return [
            "action" => "placed",
            "next_round" => $nextRound,
            "match_id" => $targetMatch['id'],
            "winner" => $winnerName,
            "slot" => $slot === 0 ? "home" : "away"
        ];
    } else {
        // Crea una nuova partita nel round successivo
        $defaultDate = date('Y-m-d H:i:s', strtotime('+3 days'));
        $createStmt = $conn->prepare("
            INSERT INTO matches (tournament_id, group_id, round, home_team_id, away_team_id, match_date, status)
            VALUES (:tid, NULL, :round, :home, :away, :date, 'scheduled')
        ");
        $createStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
        $createStmt->bindValue(":round", $nextRound, PDO::PARAM_STR);
        if ($slot === 0) {
            $createStmt->bindParam(":home", $winnerId, PDO::PARAM_INT);
            $createStmt->bindValue(":away", null);
        } else {
            $createStmt->bindValue(":home", null);
            $createStmt->bindParam(":away", $winnerId, PDO::PARAM_INT);
        }
        $createStmt->bindValue(":date", $defaultDate, PDO::PARAM_STR);
        $createStmt->execute();

        $newMatchId = $conn->lastInsertId();

        return [
            "action" => "created",
            "next_round" => $nextRound,
            "match_id" => $newMatchId,
            "winner" => $winnerName,
            "slot" => $slot === 0 ? "home" : "away"
        ];
    }
}

function getTeamName($conn, $teamId) {
    $stmt = $conn->prepare("SELECT name FROM teams WHERE id = :id");
    $stmt->bindParam(":id", $teamId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? $row['name'] : 'Sconosciuta';
}
?>
