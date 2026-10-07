<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->group_id)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "group_id obbligatorio"]);
    exit;
}

$groupId = intval($data->group_id);

try {
    // 1. Carica il girone
    $gRes = $conn->prepare("SELECT id, tournament_id, name FROM `groups` WHERE id = :id");
    $gRes->bindParam(":id", $groupId, PDO::PARAM_INT);
    $gRes->execute();
    $group = $gRes->fetch(PDO::FETCH_ASSOC);

    if (!$group) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Girone non trovato"]);
        exit;
    }

    $tournamentId = intval($group['tournament_id']);

    // 2. Verifica che il torneo sia formato girone
    $tRes = $conn->prepare("SELECT id, format FROM tournaments WHERE id = :id");
    $tRes->bindParam(":id", $tournamentId, PDO::PARAM_INT);
    $tRes->execute();
    $tournament = $tRes->fetch(PDO::FETCH_ASSOC);

    if (!$tournament) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Torneo non trovato"]);
        exit;
    }

    if (($tournament['format'] ?? 'girone') === 'round_robin') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Il formato round robin non utilizza gironi. Le partite si creano manualmente."]);
        exit;
    }

    // 3. Carica le squadre del girone
    $teamsRes = $conn->prepare("
        SELECT t.id, t.name
        FROM teams t
        JOIN group_teams gt ON gt.team_id = t.id
        WHERE gt.group_id = :gid
        ORDER BY t.name ASC
    ");
    $teamsRes->bindParam(":gid", $groupId, PDO::PARAM_INT);
    $teamsRes->execute();
    $teams = $teamsRes->fetchAll(PDO::FETCH_ASSOC);

    if (count($teams) < 2) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Servono almeno 2 squadre nel girone per generare le partite"]);
        exit;
    }

    // 4. Controlla se ci sono già partite per questo girone
    $existingRes = $conn->prepare("
        SELECT COUNT(*) as cnt FROM matches
        WHERE group_id = :gid AND round = 'girone'
    ");
    $existingRes->bindParam(":gid", $groupId, PDO::PARAM_INT);
    $existingRes->execute();
    $existingData = $existingRes->fetch(PDO::FETCH_ASSOC);

    if ($existingData['cnt'] > 0) {
        if (empty($data->force)) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "Esistono già " . $existingData['cnt'] . " partite per questo girone. Usa force=1 per sovrascrivere",
                "existing_matches" => intval($existingData['cnt'])
            ]);
            exit;
        }
        // Elimina le partite esistenti del girone
        $delRes = $conn->prepare("DELETE FROM matches WHERE group_id = :gid AND round = 'girone'");
        $delRes->bindParam(":gid", $groupId, PDO::PARAM_INT);
        $delRes->execute();
    }

    // 5. Genera tutte le combinazioni round-robin C(n,2)
    $matches = [];
    $n = count($teams);
    for ($i = 0; $i < $n; $i++) {
        for ($j = $i + 1; $j < $n; $j++) {
            $matches[] = [
                'home' => $teams[$i],
                'away' => $teams[$j]
            ];
        }
    }

    // 6. Inserisci le partite in transazione
    $conn->beginTransaction();

    $insert = $conn->prepare("
        INSERT INTO matches (tournament_id, group_id, round, home_team_id, away_team_id, match_date, status)
        VALUES (:tid, :gid, 'girone', :home, :away, NULL, 'scheduled')
    ");
    $insert->bindParam(":tid", $tournamentId, PDO::PARAM_INT);
    $insert->bindParam(":gid", $groupId, PDO::PARAM_INT);

    $createdIds = [];
    foreach ($matches as $m) {
        $insert->bindParam(":home", $m['home']['id'], PDO::PARAM_INT);
        $insert->bindParam(":away", $m['away']['id'], PDO::PARAM_INT);
        $insert->execute();
        $createdIds[] = $conn->lastInsertId();
    }

    $conn->commit();

    // 7. Invalida cache
    if (class_exists('RedisCache')) {
        RedisCache::invalidate('groups:*');
        RedisCache::invalidate('matches:*');
        RedisCache::invalidate('stats:*');
        RedisCache::invalidate('tournaments:*');
    }

    // 8. Recupera le partite create
    $placeholders = implode(',', array_fill(0, count($createdIds), '?'));
    $fetch = $conn->prepare("
        SELECT m.*, ht.name AS home_team_name, at.name AS away_team_name
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE m.id IN ($placeholders)
        ORDER BY m.match_date ASC, m.id ASC
    ");
    for ($i = 0; $i < count($createdIds); $i++) {
        $fetch->bindValue($i + 1, $createdIds[$i], PDO::PARAM_INT);
    }
    $fetch->execute();
    $createdMatches = $fetch->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => count($createdMatches) . " partite create per il girone " . $group['name'],
        "group" => $group['name'],
        "teams_count" => count($teams),
        "matches_count" => count($createdMatches),
        "data" => $createdMatches
    ]);

} catch (PDOException $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
