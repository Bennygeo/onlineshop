<?php
date_default_timezone_set('Asia/Kolkata');
// Set CORS headers immediately for frontend integration
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, HEAD");
header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Skip-Loader, X-Background-Request, *");
if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
    header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
}
header("Access-Control-Max-Age: 86400");
header("Content-Type: application/json; charset=UTF-8");

// Enable GZIP compression if supported by browser/client
if (!ob_get_level() && extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    @ob_start('ob_gzhandler');
}

// Handle preflight OPTIONS request immediately
if (isset($_SERVER['REQUEST_METHOD']) && strtoupper($_SERVER['REQUEST_METHOD']) === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/logger.php';

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', Logger::getLogDir() . '/php_errors.log');

// Global PHP Error Handler
set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    $level = Logger::WARN;
    if ($severity === E_ERROR || $severity === E_USER_ERROR || $severity === E_CORE_ERROR || $severity === E_COMPILE_ERROR) {
        $level = Logger::ERROR;
    }
    Logger::log($level, $message, ['file' => $file, 'line' => $line], 'backend');
    return false;
});

// Global Uncaught Exception Handler
set_exception_handler(function (Throwable $ex) {
    Logger::critical("Uncaught Exception: " . $ex->getMessage(), [
        'file' => $ex->getFile(),
        'line' => $ex->getLine(),
        'trace' => $ex->getTraceAsString()
    ], 'backend');
    sendJson(['error' => 'Internal server error occurred'], 500);
});

// Global Fatal Shutdown Handler
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR])) {
        Logger::critical("PHP Fatal Error: " . $error['message'], [
            'file' => $error['file'],
            'line' => $error['line']
        ], 'backend');
        if (!headers_sent()) {
            http_response_code(500);
            echo json_encode(['error' => 'Fatal Server Error: ' . $error['message']]);
        }
    }
});

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

