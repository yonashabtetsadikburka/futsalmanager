<?php

header("Content-Type: application/json");
require_once __DIR__ . "/../config/cors.php";

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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
if (property_exists($data, 'logo_url') && !empty($data->logo_url) && strlen($data->logo_url) > 500) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "URL logo troppo lungo (max 500 caratteri)"]);
    exit;
}

// Validate logo_url safety
if (property_exists($data, 'logo_url') && !empty($data->logo_url)) {
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

if (empty($data->id)) {
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
    $check->bindParam(":id", $data->id, PDO::PARAM_INT);
    $check->execute();

    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Torneo non trovato"
        ]);
        exit;
    }

    $fields = [];
    $params = [];

    if (!empty($data->name)) {
        $fields[] = "name = :name";
        $params[":name"] = $data->name;
    }

    if (!empty($data->type)) {
        $validTypes = ['5v5', '7v7'];
        if (!in_array($data->type, $validTypes)) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Tipo torneo non valido"
            ]);
            exit;
        }
        $fields[] = "type = :type";
        $params[":type"] = $data->type;
    }

    if (!empty($data->status)) {
        $validStatuses = ['active', 'finished'];
        if (!in_array($data->status, $validStatuses)) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Stato torneo non valido"
            ]);
            exit;
        }
        $fields[] = "status = :status";
        $params[":status"] = $data->status;
    }

    if (property_exists($data, 'format')) {
        $validFormats = ['girone', 'round_robin'];
        if (!in_array($data->format, $validFormats)) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Formato non valido. Valori ammessi: girone, round_robin"
            ]);
            exit;
        }
        $fields[] = "format = :format";
        $params[":format"] = $data->format;
        if ($data->format === 'round_robin') {
            $fields[] = "has_knockout = 0";
        }
    }

    if (property_exists($data, 'has_knockout') && !property_exists($data, 'format')) {
        $fields[] = "has_knockout = :has_knockout";
        $params[":has_knockout"] = intval($data->has_knockout);
    }

    if (property_exists($data, 'logo_url')) {
        $fields[] = "logo_url = :logo_url";
        $params[":logo_url"] = $data->logo_url;
    }

    if (property_exists($data, 'location')) {
        $fields[] = "location = :location";
        $params[":location"] = !empty($data->location) ? trim($data->location) : null;
    }

    if (property_exists($data, 'start_date')) {
        $fields[] = "start_date = :start_date";
        $params[":start_date"] = !empty($data->start_date) ? trim($data->start_date) : null;
    }

    if (property_exists($data, 'end_date')) {
        $fields[] = "end_date = :end_date";
        $params[":end_date"] = !empty($data->end_date) ? trim($data->end_date) : null;
    }

    if (property_exists($data, 'description')) {
        $fields[] = "description = :description";
        $params[":description"] = !empty($data->description) ? trim($data->description) : null;
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Nessun campo da aggiornare"
        ]);
        exit;
    }

    $query = "UPDATE tournaments SET " . implode(", ", $fields) . " WHERE id = :id";
    $params[":id"] = $data->id;

    $stmt = $conn->prepare($query);
    $stmt->execute($params);

    // Invalidate tournaments cache
    RedisCache::invalidate('tournaments:*');
    RedisCache::invalidate('stats:*');

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Torneo aggiornato con successo"
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Errore interno del server"
    ]);
}
