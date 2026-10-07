<?php
header("Content-Type: application/json");
require_once __DIR__ . "/config/cors.php";

require_once __DIR__ . "/config/database.php";
require_once __DIR__ . "/config/TokenManager.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Metodo non consentito']);
    exit;
}

// Rate limiting - max 3 tentativi per 15 minuti per IP
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitFile = sys_get_temp_dir() . '/futsal_register_' . md5($ip);
$rateData = [];
if (file_exists($rateLimitFile)) {
    $rateData = json_decode(file_get_contents($rateLimitFile), true) ?: [];
}
$now = time();
$rateData = array_filter($rateData, function($t) use ($now) { return ($now - $t) < 900; });
if (count($rateData) >= 3) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Troppi tentativi. Riprova tra 15 minuti']);
    exit;
}

$post = json_decode(file_get_contents('php://input'), true);

$firstName = trim($post['first_name'] ?? '');
$lastName = trim($post['last_name'] ?? '');
$email = trim($post['email'] ?? '');
$password = $post['password'] ?? '';
$organizerCode = strtoupper(trim($post['organizer_code'] ?? ''));

// Validazione
if (empty($firstName) || empty($lastName) || empty($email) || empty($password) || empty($organizerCode)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Tutti i campi sono obbligatori']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email non valida']);
    exit;
}

if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'La password deve avere almeno 8 caratteri']);
    exit;
}

if (!preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'La password deve contenere almeno una maiuscola, una minuscola e un numero']);
    exit;
}

// Limiti lunghezza input
if (strlen($firstName) > 50 || strlen($lastName) > 50 || strlen($email) > 100) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Input troppo lunghi']);
    exit;
}

try {
    // Verifica che il codice torneo esista
    $torQuery = "SELECT id, name FROM tournaments WHERE organizer_code = :code LIMIT 1";
    $torStmt = $conn->prepare($torQuery);
    $torStmt->bindParam(":code", $organizerCode);
    $torStmt->execute();
    $tournament = $torStmt->fetch(PDO::FETCH_ASSOC);

    if (!$tournament) {
        $rateData[] = $now;
        file_put_contents($rateLimitFile, json_encode($rateData));
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Codice torneo non valido']);
        exit;
    }

    // Verifica che l'email non sia già registrata
    $existQuery = "SELECT id FROM users WHERE email = :email LIMIT 1";
    $existStmt = $conn->prepare($existQuery);
    $existStmt->bindParam(":email", $email);
    $existStmt->execute();
    if ($existStmt->fetch()) {
        $rateData[] = $now;
        file_put_contents($rateLimitFile, json_encode($rateData));
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Email già registrata']);
        exit;
    }

    // Genera username univoco
    $baseUsername = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $firstName . $lastName));
    $username = $baseUsername;
    $counter = 1;
    while ($counter <= 100) {
        $checkQuery = "SELECT id FROM users WHERE username = :username LIMIT 1";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->bindParam(":username", $username);
        $checkStmt->execute();
        if (!$checkStmt->fetch()) break;
        $username = $baseUsername . $counter;
        $counter++;
    }
    if ($counter > 100) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Impossibile generare username univoco']);
        exit;
    }

    $conn->beginTransaction();

    // Crea utente
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    $insertUser = "INSERT INTO users (username, email, first_name, last_name, password, role) VALUES (:username, :email, :first_name, :last_name, :password, 'organizer')";
    $userStmt = $conn->prepare($insertUser);
    $userStmt->bindParam(":username", $username);
    $userStmt->bindParam(":email", $email);
    $userStmt->bindParam(":first_name", $firstName);
    $userStmt->bindParam(":last_name", $lastName);
    $userStmt->bindParam(":password", $hashedPassword);
    $userStmt->execute();

    $userId = $conn->lastInsertId();

    // Associa al torneo
    $insertOrganizer = "INSERT INTO tournament_organizers (user_id, tournament_id) VALUES (:user_id, :tournament_id)";
    $orgStmt = $conn->prepare($insertOrganizer);
    $orgStmt->bindParam(":user_id", $userId, PDO::PARAM_INT);
    $orgStmt->bindParam(":tournament_id", $tournament['id'], PDO::PARAM_INT);
    $orgStmt->execute();

    $conn->commit();

    // Reset rate limit
    if (file_exists($rateLimitFile)) {
        unlink($rateLimitFile);
    }

    // Genera token per login automatico
    $tokenManager = new TokenManager();
    $token = $tokenManager->generateToken($userId, 'organizer', (int)$tournament['id']);

    echo json_encode([
        'success' => true,
        'message' => 'Registrazione completata',
        'token' => $token,
        'role' => 'organizer',
        'tournament_id' => (int)$tournament['id'],
        'tournament_name' => $tournament['name'],
        'first_name' => $firstName,
        'last_name' => $lastName,
        'username' => $username
    ]);

} catch (PDOException $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Errore del server']);
}
?>
