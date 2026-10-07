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

$matchId = isset($_GET['id']) ? $_GET['id'] : null;

if (!$matchId) {
    echo json_encode([
        "success" => false,
        "message" => "ID partita mancante"
    ]);
    exit;
}

try {
    // Verifica che la partita esista
    $checkQuery = "SELECT id, status FROM matches WHERE id = :id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(":id", $matchId, PDO::PARAM_INT);
    $checkStmt->execute();
    $match = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        echo json_encode([
            "success" => false,
            "message" => "Partita non trovata"
        ]);
        exit;
    }

    // Se la partita è terminata, ripristina le statistiche delle squadre
    if ($match['status'] === 'finished') {
        // Ottieni i dettagli della partita
        $detailQuery = "SELECT home_team_id, away_team_id, home_score, away_score FROM matches WHERE id = :id";
        $detailStmt = $conn->prepare($detailQuery);
        $detailStmt->bindParam(":id", $matchId, PDO::PARAM_INT);
        $detailStmt->execute();
        $matchDetail = $detailStmt->fetch(PDO::FETCH_ASSOC);

        if ($matchDetail) {
            $homeTeamId = $matchDetail['home_team_id'];
            $awayTeamId = $matchDetail['away_team_id'];
            $homeScore = $matchDetail['home_score'];
            $awayScore = $matchDetail['away_score'];

            // Determina il risultato
            if ($homeScore > $awayScore) {
                // Vittoria squadra casa
                $conn->beginTransaction();

                $updateHome = "UPDATE teams SET 
                    points = points - 3,
                    wins = wins - 1,
                    goals_scored = goals_scored - :home_score,
                    goals_conceded = goals_conceded - :away_score
                    WHERE id = :team_id";
                $stmtHome = $conn->prepare($updateHome);
                $stmtHome->bindParam(":home_score", $homeScore, PDO::PARAM_INT);
                $stmtHome->bindParam(":away_score", $awayScore, PDO::PARAM_INT);
                $stmtHome->bindParam(":team_id", $homeTeamId, PDO::PARAM_INT);
                $stmtHome->execute();

                $updateAway = "UPDATE teams SET 
                    losses = losses - 1,
                    goals_scored = goals_scored - :away_score,
                    goals_conceded = goals_conceded - :home_score
                    WHERE id = :team_id";
                $stmtAway = $conn->prepare($updateAway);
                $stmtAway->bindParam(":away_score", $awayScore, PDO::PARAM_INT);
                $stmtAway->bindParam(":home_score", $homeScore, PDO::PARAM_INT);
                $stmtAway->bindParam(":team_id", $awayTeamId, PDO::PARAM_INT);
                $stmtAway->execute();

            } elseif ($awayScore > $homeScore) {
                // Vittoria squadra ospite
                $conn->beginTransaction();

                $updateHome = "UPDATE teams SET 
                    losses = losses - 1,
                    goals_scored = goals_scored - :home_score,
                    goals_conceded = goals_conceded - :away_score
                    WHERE id = :team_id";
                $stmtHome = $conn->prepare($updateHome);
                $stmtHome->bindParam(":home_score", $homeScore, PDO::PARAM_INT);
                $stmtHome->bindParam(":away_score", $awayScore, PDO::PARAM_INT);
                $stmtHome->bindParam(":team_id", $homeTeamId, PDO::PARAM_INT);
                $stmtHome->execute();

                $updateAway = "UPDATE teams SET 
                    points = points - 3,
                    wins = wins - 1,
                    goals_scored = goals_scored - :away_score,
                    goals_conceded = goals_conceded - :home_score
                    WHERE id = :team_id";
                $stmtAway = $conn->prepare($updateAway);
                $stmtAway->bindParam(":away_score", $awayScore, PDO::PARAM_INT);
                $stmtAway->bindParam(":home_score", $homeScore, PDO::PARAM_INT);
                $stmtAway->bindParam(":team_id", $awayTeamId, PDO::PARAM_INT);
                $stmtAway->execute();

            } else {
                // Pareggio
                $conn->beginTransaction();

                $updateHome = "UPDATE teams SET 
                    points = points - 1,
                    draws = draws - 1,
                    goals_scored = goals_scored - :home_score,
                    goals_conceded = goals_conceded - :away_score
                    WHERE id = :team_id";
                $stmtHome = $conn->prepare($updateHome);
                $stmtHome->bindParam(":home_score", $homeScore, PDO::PARAM_INT);
                $stmtHome->bindParam(":away_score", $awayScore, PDO::PARAM_INT);
                $stmtHome->bindParam(":team_id", $homeTeamId, PDO::PARAM_INT);
                $stmtHome->execute();

                $updateAway = "UPDATE teams SET 
                    points = points - 1,
                    draws = draws - 1,
                    goals_scored = goals_scored - :away_score,
                    goals_conceded = goals_conceded - :home_score
                    WHERE id = :team_id";
                $stmtAway = $conn->prepare($updateAway);
                $stmtAway->bindParam(":away_score", $awayScore, PDO::PARAM_INT);
                $stmtAway->bindParam(":home_score", $homeScore, PDO::PARAM_INT);
                $stmtAway->bindParam(":team_id", $awayTeamId, PDO::PARAM_INT);
                $stmtAway->execute();
            }

            $conn->commit();
        }
    }

    // Ripristina matches_played per i giocatori
    if ($match['status'] === 'finished') {
        $detailQuery2 = "SELECT home_team_id, away_team_id FROM matches WHERE id = :id";
        $detailStmt2 = $conn->prepare($detailQuery2);
        $detailStmt2->bindParam(":id", $matchId, PDO::PARAM_INT);
        $detailStmt2->execute();
        $matchDetail2 = $detailStmt2->fetch(PDO::FETCH_ASSOC);
        if ($matchDetail2) {
            $homePlayersQ = "SELECT id FROM players WHERE team_id = :tid";
            $hpStmt = $conn->prepare($homePlayersQ);
            $hpStmt->bindParam(":tid", $matchDetail2['home_team_id'], PDO::PARAM_INT);
            $hpStmt->execute();
            $homeP = $hpStmt->fetchAll(PDO::FETCH_COLUMN);

            $awayPlayersQ = "SELECT id FROM players WHERE team_id = :tid";
            $apStmt = $conn->prepare($awayPlayersQ);
            $apStmt->bindParam(":tid", $matchDetail2['away_team_id'], PDO::PARAM_INT);
            $apStmt->execute();
            $awayP = $apStmt->fetchAll(PDO::FETCH_COLUMN);

            $allP = array_merge($homeP, $awayP);
            if (!empty($allP)) {
                $ph = implode(',', array_fill(0, count($allP), '?'));
                $decMP = $conn->prepare("UPDATE players SET matches_played = matches_played - 1 WHERE id IN ($ph) AND matches_played > 0");
                foreach ($allP as $idx => $pid) {
                    $decMP->bindValue($idx + 1, $pid, PDO::PARAM_INT);
                }
                $decMP->execute();
            }
        }
    }

    // Elimina i record match_players associati (ON DELETE CASCADE dovrebbe farlo, ma lo facciamo esplicitamente)
    $deletePlayersQuery = "DELETE FROM match_players WHERE match_id = :match_id";
    $deletePlayersStmt = $conn->prepare($deletePlayersQuery);
    $deletePlayersStmt->bindParam(":match_id", $matchId, PDO::PARAM_INT);
    $deletePlayersStmt->execute();

    // Elimina la partita
    $deleteQuery = "DELETE FROM matches WHERE id = :id";
    $deleteStmt = $conn->prepare($deleteQuery);
    $deleteStmt->bindParam(":id", $matchId, PDO::PARAM_INT);

    if ($deleteStmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Partita eliminata con successo"
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Errore eliminazione partita"
        ]);
    }

} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
?>