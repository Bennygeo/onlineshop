<?php
require_once __DIR__ . '/../config/db.php';

$data = null;

// 1. Check getParam('data') or getParam('orders')
$raw = getParam('data') ?: getParam('orders');
if ($raw) {
    $data = is_string($raw) ? json_decode($raw, true) : $raw;
}

// 2. Check direct $_POST
if (!$data && !empty($_POST)) {
    if (isset($_POST['orders'])) {
        $data = is_string($_POST['orders']) ? json_decode($_POST['orders'], true) : $_POST['orders'];
    } elseif (isset($_POST['data'])) {
        $data = is_string($_POST['data']) ? json_decode($_POST['data'], true) : $_POST['data'];
    } elseif (isset($_POST['product_ids'])) {
        $data = ['product_ids' => is_string($_POST['product_ids']) ? json_decode($_POST['product_ids'], true) : $_POST['product_ids']];
    } else {
        $data = $_POST;
    }
}

// 3. Fallback to raw php://input
if (!$data) {
    $rawInput = file_get_contents('php://input');
    if ($rawInput) {
        $data = json_decode($rawInput, true);
    }
}

if (!$data) {
    sendJson(['error' => 'No reorder payload provided'], 400);
}

if (!$pdo) {
    sendJson(['error' => 'Database connection unavailable'], 500);
}

$itemsToUpdate = [];

// Format 1: Object with 'orders' => [{id, index_num}, ...]
if (isset($data['orders']) && is_array($data['orders'])) {
    foreach ($data['orders'] as $idx => $item) {
        if (is_array($item) && isset($item['id'])) {
            $pId = trim($item['id']);
            $orderNum = isset($item['index_num']) ? intval($item['index_num']) : ($idx + 1);
            $itemsToUpdate[] = ['id' => $pId, 'index_num' => $orderNum];
        } elseif (is_string($item)) {
            $itemsToUpdate[] = ['id' => trim($item), 'index_num' => ($idx + 1)];
        }
    }
}
// Format 2: Object with 'product_ids' => ['id1', 'id2', ...]
else if (isset($data['product_ids']) && is_array($data['product_ids'])) {
    foreach ($data['product_ids'] as $idx => $pId) {
        if (!empty($pId)) {
            $itemsToUpdate[] = ['id' => trim($pId), 'index_num' => ($idx + 1)];
        }
    }
}
// Format 3: Direct array of products [{id: '...', ...}] or ['id1', 'id2']
else if (is_array($data)) {
    foreach ($data as $idx => $item) {
        if (is_array($item) && isset($item['id'])) {
            $pId = trim($item['id']);
            $orderNum = isset($item['index_num']) ? intval($item['index_num']) : (isset($item['index']) ? intval($item['index']) : ($idx + 1));
            $itemsToUpdate[] = ['id' => $pId, 'index_num' => $orderNum];
        } elseif (is_string($item) && !empty($item)) {
            $itemsToUpdate[] = ['id' => trim($item), 'index_num' => ($idx + 1)];
        }
    }
}

if (empty($itemsToUpdate)) {
    sendJson(['error' => 'No valid product ordering items found in payload', 'received' => $data], 400);
}

// Find all product tables (products, zone1_products_new_1, zone2_products_new_1, etc.)
$tables = ['products'];
try {
    $stmtTbls = $pdo->query("SHOW TABLES LIKE '%products%'");
    $dbTbls = $stmtTbls->fetchAll(PDO::FETCH_COLUMN);
    if (!empty($dbTbls)) {
        $tables = $dbTbls;
    }
} catch (Exception $e) {}

// Ensure index_num column exists on all tables
foreach ($tables as $t) {
    try {
        $pdo->exec("ALTER TABLE `{$t}` ADD COLUMN index_num INT DEFAULT 0");
    } catch (Exception $eCol) {}
}

$updatedCount = 0;

try {
    if ($pdo->inTransaction()) {
        $pdo->commit();
    }
    $pdo->beginTransaction();

    foreach ($tables as $t) {
        $stmt = $pdo->prepare("UPDATE `{$t}` SET index_num = ? WHERE id = ?");
        foreach ($itemsToUpdate as $it) {
            $stmt->execute([$it['index_num'], $it['id']]);
            if ($t === 'products') {
                $updatedCount++;
            }
        }
    }

    $pdo->commit();

    sendJson([
        'status' => 'SUCCESS',
        'message' => 'Custom product ordering saved successfully!',
        'updated_count' => $updatedCount
    ]);
} catch (Exception $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(['error' => 'Failed to save product ordering: ' . $ex->getMessage()], 500);
}
