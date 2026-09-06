<?php
// Set CORS headers for frontend integration
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$isLocal = isset($_SERVER['HTTP_HOST']) && (
    str_contains($_SERVER['HTTP_HOST'], 'localhost') || 
    str_contains($_SERVER['HTTP_HOST'], '127.0.0.1')
);

if ($isLocal) {
    $host   = 'localhost';
    $dbname = 'thinkspot_db';
    $user   = 'root';
    $pass   = '';
} else {
    // Production BigRock Hosting Credentials
    $host   = 'localhost';
    $dbname = 'onenesgw_thinkspot_db';
    $user   = 'onenesgw_thinkspot';
    $pass   = 'silenceRocks@77';
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    $pdo = null;
}

/**
 * Get request parameter from $_POST or raw JSON input
 */
function getParam($key, $default = null) {
    if (isset($_POST[$key])) {
        return $_POST[$key];
    }
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $json = json_decode($rawInput, true);
        if (isset($json[$key])) {
            return $json[$key];
        }
    }
    return $default;
}

/**
 * Send JSON response
 */
function sendJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}
