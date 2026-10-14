<?php
header("Content-Type: application/json");
require_once __DIR__ . "/config/cors.php";
// CORS handled by cors.php


require_once __DIR__ . "/config/TokenManager.php";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Errore del server']);
    exit;
}

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

if (empty($authHeader)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token mancante']);
    exit;
}

$token = str_replace('Bearer ', '', $authHeader);

$tokenManager = new TokenManager();

if ($tokenManager->validateToken($token)) {
    echo json_encode(['success' => true, 'message' => 'Token valido']);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token non valido o scaduto']);
}
