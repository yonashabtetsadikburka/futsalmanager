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

$roundOrder = ['ottavi' => 1, 'quarti' => 2, 'semifinale' => 3, 'finale' => 4];

try {
    // Trova tutte le partite knockout finite che hanno un round successivo
    $stmt = $conn->prepare("
        SELECT m.*, 
               CASE 
                   WHEN m.home_extra_time IS NOT NULL AND m.away_extra_time IS NOT NULL THEN
                       CASE WHEN m.home_extra_time = m.away_extra_time THEN
                           CASE WHEN m.home_penalties IS NOT NULL THEN m.home_penalties ELSE m.home_extra_time END
                       ELSE m.home_extra_time END
                   ELSE m.home_score
               END AS final_home,
               CASE 
                   WHEN m.home_extra_time IS NOT NULL AND m.away_extra_time IS NOT NULL THEN
                       CASE WHEN m.home_extra_time = m.away_extra_time THEN
                           CASE WHEN m.away_penalties IS NOT NULL THEN m.away_penalties ELSE m.away_extra_time END
                       ELSE m.away_extra_time END
                   ELSE m.away_score
               END AS final_away
        FROM matches m
        WHERE m.tournament_id = :tid 
        AND m.round != 'girone'
        AND m.status = 'finished'
        AND m.round != 'finale'
        AND m.round != 'terzo_posto'
    ");
    $stmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $stmt->execute();
    $finishedMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $advanced = 0;
    foreach ($finishedMatches as $fm) {
        if ($fm['final_home'] == $fm['final_away']) continue; // pareggio non risolto

        $winnerId = $fm['final_home'] > $fm['final_away'] ? $fm['home_team_id'] : $fm['away_team_id'];
        $currentOrder = $roundOrder[$fm['round']] ?? 0;

        $nextRound = null;
        foreach ($roundOrder as $name => $order) {
            if ($order === $currentOrder + 1) { $nextRound = $name; break; }
        }
        if (!$nextRound) continue;

        // Posizione nel round
        $posStmt = $conn->prepare("
            SELECT COUNT(*) as pos FROM matches
            WHERE tournament_id = :tid AND round = :round AND id <= :id
        ");
        $posStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
        $posStmt->bindValue(":round", $fm['round'], PDO::PARAM_STR);
        $posStmt->bindParam(":id", $fm['id'], PDO::PARAM_INT);
        $posStmt->execute();
        $posData = $posStmt->fetch(PDO::FETCH_ASSOC);
        $position = intval($posData['pos']) - 1;

        $nextMatchIndex = intdiv($position, 2);
        $slot = $position % 2;

        // Cerca partita nel round successivo
        $nextStmt = $conn->prepare("
            SELECT * FROM matches WHERE tournament_id = :tid AND round = :round ORDER BY id ASC
        ");
        $nextStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
        $nextStmt->bindValue(":round", $nextRound, PDO::PARAM_STR);
        $nextStmt->execute();
        $nextMatches = $nextStmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($nextMatches) > $nextMatchIndex) {
            $targetMatch = $nextMatches[$nextMatchIndex];
            $field = $slot === 0 ? 'home_team_id' : 'away_team_id';
            // Aggiorna solo se lo slot è vuoto (team_id = 0 o NULL)
            if (intval($targetMatch[$field]) === 0 || $targetMatch[$field] === null) {
                $upd = $conn->prepare("UPDATE matches SET $field = :tid WHERE id = :id AND ($field = 0 OR $field IS NULL)");
                $upd->bindParam(":tid", $winnerId, PDO::PARAM_INT);
                $upd->bindParam(":id", $targetMatch['id'], PDO::PARAM_INT);
                $upd->execute();
                if ($upd->rowCount() > 0) $advanced++;
            }
        } else {
            // Crea nuova partita
            $defaultDate = date('Y-m-d H:i:s', strtotime('+3 days'));
            $create = $conn->prepare("
                INSERT INTO matches (tournament_id, group_id, round, home_team_id, away_team_id, match_date, status)
                VALUES (:tid, NULL, :round, :home, :away, :date, 'scheduled')
            ");
            $create->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
            $create->bindValue(":round", $nextRound, PDO::PARAM_STR);
            if ($slot === 0) {
                $create->bindParam(":home", $winnerId, PDO::PARAM_INT);
                $create->bindValue(":away", null);
            } else {
                $create->bindValue(":home", null);
                $create->bindParam(":away", $winnerId, PDO::PARAM_INT);
            }
            $create->bindValue(":date", $defaultDate, PDO::PARAM_STR);
            $create->execute();
            $advanced++;
        }

        // Avanza il perdente al terzo posto (se è una semifinale)
        if ($fm['round'] === 'semifinale') {
            $loserId = $fm['final_home'] > $fm['final_away'] ? $fm['away_team_id'] : $fm['home_team_id'];
            $tpStmt = $conn->prepare("SELECT id, home_team_id, away_team_id FROM matches WHERE tournament_id = :tid AND round = 'terzo_posto' LIMIT 1");
            $tpStmt->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
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
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "$advanced vincitore/i avanzato/i al round successivo",
        "advanced" => $advanced
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
