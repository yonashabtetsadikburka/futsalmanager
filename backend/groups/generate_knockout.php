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
    // 1. Leggi config torneo
    $tRes = $conn->prepare("SELECT * FROM tournaments WHERE id = :id");
    $tRes->bindParam(":id", $tournamentId, PDO::PARAM_INT);
    $tRes->execute();
    $tournament = $tRes->fetch(PDO::FETCH_ASSOC);
    if (!$tournament) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Torneo non trovato"]);
        exit;
    }

    $qualifiedPerGroup = intval($tournament['qualified_per_group']) ?: 2;
    $hasKnockout = intval($tournament['has_knockout']);
    if (!$hasKnockout) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Questo torneo non prevede fase a eliminazione diretta"]);
        exit;
    }

    // 2. Prendi tutti i gironi del torneo
    $gRes = $conn->prepare("SELECT id, name FROM `groups` WHERE tournament_id = :tid ORDER BY name ASC");
    $gRes->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $gRes->execute();
    $groups = $gRes->fetchAll(PDO::FETCH_ASSOC);

    if (count($groups) < 2) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Servono almeno 2 gironi per generare l'eliminazione diretta"]);
        exit;
    }

    // 3. Verifica che tutti i gironi siano terminati
    $groupIds = array_column($groups, 'id');
    $placeholders = implode(',', array_fill(0, count($groupIds), '?'));
    $checkRes = $conn->prepare("
        SELECT g.id, g.name,
               COUNT(m.id) as total_matches,
               SUM(CASE WHEN m.status = 'finished' THEN 1 ELSE 0 END) as finished_matches
        FROM `groups` g
        LEFT JOIN matches m ON m.group_id = g.id
        WHERE g.id IN ($placeholders)
        GROUP BY g.id
    ");
    foreach ($groupIds as $i => $gid) {
        $checkRes->bindValue($i + 1, $gid, PDO::PARAM_INT);
    }
    $checkRes->execute();
    $groupStatus = $checkRes->fetchAll(PDO::FETCH_ASSOC);

    $incompleteGroups = [];
    foreach ($groupStatus as $gs) {
        if ($gs['total_matches'] == 0 || $gs['total_matches'] != $gs['finished_matches']) {
            $incompleteGroups[] = $gs['name'];
        }
    }
    if (!empty($incompleteGroups)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Non tutti i gironi sono stati conclusi",
            "incomplete_groups" => $incompleteGroups
        ]);
        exit;
    }

    // 4. Per ogni girone, prendi le prime N classificate + terza
    $qualified = [];
    $thirds = [];
    foreach ($groups as $group) {
        // Prime N classificate
        $sRes = $conn->prepare("
            SELECT t.id, t.name,
                   (t.wins * 3 + t.draws) AS punti,
                   (t.goals_scored - t.goals_conceded) AS diff_reti,
                   t.goals_scored
            FROM teams t
            JOIN group_teams gt ON gt.team_id = t.id
            WHERE gt.group_id = :gid
            ORDER BY punti DESC, diff_reti DESC, t.goals_scored DESC
            LIMIT :lim
        ");
        $sRes->bindParam(":gid", $group['id'], PDO::PARAM_INT);
        $sRes->bindValue(":lim", $qualifiedPerGroup, PDO::PARAM_INT);
        $sRes->execute();
        $qualified[$group['name']] = $sRes->fetchAll(PDO::FETCH_ASSOC);

        // Terza classificata
        $tRes = $conn->prepare("
            SELECT t.id, t.name,
                   (t.wins * 3 + t.draws) AS punti,
                   (t.goals_scored - t.goals_conceded) AS diff_reti,
                   t.goals_scored,
                   :group_name AS group_name
            FROM teams t
            JOIN group_teams gt ON gt.team_id = t.id
            WHERE gt.group_id = :gid
            ORDER BY punti DESC, diff_reti DESC, t.goals_scored DESC
            LIMIT 1 OFFSET :offset
        ");
        $tRes->bindParam(":gid", $group['id'], PDO::PARAM_INT);
        $tRes->bindValue(":offset", $qualifiedPerGroup, PDO::PARAM_INT);
        $tRes->bindValue(":group_name", $group['name'], PDO::PARAM_STR);
        $tRes->execute();
        $thirdRow = $tRes->fetch(PDO::FETCH_ASSOC);
        if ($thirdRow) {
            $thirds[] = $thirdRow;
        }
    }

    // 5. Verifica che ci siano abbastanza squadre
    $totalQualified = 0;
    foreach ($qualified as $teams) {
        $totalQualified += count($teams);
    }
    if ($totalQualified < 2) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Non ci sono abbastanza squadre qualificate"]);
        exit;
    }

    // 6. Controlla se ci sono già partite di eliminazione diretta
    $existing = $conn->prepare("
        SELECT COUNT(*) as cnt FROM matches
        WHERE tournament_id = :tid AND round != 'girone'
    ");
    $existing->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $existing->execute();
    $existingData = $existing->fetch(PDO::FETCH_ASSOC);

    if ($existingData['cnt'] > 0) {
        if (empty($data->force)) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "Esistono già partite di eliminazione diretta. Usa force=1 per sovrascrivere",
                "existing_matches" => intval($existingData['cnt'])
            ]);
            exit;
        }
        $delRes = $conn->prepare("DELETE FROM matches WHERE tournament_id = :tid AND round != 'girone'");
        $delRes->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
        $delRes->execute();
    }

    // 7. Genera accoppiamenti
    $groupNames = array_keys($qualified);
    $matches = [];

    $numGroups = count($groupNames);

    if ($numGroups === 2) {
        $g1 = $groupNames[0];
        $g2 = $groupNames[1];
        if (count($qualified[$g1]) >= 1 && count($qualified[$g2]) >= 2) {
            $matches[] = ['home' => $qualified[$g1][0], 'away' => $qualified[$g2][1]];
        }
        if (count($qualified[$g2]) >= 1 && count($qualified[$g1]) >= 2) {
            $matches[] = ['home' => $qualified[$g2][0], 'away' => $qualified[$g1][1]];
        }
    } elseif ($numGroups === 3) {
        $firsts = [];
        foreach ($qualified as $gName => $teams) {
            if (count($teams) >= 1) $firsts[] = ['team' => $teams[0], 'group' => $gName];
        }
        $seconds = [];
        foreach ($qualified as $gName => $teams) {
            if (count($teams) >= 2) $seconds[] = ['team' => $teams[1], 'group' => $gName];
        }
        for ($i = 0; $i < count($firsts); $i++) {
            $awayIdx = ($i + 1) % count($seconds);
            if (isset($firsts[$i]) && isset($seconds[$awayIdx])) {
                $matches[] = ['home' => $firsts[$i]['team'], 'away' => $seconds[$awayIdx]['team']];
            }
        }
    } else {
        // 4+ gironi con terze classificate

        // Ordina terze per punti, diff reti, gol fatti
        usort($thirds, function($a, $b) {
            if ($a['punti'] != $b['punti']) return $b['punti'] - $a['punti'];
            if ($a['diff_reti'] != $b['diff_reti']) return $b['diff_reti'] - $a['diff_reti'];
            return $b['goals_scored'] - $a['goals_scored'];
        });
        $bestThirds = array_slice($thirds, 0, 4);

        // Raccogli prime e seconde per girone
        $firstByGroup = [];
        foreach ($qualified as $gName => $teams) {
            if (count($teams) >= 1) $firstByGroup[$gName] = $teams[0];
        }
        $secondByGroup = [];
        foreach ($qualified as $gName => $teams) {
            if (count($teams) >= 2) $secondByGroup[$gName] = $teams[1];
        }

        // Traccia tutte le squadre usate (home E away)
        $usedIds = [];

        // STEP 1: Accoppia ogni terza con una prima da girone diverso
        foreach ($bestThirds as $third) {
            foreach ($firstByGroup as $gName => $team) {
                if ($gName !== $third['group_name'] && !isset($usedIds[$team['id']]) && !isset($usedIds[$third['id']])) {
                    $matches[] = ['home' => $team, 'away' => $third];
                    $usedIds[$team['id']] = true;
                    $usedIds[$third['id']] = true;
                    unset($firstByGroup[$gName]);
                    break;
                }
            }
        }

        // STEP 2: Le prime rimanenti vs seconde da girone diverso
        foreach ($firstByGroup as $g1Name => $team1) {
            foreach ($secondByGroup as $g2Name => $team2) {
                if ($g1Name !== $g2Name && !isset($usedIds[$team1['id']]) && !isset($usedIds[$team2['id']])) {
                    $matches[] = ['home' => $team1, 'away' => $team2];
                    $usedIds[$team1['id']] = true;
                    $usedIds[$team2['id']] = true;
                    unset($firstByGroup[$g1Name]);
                    unset($secondByGroup[$g2Name]);
                    break;
                }
            }
        }

        // STEP 3: Le seconde rimanenti tra loro (stesso girone OK per quarti)
        $remainingSeconds = [];
        foreach ($secondByGroup as $gName => $team) {
            if (!isset($usedIds[$team['id']])) {
                $remainingSeconds[] = $team;
            }
        }
        for ($i = 0; $i < count($remainingSeconds); $i += 2) {
            if (isset($remainingSeconds[$i + 1])) {
                $matches[] = ['home' => $remainingSeconds[$i], 'away' => $remainingSeconds[$i + 1]];
            }
        }
    }

    // Calcola il round in base al numero totale di partite generate
    $numMatches = count($matches);
    if ($numMatches <= 2) {
        $round = 'semifinale';
    } elseif ($numMatches <= 4) {
        $round = 'quarti';
    } elseif ($numMatches <= 8) {
        $round = 'ottavi';
    } else {
        $round = 'sedicesimi';
    }

    if (empty($matches)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Nessun accoppiamento generato. Verifica che i gironi abbiano abbastanza squadre qualificate"]);
        exit;
    }

    // 8. Inserisci le partite nel database
    $conn->beginTransaction();

    $insert = $conn->prepare("
        INSERT INTO matches (tournament_id, group_id, round, home_team_id, away_team_id, match_date, status)
        VALUES (:tid, NULL, :round, :home, :away, :date, 'scheduled')
    ");
    $insert->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $insert->bindParam(":round", $round, PDO::PARAM_STR);

    $defaultDate = date('Y-m-d H:i:s', strtotime('+7 days'));
    $insert->bindValue(":date", $defaultDate, PDO::PARAM_STR);

    $createdIds = [];
    foreach ($matches as $m) {
        $insert->bindParam(":home", $m['home']['id'], PDO::PARAM_INT);
        $insert->bindParam(":away", $m['away']['id'], PDO::PARAM_INT);
        $insert->execute();
        $createdIds[] = $conn->lastInsertId();
    }

    $conn->commit();

    // 9. Recupera le partite create
    $placeholders = implode(',', array_fill(0, count($createdIds), '?'));
    $fetch = $conn->prepare("
        SELECT m.*, ht.name AS home_team, at.name AS away_team
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE m.id IN ($placeholders)
        ORDER BY m.round ASC, m.match_date ASC
    ");
    for ($i = 0; $i < count($createdIds); $i++) {
        $fetch->bindValue($i + 1, $createdIds[$i], PDO::PARAM_INT);
    }
    $fetch->execute();
    $createdMatches = $fetch->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => count($createdMatches) . " partite di $round create con successo",
        "round" => $round,
        "qualified_count" => $totalQualified + count($bestThirds ?? []),
        "thirds_included" => count($bestThirds ?? []),
        "data" => $createdMatches
    ]);

} catch (PDOException $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
