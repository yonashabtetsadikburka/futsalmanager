<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo non consentito']);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->name) && strlen($data->name) > 100) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Nome troppo lungo (max 100 caratteri)"]);
    exit;
}
if (!empty($data->logo_url) && strlen($data->logo_url) > 500) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "URL logo troppo lungo (max 500 caratteri)"]);
    exit;
}
if (!empty($data->location) && strlen($data->location) > 255) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Luogo troppo lungo (max 255 caratteri)"]);
    exit;
}

if (empty($data->name)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Nome torneo obbligatorio"
    ]);
    exit;
}

$type = $data->type ?? '5v5';
$validTypes = ['5v5', '7v7'];
if (!in_array($type, $validTypes)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Tipo torneo non valido. Valori ammessi: 5v5, 7v7"
    ]);
    exit;
}

$format = $data->format ?? 'girone';
$validFormats = ['girone', 'round_robin'];
if (!in_array($format, $validFormats)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Formato non valido. Valori ammessi: girone, round_robin"
    ]);
    exit;
}

$hasKnockout = intval($data->has_knockout ?? 0);
if ($hasKnockout && $format !== 'girone') {
    $hasKnockout = 0;
}

// Validate logo_url safety
if (!empty($data->logo_url)) {
    $logoUrl = trim($data->logo_url);
    // Block dangerous URI schemes
    if (preg_match('/^(javascript|data|vbscript):/i', $logoUrl)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "URL del logo non valido"]);
        exit;
    }
    // Ensure it's a relative path or starts with /uploads/
    if (!empty($logoUrl) && !preg_match('/^(\/|uploads\/|https?:\/\/)/', $logoUrl)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "URL del logo non valido"]);
        exit;
    }
}

try {
    $logoUrl = $data->logo_url ?? null;
    $location = !empty($data->location) ? trim($data->location) : null;
    $startDate = !empty($data->start_date) ? trim($data->start_date) : null;
    $endDate = !empty($data->end_date) ? trim($data->end_date) : null;
    $description = !empty($data->description) ? trim($data->description) : null;
    $organizerCode = 'TOR-' . date('Y') . '-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 6));
    $query = "INSERT INTO tournaments (name, type, format, status, has_knockout, logo_url, organizer_code, location, start_date, end_date, description) VALUES (:name, :type, :format, 'active', :has_knockout, :logo_url, :organizer_code, :location, :start_date, :end_date, :description)";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(":name", $data->name);
    $stmt->bindParam(":type", $type);
    $stmt->bindParam(":format", $format);
    $stmt->bindParam(":has_knockout", $hasKnockout, PDO::PARAM_INT);
    $stmt->bindParam(":logo_url", $logoUrl);
    $stmt->bindParam(":organizer_code", $organizerCode);
    $stmt->bindParam(":location", $location);
    $stmt->bindParam(":start_date", $startDate);
    $stmt->bindParam(":end_date", $endDate);
    $stmt->bindParam(":description", $description);

    if ($stmt->execute()) {
        // Invalidate tournaments cache
        RedisCache::invalidate('tournaments:*');
        RedisCache::invalidate('stats:*');

        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Torneo creato con successo",
            "id" => $conn->lastInsertId(),
            "organizer_code" => $organizerCode
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Errore durante la creazione"
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
