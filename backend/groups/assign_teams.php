<?php
header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";
require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->group_id) || empty($data->team_ids) || !is_array($data->team_ids)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "group_id e team_ids (array) sono obbligatori"]);
    exit;
}

$groupId = intval($data->group_id);
$teamIds = array_map('intval', $data->team_ids);

try {
    // Verifica che il girone esista
    $check = $conn->prepare("SELECT id, tournament_id FROM `groups` WHERE id = :id");
    $check->bindParam(":id", $groupId, PDO::PARAM_INT);
    $check->execute();
    $group = $check->fetch(PDO::FETCH_ASSOC);
    if (!$group) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Girone non trovato"]);
        exit;
    }

    $tournamentId = $group['tournament_id'];

    // Verifica che le squadre appartengano al torneo del girone
    $placeholders = implode(',', array_fill(0, count($teamIds), '?'));
    $checkTeams = $conn->prepare(
        "SELECT id FROM teams WHERE id IN ($placeholders) AND tournament_id = ?"
    );
    for ($i = 0; $i < count($teamIds); $i++) {
        $checkTeams->bindValue($i + 1, $teamIds[$i], PDO::PARAM_INT);
    }
    $checkTeams->bindValue(count($teamIds) + 1, $tournamentId, PDO::PARAM_INT);
    $checkTeams->execute();
    $validTeams = $checkTeams->fetchAll(PDO::FETCH_COLUMN);

    if (count($validTeams) !== count($teamIds)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Alcune squadre non appartengono a questo torneo"]);
        exit;
    }

    // Verifica che nessuna squadra sia già assegnata ad un altro girone
    $placeholders2 = implode(',', array_fill(0, count($teamIds), '?'));
    $checkDuplicate = $conn->prepare("
        SELECT gt.team_id, g.name AS group_name
        FROM group_teams gt
        INNER JOIN `groups` g ON g.id = gt.group_id
        WHERE gt.team_id IN ($placeholders2)
        AND gt.group_id != ?
        AND g.tournament_id = ?
    ");
    for ($i = 0; $i < count($teamIds); $i++) {
        $checkDuplicate->bindValue($i + 1, $teamIds[$i], PDO::PARAM_INT);
    }
    $checkDuplicate->bindValue(count($teamIds) + 1, $groupId, PDO::PARAM_INT);
    $checkDuplicate->bindValue(count($teamIds) + 2, $tournamentId, PDO::PARAM_INT);
    $checkDuplicate->execute();
    $duplicates = $checkDuplicate->fetchAll(PDO::FETCH_ASSOC);

    if (count($duplicates) > 0) {
        $dupNames = array_map(function($d) { return $d['group_name']; }, $duplicates);
        $uniqueGroups = array_unique($dupNames);
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Alcune squadre sono già assegnate ad altri gironi: " . implode(', ', $uniqueGroups) . ". Una squadra non può partecipare a più gironi."
        ]);
        exit;
    }

    $conn->beginTransaction();

    // Rimuovi assegnazioni precedenti per questo girone
    $del = $conn->prepare("DELETE FROM group_teams WHERE group_id = :gid");
    $del->bindParam(":gid", $groupId, PDO::PARAM_INT);
    $del->execute();

    // Inserisci le nuove assegnazioni
    $insert = $conn->prepare("INSERT INTO group_teams (group_id, team_id) VALUES (:gid, :tid)");
    $insert->bindParam(":gid", $groupId, PDO::PARAM_INT);
    foreach ($teamIds as $tid) {
        $insert->bindParam(":tid", $tid, PDO::PARAM_INT);
        $insert->execute();
    }

    $conn->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => count($teamIds) . " squadre assegnate al girone con successo"
    ]);

} catch (PDOException $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server"]);
}
?>
