<?php

// Carica .env se esiste
$envFile = dirname(__DIR__) . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) $lines = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || $line[0] === '#') continue;
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (!getenv($key)) {
                putenv("$key=$value");
            }
        }
    }
}

$host     = getenv('DB_HOST') ?: 'localhost';
$db_name  = getenv('DB_NAME') ?: 'futsal';
$username = getenv('DB_USER') ?: 'futsal_user';
$password = getenv('DB_PASS');

if ($password === false || $password === '') {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database configuration error"
    ]);
    exit;
}

$conn = null;

try {
    $conn = new PDO(
        "mysql:host=$host;port=3306;dbname=$db_name;charset=utf8",
        $username,
        $password
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $exception) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore di connessione al database"
    ]);
    exit;
}

// Redis cache layer
require_once __DIR__ . '/redis.php';
