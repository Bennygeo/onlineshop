<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->query("SELECT id, username, password, name, phone, zone, vehicle, status FROM delivery_partners ORDER BY id ASC");
    $partners = $stmt->fetchAll();

    foreach ($partners as &$dp) {
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE assigned_to = ? AND status NOT IN ('DELIVERED', 'CANCELLED')");
        $countStmt->execute([$dp['name']]);
        $dp['activeOrders'] = (int)$countStmt->fetchColumn();
    }

    sendJson($partners);
} catch (Exception $e) {
    // Fallback static array if query fails
    sendJson([
        ['id' => '1', 'username' => 'delivery1', 'password' => 'partner123', 'name' => 'Ramesh Kumar', 'phone' => '9876543210', 'zone' => 'Zone 1 (Central & North)', 'vehicle' => 'TN-37-AB-1001', 'status' => 'Available', 'activeOrders' => 0],
        ['id' => '2', 'username' => 'delivery2', 'password' => 'partner123', 'name' => 'Suresh Raj', 'phone' => '9876543211', 'zone' => 'Zone 2 (East & South)', 'vehicle' => 'TN-38-CD-2002', 'status' => 'Available', 'activeOrders' => 0],
        ['id' => '3', 'username' => 'delivery3', 'password' => 'partner123', 'name' => 'Karthik P', 'phone' => '9876543212', 'zone' => 'Zone 1 (Central & North)', 'vehicle' => 'TN-37-EF-3003', 'status' => 'Available', 'activeOrders' => 0],
        ['id' => '4', 'username' => 'delivery4', 'password' => 'partner123', 'name' => 'Vignesh M', 'phone' => '9876543213', 'zone' => 'Zone 2 (East & South)', 'vehicle' => 'TN-37-GH-4004', 'status' => 'Available', 'activeOrders' => 0],
        ['id' => '5', 'username' => 'delivery5', 'password' => 'partner123', 'name' => 'Manikandan S', 'phone' => '9876543214', 'zone' => 'All Zones', 'vehicle' => 'TN-38-JK-5005', 'status' => 'Available', 'activeOrders' => 0]
    ]);
}
