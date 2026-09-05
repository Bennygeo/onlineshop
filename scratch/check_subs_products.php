<?php
require_once __DIR__ . '/../backend/config/db.php';
if ($pdo) {
    $stmt = $pdo->query("SELECT id, name, cat, sub_cat FROM products WHERE LOWER(cat) LIKE '%milk%' OR LOWER(cat) LIKE '%tender%' OR LOWER(cat) LIKE '%natural%' OR LOWER(name) LIKE '%milk%' OR LOWER(name) LIKE '%coconut%' OR LOWER(name) LIKE '%tender%'");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_PRETTY_PRINT);
}
