<?php
require_once __DIR__ . '/TokenManager.php';

function verifyAuth() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (empty($authHeader)) {
        return ['success' => false, 'message' => 'Token di autenticazione mancante'];
    }

    $token = str_replace('Bearer ', '', $authHeader);
    $tokenManager = new TokenManager();

    if (!$tokenManager->validateToken($token)) {
        return ['success' => false, 'message' => 'Token non valido o scaduto'];
    }

    return ['success' => true];
}

function getAuthMiddleware() {
    $result = verifyAuth();
    if (!$result['success']) {
        http_response_code(401);
        echo json_encode($result);
        exit;
    }
    return true;
}

function getAuthToken(): string {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    return str_replace('Bearer ', '', $authHeader);
}

function getAuthUserId(): ?int {
    $token = getAuthToken();
    if (empty($token)) return null;
    $tokenManager = new TokenManager();
    return $tokenManager->getUserIdFromToken($token);
}

function getAuthRole(): ?string {
    $token = getAuthToken();
    if (empty($token)) return null;
    $tokenManager = new TokenManager();
    return $tokenManager->getRoleFromToken($token);
}

function getAuthTournamentId(): ?int {
    $token = getAuthToken();
    if (empty($token)) return null;
    $tokenManager = new TokenManager();
    return $tokenManager->getTournamentIdFromToken($token);
}

function requireTournamentOwnership(int $requestedTournamentId): void {
    $role = getAuthRole();
    // Super admin can access all tournaments
    if ($role === 'admin') return;

    $userTournamentId = getAuthTournamentId();
    if ($userTournamentId === null || $userTournamentId !== $requestedTournamentId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Non autorizzato per questo torneo']);
        exit;
    }
}
