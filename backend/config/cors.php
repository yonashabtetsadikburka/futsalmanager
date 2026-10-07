<?php
// CORS - origine effettiva (HTTP + HTTPS)
$allowedOrigins = [
    'http://79.72.40.74',
    'https://79.72.40.74',
    'https://burkasolutions.dev',
    'https://www.burkasolutions.dev',
    'https://futsal.burkasolutions.dev',
];
if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowedOrigins)) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Max-Age: 86400");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
