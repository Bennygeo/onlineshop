<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->query("SELECT DISTINCT cat FROM products WHERE cat IS NOT NULL AND cat != '' AND disabled = 0 ORDER BY cat ASC");
    $cats = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Also build array with icons and metadata if available
    $result = [];
    foreach ($cats as $c) {
        // Find first product image or icon for this category
        $imgStmt = $pdo->prepare("SELECT img_url FROM products WHERE cat = ? AND img_url IS NOT NULL AND img_url != '' LIMIT 1");
        $imgStmt->execute([$c]);
        $imgRow = $imgStmt->fetch();
        $imgUrl = $imgRow ? $imgRow['img_url'] : '';

        $result[] = [
            'name' => $c,
            'cat' => $c,
            'imgUrl' => $imgUrl,
            'routerLink' => '/products/category/' . urlencode($c)
        ];
    }
    sendJson($result);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
