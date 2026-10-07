<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo non consentito']);
    exit;
}

$id = $_GET['id'] ?? null;
$force = isset($_GET['force']) && $_GET['force'] === '1';

if (!$id) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "ID torneo mancante"
    ]);
    exit;
}

try {
    // Verifica che il torneo esista
    $check = $conn->prepare("SELECT id FROM tournaments WHERE id = :id");
    $check->bindParam(":id", $id, PDO::PARAM_INT);
    $check->execute();

    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Torneo non trovato"
        ]);
        exit;
    }

    // Verifica se ci sono squadre o partite associate
    $teamsCheck = $conn->prepare("SELECT COUNT(*) FROM teams WHERE tournament_id = :id");
    $teamsCheck->bindParam(":id", $id, PDO::PARAM_INT);
    $teamsCheck->execute();
    $teamsCount = (int) $teamsCheck->fetchColumn();

    $matchesCheck = $conn->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = :id");
    $matchesCheck->bindParam(":id", $id, PDO::PARAM_INT);
    $matchesCheck->execute();
    $matchesCount = (int) $matchesCheck->fetchColumn();

    if ($teamsCount > 0 || $matchesCount > 0) {
        if (!$force) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "Il torneo contiene $teamsCount squadre e $matchesCount partite. Usa force=1 per eliminare forzatamente."
            ]);
            exit;
        }

        // Force delete: elimina prima le partite associate, poi le squadre
        $conn->beginTransaction();

        // Elimina match_players per le partite del torneo (anche con tournament_id NULL)
        $deleteMatchPlayers = $conn->prepare("
            DELETE mp FROM match_players mp
            INNER JOIN matches m ON mp.match_id = m.id
            WHERE m.tournament_id = :id
            OR m.home_team_id IN (SELECT id FROM teams WHERE tournament_id = :id2)
            OR m.away_team_id IN (SELECT id FROM teams WHERE tournament_id = :id3)
        ");
        $deleteMatchPlayers->bindParam(":id", $id, PDO::PARAM_INT);
        $deleteMatchPlayers->bindParam(":id2", $id, PDO::PARAM_INT);
        $deleteMatchPlayers->bindParam(":id3", $id, PDO::PARAM_INT);
        $deleteMatchPlayers->execute();

        // Elimina le partite del torneo (anche con tournament_id NULL che referenziano squadre del torneo)
        $deleteMatches = $conn->prepare("
            DELETE FROM matches 
            WHERE tournament_id = :id 
            OR home_team_id IN (SELECT id FROM teams WHERE tournament_id = :id2)
            OR away_team_id IN (SELECT id FROM teams WHERE tournament_id = :id3)
        ");
        $deleteMatches->bindParam(":id", $id, PDO::PARAM_INT);
        $deleteMatches->bindParam(":id2", $id, PDO::PARAM_INT);
        $deleteMatches->bindParam(":id3", $id, PDO::PARAM_INT);
        $deleteMatches->execute();

        // Elimina i giocatori di quelle squadre
        $deletePlayers = $conn->prepare("
            DELETE FROM players WHERE team_id IN (
                SELECT id FROM teams WHERE tournament_id = :id
            )
        ");
        $deletePlayers->bindParam(":id", $id, PDO::PARAM_INT);
        $deletePlayers->execute();

        // Elimina gli allenatori (coach) di quelle squadre
        $deleteCoaches = $conn->prepare("
            DELETE FROM users WHERE id IN (
                SELECT coach_id FROM teams WHERE tournament_id = :id AND coach_id IS NOT NULL
            ) AND role = 'coach'
        ");
        $deleteCoaches->bindParam(":id", $id, PDO::PARAM_INT);
        $deleteCoaches->execute();

        // Elimina le squadre del torneo
        $deleteTeams = $conn->prepare("DELETE FROM teams WHERE tournament_id = :id");
        $deleteTeams->bindParam(":id", $id, PDO::PARAM_INT);
        $deleteTeams->execute();
    }

    // Ottieni gli user_id degli organizer associati al torneo
    $getOrg = $conn->prepare("SELECT user_id FROM tournament_organizers WHERE tournament_id = :id");
    $getOrg->bindParam(":id", $id, PDO::PARAM_INT);
    $getOrg->execute();
    $orgUserIds = $getOrg->fetchAll(PDO::FETCH_COLUMN);

    // Elimina gli utenti organizer associati
    if (!empty($orgUserIds)) {
        $placeholders = implode(',', array_fill(0, count($orgUserIds), '?'));
        $deleteUsers = $conn->prepare("DELETE FROM users WHERE id IN ($placeholders) AND role = 'organizer'");
        $deleteUsers->execute($orgUserIds);
    }

    // Elimina gli organizer associati al torneo
    $deleteOrg = $conn->prepare("DELETE FROM tournament_organizers WHERE tournament_id = :id");
    $deleteOrg->bindParam(":id", $id, PDO::PARAM_INT);
    $deleteOrg->execute();

    // Elimina il torneo
    $query = "DELETE FROM tournaments WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":id", $id, PDO::PARAM_INT);
    $stmt->execute();

    if (isset($conn) && $conn->inTransaction()) {
        $conn->commit();
    }

    // Invalidate tournaments cache
    RedisCache::invalidate('tournaments:*');
    RedisCache::invalidate('teams:*');
    RedisCache::invalidate('stats:*');

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Torneo eliminato con successo"
    ]);

} catch (PDOException $e) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
