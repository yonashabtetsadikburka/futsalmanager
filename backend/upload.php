<?php

header("Content-Type: application/json");
require_once __DIR__ . "/config/cors.php";
require_once __DIR__ . "/config/auth_middleware.php";

getAuthMiddleware();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Metodo non consentito"]);
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Nessun file caricato"]);
    exit;
}

$file = $_FILES['file'];
$type = $_POST['type'] ?? 'general';

// Whitelist dei tipi consentiti (previene path traversal)
$allowedTypes = ['logos', 'teams', 'players', 'team-photos', 'general'];
if (!in_array($type, $allowedTypes)) {
    $type = 'general';
}

$allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
$extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($extension, $allowedExtensions)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Tipo file non consentito. Usa JPG, PNG o WebP"]);
    exit;
}

$maxSize = 2 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Il file supera la dimensione massima di 2MB"]);
    exit;
}

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Errore durante il caricamento del file"]);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
if (!in_array($mimeType, $allowedMimes)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Tipo file non valido"]);
    exit;
}

$uploadDir = dirname(__DIR__) . '/frontend/assets/uploads/';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

$subDir = $type . '/';
$fullDir = $uploadDir . $subDir;
if (!is_dir($fullDir)) {
    $result = @mkdir($fullDir, 0755, true);
    if (!$result) {
        $fullDir = $uploadDir;
        $subDir = '';
    }
}

$filename = $type . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
$filepath = $fullDir . $filename;

if (!@move_uploaded_file($file['tmp_name'], $filepath)) {
    $fallbackDir = sys_get_temp_dir() . '/futsal_uploads/';
    if (!is_dir($fallbackDir)) {
        @mkdir($fallbackDir, 0755, true);
    }
    $filepath = $fallbackDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Errore durante il salvataggio del file. Permesso negato."]);
        exit;
    }
    $url = '/assets/uploads/' . $filename;
    echo json_encode([
        "success" => true,
        "message" => "File caricato con successo",
        "url" => $url,
        "filename" => $filename
    ]);
    exit;
}

if (in_array($extension, ['jpg', 'jpeg', 'png'])) {
    $source = null;
    if ($extension === 'jpg' || $extension === 'jpeg') {
        $source = @imagecreatefromjpeg($filepath);
    } elseif ($extension === 'png') {
        $source = @imagecreatefrompng($filepath);
        if ($source && imageistruecolor($source) === false) {
            $truecolor = imagecreatetruecolor(imagesx($source), imagesy($source));
            imagealphablending($truecolor, false);
            imagesavealpha($truecolor, true);
            imagecopy($truecolor, $source, 0, 0, 0, 0, imagesx($source), imagesy($source));
            imagedestroy($source);
            $source = $truecolor;
        }
    }

    if ($source) {
        $webpPath = preg_replace('/\.[^.]+$/', '.webp', $filepath);
        if (@imagewebp($source, $webpPath, 85) && filesize($webpPath) > 0) {
            imagedestroy($source);
            @unlink($filepath);
            $filename = basename($webpPath);
        } else {
            imagedestroy($source);
            @unlink($webpPath);
        }
    }
}

$url = '/assets/uploads/' . $subDir . $filename;

echo json_encode([
    "success" => true,
    "message" => "File caricato con successo",
    "url" => $url,
    "filename" => $filename
]);
?>
