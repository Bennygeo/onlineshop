<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson(['error' => 'Database connection failed'], 500);
}

$data = null;

// 1. Check $_POST['data']
if (isset($_POST['data'])) {
    $raw = $_POST['data'];
    $data = is_string($raw) ? (json_decode($raw, true) ?: json_decode(stripslashes($raw), true)) : $raw;
}

// 2. Check direct $_POST fields
if (!$data && (isset($_POST['id']) || isset($_POST['key_name']) || isset($_POST['key']))) {
    $data = $_POST;
}

// 3. Check JSON payload in request body
if (!$data) {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $json = json_decode($rawInput, true);
        if (isset($json['data'])) {
            $data = is_string($json['data']) ? json_decode($json['data'], true) : $json['data'];
        } elseif (is_array($json)) {
            $data = $json;
        }
    }
}

// 4. Fallback to getParam('data')
if (!$data) {
    $dataParam = getParam('data');
    if (is_string($dataParam)) {
        $data = json_decode($dataParam, true) ?: json_decode(stripslashes($dataParam), true);
    } elseif (is_array($dataParam)) {
        $data = $dataParam;
    }
}

$id = isset($data['id']) ? (int)$data['id'] : 0;
$key_name = isset($data['key_name']) ? trim($data['key_name']) : (isset($data['key']) ? trim($data['key']) : '');

if ($id <= 0 && empty($key_name)) {
    sendJson(['error' => 'Category ID or key is required for deletion'], 400);
}

try {
    if ($id > 0) {
        $stmt = $pdo->prepare("DELETE FROM `categories` WHERE id = ?");
        $stmt->execute([$id]);
    } else {
        $stmt = $pdo->prepare("DELETE FROM `categories` WHERE LOWER(key_name) = LOWER(?)");
        $stmt->execute([$key_name]);
    }

    sendJson(['status' => 'success', 'message' => 'Category removed successfully']);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
