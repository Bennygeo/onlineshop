<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson(['error' => 'No database connection'], 500);
}

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

if (!$data) {
    sendJson(['error' => 'No data provided'], 400);
}

$expenseType = isset($data['expense_type']) ? strtolower(trim($data['expense_type'])) : '';
$amount = isset($data['amount']) ? floatval($data['amount']) : 0;
$expenseDate = isset($data['expense_date']) ? $data['expense_date'] : date('Y-m-d');
$notes = isset($data['notes']) ? $data['notes'] : '';

$validTypes = ['procurement', 'rent', 'delivery', 'other'];
if (!in_array($expenseType, $validTypes)) {
    sendJson(['error' => 'Invalid expense type. Must be: ' . implode(', ', $validTypes)], 400);
}

try {
    // Ensure expenses table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) DEFAULT 0,
        expense_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // Upsert: update if entry exists for this type+date, otherwise insert
    $stmtCheck = $pdo->prepare("SELECT id FROM expenses WHERE expense_type = ? AND expense_date = ?");
    $stmtCheck->execute([$expenseType, $expenseDate]);
    $existing = $stmtCheck->fetch();

    if ($existing) {
        $stmt = $pdo->prepare("UPDATE expenses SET amount = ?, notes = ? WHERE id = ?");
        $stmt->execute([$amount, $notes, $existing['id']]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO expenses (expense_type, amount, expense_date, notes) VALUES (?, ?, ?, ?)");
        $stmt->execute([$expenseType, $amount, $expenseDate, $notes]);
    }

    sendJson(['status' => 'SAVED']);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
