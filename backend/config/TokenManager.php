<?php
class TokenManager
{
    private ?string $secret = null;

    public function __construct()
    {
        $this->secret = null;

        // 1. Prova da variabile d'ambiente
        $envSecret = getenv('FUTSAL_TOKEN_SECRET');
        if ($envSecret && strlen($envSecret) >= 32) {
            $this->secret = $envSecret;
        }

        // 2. Prova da file .env
        if (!$this->secret) {
            $envFile = dirname(__DIR__) . '/.env';
            if (file_exists($envFile)) {
                $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (strpos($line, 'FUTSAL_TOKEN_SECRET=') === 0) {
                        $value = substr($line, 20);
                        if (strlen($value) >= 32) {
                            $this->secret = $value;
                        }
                        break;
                    }
                }
            }
        }

        // 3. Errore fatale se non trovato
        if (!$this->secret) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Errore di configurazione del server']);
            exit;
        }
    }

    public function generateToken(int $userId, string $role = 'admin', ?int $tournamentId = null): string
    {
        $payload = base64_encode(json_encode([
            'id'            => $userId,
            'role'          => $role,
            'tournament_id' => $tournamentId,
            'exp'           => time() + 3600,
        ]));

        $signature = hash_hmac('sha512', $payload, $this->secret);

        return "{$payload}.{$signature}";
    }

    public function validateToken(string $token): bool
    {
        $parts = explode('.', $token);

        if (count($parts) !== 2) {
            return false;
        }

        $payload   = $parts[0];
        $signature = $parts[1];

        $expectedSignature = hash_hmac('sha512', $payload, $this->secret);

        if (!hash_equals($expectedSignature, $signature)) {
            return false;
        }

        $data = json_decode(base64_decode($payload), true);

        if (!$data) {
            return false;
        }

        if (isset($data['exp']) && $data['exp'] < time()) {
            return false;
        }

        return true;
    }

    public function getUserIdFromToken(string $token): ?int
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;

        $payload = $parts[0];
        $signature = $parts[1];

        $expectedSignature = hash_hmac('sha512', $payload, $this->secret);
        if (!hash_equals($expectedSignature, $signature)) return null;

        $data = json_decode(base64_decode($payload), true);
        if (!$data || !isset($data['id'])) return null;
        if (isset($data['exp']) && $data['exp'] < time()) return null;

        return (int) $data['id'];
    }

    public function getRoleFromToken(string $token): ?string
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;

        $payload = $parts[0];
        $signature = $parts[1];

        $expectedSignature = hash_hmac('sha512', $payload, $this->secret);
        if (!hash_equals($expectedSignature, $signature)) return null;

        $data = json_decode(base64_decode($payload), true);
        if (!$data) return null;
        if (isset($data['exp']) && $data['exp'] < time()) return null;

        return $data['role'] ?? null;
    }

    public function getTournamentIdFromToken(string $token): ?int
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;

        $payload = $parts[0];
        $signature = $parts[1];

        $expectedSignature = hash_hmac('sha512', $payload, $this->secret);
        if (!hash_equals($expectedSignature, $signature)) return null;

        $data = json_decode(base64_decode($payload), true);
        if (!$data) return null;
        if (isset($data['exp']) && $data['exp'] < time()) return null;

        return isset($data['tournament_id']) ? (int) $data['tournament_id'] : null;
    }
}
