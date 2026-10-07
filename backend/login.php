<?php
header("Content-Type: application/json");
require_once __DIR__ . "/config/cors.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Errore del server']);
    exit;
}

require_once __DIR__ . "/config/database.php";
require_once __DIR__ . "/config/TokenManager.php";

// Rate limiting - max 5 tentativi per 15 minuti per IP
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitFile = sys_get_temp_dir() . '/futsal_login_' . md5($ip);
$rateData = [];
if (file_exists($rateLimitFile)) {
    $rateData = json_decode(file_get_contents($rateLimitFile), true) ?: [];
}

// Pulisci tentativi vecchi (>15 minuti)
$now = time();
$rateData = array_filter($rateData, function($t) use ($now) { return ($now - $t) < 900; });

if (count($rateData) >= 5) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Troppi tentativi. Riprova tra 15 minuti']);
    exit;
}

$post = json_decode(file_get_contents('php://input'), true);

$username = trim($post['username'] ?? '');
$password = $post['password'] ?? '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Inserisci email e password']);
    exit;
}

try {
    $query = "SELECT * FROM users WHERE username = :username OR email = :email LIMIT 1";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":username", $username);
    $stmt->bindParam(":email", $username);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password'])) {
        // Registra tentativo fallito
        $rateData[] = $now;
        file_put_contents($rateLimitFile, json_encode($rateData));

        error_log("Login fallito per: " . substr($username, 0, 3) . "*** da IP: $ip");

        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Credenziali non corretti']);
        exit;
    }

    if ($user['role'] !== 'admin' && $user['role'] !== 'organizer') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Credenziali non corretti']);
        exit;
    }

    // Login riuscito - resetta rate limit
    if (file_exists($rateLimitFile)) {
        unlink($rateLimitFile);
    }

    $tournamentId = null;
    if ($user['role'] === 'organizer') {
        $toQuery = "SELECT tournament_id FROM tournament_organizers WHERE user_id = :user_id LIMIT 1";
        $toStmt = $conn->prepare($toQuery);
        $toStmt->bindParam(":user_id", $user['id'], PDO::PARAM_INT);
        $toStmt->execute();
        $toRow = $toStmt->fetch(PDO::FETCH_ASSOC);
        $tournamentId = $toRow ? (int)$toRow['tournament_id'] : null;

        if ($tournamentId === null) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Credenziali non corretti']);
            exit;
        }
    }

    $tokenManager = new TokenManager();
    $token = $tokenManager->generateToken($user['id'], $user['role'], $tournamentId);

    echo json_encode([
        'success' => true,
        'token' => $token,
        'role' => $user['role'],
        'tournament_id' => $tournamentId,
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name']
    ]);

} catch (Exception $e) {
    error_log("Errore login");
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Errore del server']);
}
