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
if (!$data && (isset($_POST['label']) || isset($_POST['name']))) {
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

$label = isset($data['label']) ? trim($data['label']) : (isset($data['name']) ? trim($data['name']) : '');
$key_name = isset($data['key_name']) ? trim($data['key_name']) : (isset($data['key']) ? trim($data['key']) : '');
$img_url = isset($data['img_url']) ? trim($data['img_url']) : '';

if (empty($label)) {
    sendJson(['error' => 'Category label / name is required'], 400);
}

if (empty($key_name)) {
    // Generate key name: remove non-alphanumeric, camelCase/PascalCase
    $key_name = preg_replace('/[^a-zA-Z0-9]/', '', ucwords($label));
    if (empty($key_name)) {
        $key_name = 'Cat' . time();
    }
}

if (empty($img_url)) {
    $img_url = 'assets/categories/Thinkspot_veggiesIcon.png';
}

try {
    // Check if category key already exists
    $chk = $pdo->prepare("SELECT id, disabled FROM `categories` WHERE LOWER(key_name) = LOWER(?) OR LOWER(label) = LOWER(?)");
    $chk->execute([$key_name, $label]);
    $existing = $chk->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        if ($existing['disabled'] == 1) {
            // Re-enable existing category
            $upd = $pdo->prepare("UPDATE `categories` SET disabled = 0, label = ?, img_url = ? WHERE id = ?");
            $upd->execute([$label, $img_url, $existing['id']]);
            sendJson(['status' => 'success', 'message' => 'Category restored and activated', 'id' => $existing['id'], 'key' => $key_name, 'label' => $label]);
        } else {
            sendJson(['error' => 'Category already exists!'], 400);
        }
    }

    $stmt = $pdo->prepare("INSERT INTO `categories` (key_name, label, img_url, disabled) VALUES (?, ?, ?, 0)");
    $stmt->execute([$key_name, $label, $img_url]);
    $newId = $pdo->lastInsertId();

    sendJson([
        'status' => 'success',
        'message' => 'Category created successfully',
        'id' => $newId,
        'key' => $key_name,
        'label' => $label,
        'img_url' => $img_url
    ]);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
