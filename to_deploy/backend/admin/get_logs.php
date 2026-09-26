<?php
require_once __DIR__ . '/../config/db.php';

$limit = min(intval(getParam('limit', 100)), 500);
$level = getParam('level'); // Optional filter (ERROR, WARN, etc.)
$source = getParam('source'); // Optional filter (backend, frontend)

$response = [
    'success' => true,
    'db_logs' => [],
    'recent_file_lines' => []
];

if ($pdo) {
    try {
        $where = [];
        $params = [];

        if (!empty($level)) {
            $where[] = "level = ?";
            $params[] = strtoupper($level);
        }
        if (!empty($source)) {
            $where[] = "source = ?";
            $params[] = strtolower($source);
        }

        $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        $sql = "SELECT id, level, source, message, file, line, trace, url, user_info, created_at 
                FROM system_logs 
                $whereSql 
                ORDER BY created_at DESC 
                LIMIT $limit";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $response['db_logs'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $response['db_error'] = $e->getMessage();
    }
}

// Read last 50 lines from today's log file
try {
    $todayFile = Logger::getLogDir() . '/app_' . date('Y-m-d') . '.log';
    if (file_exists($todayFile)) {
        $lines = file($todayFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines !== false) {
            $response['recent_file_lines'] = array_slice($lines, -50);
        }
    }
} catch (Throwable $e) {
    // Ignore file read error
}

sendJson($response);