if (!defined('GEMINI_API_KEY')) {
    define('GEMINI_API_KEY', getenv('GEMINI_API_KEY') ?: '');
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 1
    ]);

    // Auto-ensure required columns exist in production
    ensureSchemaColumns($pdo);
} catch (PDOException $e) {
    if ($isLocal) {
        // Instant SQLite fallback for local dev when MySQL is not running
        try {
            $sqliteFile = __DIR__ . '/local_db.sqlite';
            $pdo = new PDO("sqlite:" . $sqliteFile, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            initSqliteTables($pdo);
        } catch (Exception $sqle) {
            Logger::critical("SQLite Fallback Failed: " . $sqle->getMessage());
            $pdo = null;
        }
    } else {
        Logger::critical("Database Connection Failed: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
        $pdo = null;
    }
}

function initSqliteTables($pdo) {
    if (!$pdo) return;
    static $sqliteInit = false;
    if ($sqliteInit) return;
    $sqliteInit = true;

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS user_addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mobile TEXT,
            name TEXT,
            address TEXT,
            pincode TEXT,
            landmark TEXT,
            title TEXT DEFAULT 'My Home',
            is_default INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mobile TEXT UNIQUE,
            name TEXT,
            email TEXT,
            pincode TEXT,
            address TEXT,
            referral_id TEXT,
            referred_by TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            mobile TEXT NOT NULL,
            address_id INTEGER DEFAULT NULL,
            address_json TEXT DEFAULT NULL,
            total_amount REAL NOT NULL,
            payment_type TEXT DEFAULT 'COD',
            status TEXT DEFAULT 'PLACED',
            delivery_date DATE DEFAULT NULL,
            order_source TEXT DEFAULT 'CLIENT_WEB',
            created_by TEXT DEFAULT NULL,
            delivery_inst TEXT,
            delivery_mode TEXT DEFAULT '',
            delivery_option TEXT DEFAULT 'next_day',
            delivery_expected_at TEXT DEFAULT '',
            delivery_cutoff_ist TEXT DEFAULT '',
            delivered_at DATETIME NULL,
            undelivered_reason TEXT DEFAULT NULL,
            refund_amount REAL DEFAULT 0.00,
            refund_notes TEXT DEFAULT NULL,
            assigned_to TEXT DEFAULT '',
            coupon TEXT DEFAULT NULL,
            coupon_discount REAL DEFAULT 0.00,
            referral_code TEXT DEFAULT NULL,
            referred_by TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT DEFAULT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            price REAL NOT NULL,
            item_status TEXT DEFAULT 'packed',
            missing_qty INTEGER DEFAULT 0,
            refund_amount REAL DEFAULT 0.00,
            subscriptionType TEXT DEFAULT 'none',
            rangeDates TEXT,
            subscribedDates TEXT,
            subsStatus TEXT DEFAULT 'active',
            pausedDates TEXT,
            startDate TEXT DEFAULT '',
            endDate TEXT DEFAULT ''
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tamil_name TEXT DEFAULT NULL,
            cat TEXT DEFAULT NULL,
            sub_cat TEXT DEFAULT NULL,
            price REAL NOT NULL DEFAULT 0.00,
            original_price REAL NOT NULL DEFAULT 0.00,
            stock_price REAL DEFAULT 0.00,
            profit_percent INTEGER DEFAULT 0,
            show_off_percent INTEGER DEFAULT 0,
            weight INTEGER DEFAULT 500,
            original_weight INTEGER DEFAULT 500,
            unit_name TEXT DEFAULT 'grams',
            original_unit_name TEXT DEFAULT 'grams',
            img_url TEXT DEFAULT NULL,
            disabled INTEGER DEFAULT 0,
            preferred_days TEXT DEFAULT '[]',
            index_num INTEGER DEFAULT 0,
            offer INTEGER DEFAULT 0,
            in_stock INTEGER DEFAULT 1,
            stock_qty REAL DEFAULT 100.00,
            gst_percent REAL DEFAULT 5.00,
            subscribe_flg INTEGER DEFAULT 0,
            allow_next_day INTEGER DEFAULT 1,
            allow_immediate_10 INTEGER DEFAULT 0,
            allow_immediate_30 INTEGER DEFAULT 0,
            allow_immediate_60 INTEGER DEFAULT 0,
            is_unlimited INTEGER DEFAULT 0
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            discount_percent REAL DEFAULT 0.00,
            max_discount REAL DEFAULT 0.00,
            min_order_amount REAL DEFAULT 0.00,
            disabled INTEGER DEFAULT 0,
            count INTEGER DEFAULT 5,
            categories TEXT DEFAULT 'all',
            description TEXT DEFAULT NULL,
            offer TEXT DEFAULT NULL,
            offer_desc TEXT DEFAULT NULL
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS user_coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mobile TEXT NOT NULL,
            coupon_code TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            status INTEGER DEFAULT 1,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS delivery_partners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            status TEXT DEFAULT 'active'
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS daily_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_date DATE NOT NULL,
            procurement REAL DEFAULT 0.00,
            rent REAL DEFAULT 0.00,
            delivery REAL DEFAULT 0.00,
            electricity REAL DEFAULT 0.00,
            packaging REAL DEFAULT 0.00,
            salaries REAL DEFAULT 0.00,
            marketing REAL DEFAULT 0.00,
            other REAL DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS store_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT,
            source TEXT DEFAULT 'backend',
            message TEXT,
            file TEXT,
            line INTEGER,
            trace TEXT,
            url TEXT,
            user_info TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mobile TEXT,
            total REAL DEFAULT 0,
            ledger_balance REAL DEFAULT 0,
            status TEXT DEFAULT 'authorized',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        // Seed products if empty
        $pCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
        if ($pCount === 0) {
            $seedSql = @file_get_contents(__DIR__ . '/../schema_products_seed.sql');
            if ($seedSql) {
                // Convert MySQL INSERT INTO ... ON DUPLICATE KEY UPDATE to SQLite INSERT OR REPLACE
                $statements = explode(";\n", $seedSql);
                foreach ($statements as $stmtSql) {
                    $stmtSql = trim($stmtSql);
                    if ($stmtSql) {
                        $sqliteStmt = preg_replace('/INSERT INTO `products`/', 'INSERT OR REPLACE INTO `products`', $stmtSql);
                        $sqliteStmt = preg_replace('/ON DUPLICATE KEY UPDATE.*$/i', '', $sqliteStmt);
                        try {
                            $pdo->exec($sqliteStmt);
                        } catch (Exception $pe) {}
                    }
                }
            }
        }
    } catch (Exception $e) {}
}

function ensureSchemaColumns($pdo) {
    if (!$pdo) return;
    static $ensured = false;
    if ($ensured) return;
    $ensured = true;

    $cacheFile = __DIR__ . '/.schema_ensured';
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 86400)) {
        return;
    }

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `system_logs` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `level` VARCHAR(20) NOT NULL,
            `source` VARCHAR(20) DEFAULT 'backend',
            `message` TEXT NOT NULL,
            `file` VARCHAR(255) DEFAULT NULL,
            `line` INT DEFAULT NULL,
            `trace` MEDIUMTEXT DEFAULT NULL,
            `url` VARCHAR(500) DEFAULT NULL,
            `user_info` VARCHAR(500) DEFAULT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (`level`),
            INDEX idx_source (`source`),
            INDEX idx_created_at (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Exception $e) {}

    $columns = [
        "orders" => [
            "assigned_to VARCHAR(100) DEFAULT ''",
            "delivery_inst TEXT",
            "delivery_mode VARCHAR(100) DEFAULT ''",
            "delivered_at DATETIME NULL",
            "undelivered_reason VARCHAR(255) DEFAULT NULL",
            "refund_amount DECIMAL(10,2) DEFAULT 0.00",
            "refund_notes TEXT DEFAULT NULL",
            "coupon VARCHAR(50) DEFAULT NULL",
            "coupon_discount DECIMAL(10,2) DEFAULT 0.00",
            "referral_code VARCHAR(50) DEFAULT NULL",
            "referred_by VARCHAR(100) DEFAULT NULL"
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
            "referral_id VARCHAR(50) DEFAULT NULL",
            "referred_by VARCHAR(50) DEFAULT NULL"
        ],
        "coupons" => [
            "count INT DEFAULT 5",
            "categories VARCHAR(255) DEFAULT 'all'",
            "description VARCHAR(255) DEFAULT NULL",
            "offer VARCHAR(100) DEFAULT NULL",
            "offer_desc VARCHAR(255) DEFAULT NULL"
        ],
        "products" => [
            "in_stock INT DEFAULT 1",
            "stock_qty DECIMAL(10,2) DEFAULT 100.00",
            "gst_percent DECIMAL(5,2) DEFAULT 5.00",
            "stock_price DECIMAL(10,2) DEFAULT 0.00",
            "profit_percent DECIMAL(5,2) DEFAULT 10.00",
            "preferred_days VARCHAR(255) DEFAULT '[]'",
            "subscribe_flg INT DEFAULT 0",
            "allow_next_day INT DEFAULT 1",
            "allow_immediate_10 INT DEFAULT 0",
            "allow_immediate_30 INT DEFAULT 0",
            "allow_immediate_60 INT DEFAULT 0",
            "is_unlimited TINYINT(1) DEFAULT 0"
        ]
    ];

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `store_settings` (
            `key` VARCHAR(100) PRIMARY KEY,
            `value` TEXT,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {}

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

    @touch(__DIR__ . '/.schema_ensured');
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
 * Send JSON response with optional HTTP caching & ETag support
 */
function sendJson($data, $statusCode = 200, $maxAge = 0) {
    http_response_code($statusCode);
    header("Content-Type: application/json; charset=UTF-8");

    if ($maxAge > 0) {
        header("Cache-Control: public, max-age={$maxAge}, stale-while-revalidate=60");
    }

    $json = json_encode($data);

    // ETag caching for idempotent status 200 responses
    if ($statusCode === 200) {
        $rawEtag = md5($json);
        $etag = '"' . $rawEtag . '"';
        header("ETag: {$etag}");

        if (isset($_SERVER['HTTP_IF_NONE_MATCH'])) {
            $clientEtag = trim(preg_replace('/^W\//i', '', trim($_SERVER['HTTP_IF_NONE_MATCH'])), "\" \t\n\r\0\x0B");
            if ($clientEtag === $rawEtag) {
                http_response_code(304);
                exit();
            }
        }
    }

    echo $json;
    exit();
}

/**
 * Get active PDO connection or null
 */
function getDbConnection() {
    global $pdo;
    return $pdo;
}
