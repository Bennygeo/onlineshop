<?php
error_reporting(0);
ini_set('display_errors', '0');

// Set CORS headers for frontend integration
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$isLocal = !isset($_SERVER['HTTP_HOST']) || php_sapi_name() === 'cli' || (
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

    // Auto-ensure required columns exist in production
    ensureSchemaColumns($pdo);
} catch (PDOException $e) {
    $pdo = null;
}

function ensureSchemaColumns($pdo) {
    if (!$pdo) return;
    static $ensured = false;
    if ($ensured) return;
    $ensured = true;

    $columns = [
        "orders" => [
            "assigned_to VARCHAR(100) DEFAULT ''",
            "delivery_inst TEXT",
            "delivery_mode VARCHAR(100) DEFAULT ''",
            "delivered_at DATETIME NULL",
            "undelivered_reason VARCHAR(255) DEFAULT NULL",
            "refund_amount DECIMAL(10,2) DEFAULT 0.00",
            "refund_notes TEXT DEFAULT NULL"
        ],
        "order_items" => [
            "item_status VARCHAR(50) DEFAULT 'packed'",
            "missing_qty INT DEFAULT 0",
            "refund_amount DECIMAL(10,2) DEFAULT 0.00",
            "subscriptionType VARCHAR(50) DEFAULT 'none'",
            "rangeDates TEXT",
            "subscribedDates TEXT",
            "subsStatus VARCHAR(50) DEFAULT 'active'",
            "pausedDates TEXT",
            "startDate VARCHAR(50) DEFAULT ''",
            "endDate VARCHAR(50) DEFAULT ''"
        ],
        "wallets" => [
            "status VARCHAR(20) DEFAULT 'authorized'"
        ],
        "users" => [
            "referral_id VARCHAR(50) DEFAULT NULL"
        ],
        "coupons" => [
            "count INT DEFAULT 5",
            "categories VARCHAR(255) DEFAULT 'all'",
            "description VARCHAR(255) DEFAULT NULL",
            "offer VARCHAR(100) DEFAULT NULL",
            "offer_desc VARCHAR(255) DEFAULT NULL"
        ]
    ];

    foreach ($columns as $table => $cols) {
        foreach ($cols as $colDef) {
            try {
                $pdo->exec("ALTER TABLE `$table` ADD COLUMN $colDef");
            } catch (Exception $ex) {
                // Column already exists or table not yet created
            }
        }
    }

    // Bi-directional sync: if either razorpay_orders or wallets table is cleared, clear the other
    syncWalletAndRazorpayTables($pdo);
}

function syncWalletAndRazorpayTables($pdo) {
    // Safe no-op to prevent destructive deletion of wallet records
    return;
}

/**
 * Get request parameter from $_POST or raw JSON input
 */
function getParam($key, $default = null) {
    if (isset($_GET[$key])) {
        return $_GET[$key];
    }
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
