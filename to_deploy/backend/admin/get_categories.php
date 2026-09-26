<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson(['error' => 'Database connection failed'], 500);
}

try {
    // 1. Create categories table if not exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS `categories` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `key_name` VARCHAR(100) NOT NULL UNIQUE,
        `label` VARCHAR(150) NOT NULL,
        `img_url` VARCHAR(255) DEFAULT '',
        `disabled` TINYINT(1) DEFAULT 0,
        `sort_order` INT DEFAULT 0,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Ensure default categories are populated if table is empty
    $countStmt = $pdo->query("SELECT COUNT(*) FROM `categories`");
    $catCount = (int)$countStmt->fetchColumn();

    if ($catCount === 0) {
        $defaultCategories = [
            ['key' => 'Vegetables', 'label' => 'Vegetables', 'img' => 'assets/categories/Thinkspot_veggiesIcon.png'],
            ['key' => 'Naturalhydrants', 'label' => 'Natural Hydrants (Tender Coconut)', 'img' => 'assets/categories/tender.png'],
            ['key' => 'Fruits', 'label' => 'Fruits', 'img' => 'assets/categories/fruits.png'],
            ['key' => 'Greenssprouts', 'label' => 'Greens & Sprouts', 'img' => 'assets/categories/greens.png'],
            ['key' => 'Flowers', 'label' => 'Flowers', 'img' => 'assets/categories/flowers.png'],
            ['key' => 'Honeyspices', 'label' => 'Honey & Spices', 'img' => 'assets/categories/spices.png'],
            ['key' => 'Woodpressed', 'label' => 'Woodpressed Oils', 'img' => 'assets/categories/oil.png'],
            ['key' => 'Dairyeggs', 'label' => 'Dairy & Eggs (Milk)', 'img' => 'assets/categories/dairy.png'],
            ['key' => 'Naturalsugars', 'label' => 'Natural Sugars', 'img' => 'assets/categories/sugar.png'],
            ['key' => 'Lentilspulses', 'label' => 'Lentils & Pulses', 'img' => 'assets/categories/lentils.png'],
            ['key' => 'Breakfast', 'label' => 'Breakfast & Batter', 'img' => 'assets/categories/breakfast.png'],
            ['key' => 'Quickmeals', 'label' => 'Quick Meals', 'img' => 'assets/categories/meals.png'],
            ['key' => 'Traditionalsnacks', 'label' => 'Traditional Snacks', 'img' => 'assets/categories/snacks.png'],
            ['key' => 'Skinhair', 'label' => 'Skin & Hair Care', 'img' => 'assets/categories/care.png'],
            ['key' => 'Veg', 'label' => 'Veg', 'img' => 'assets/categories/veg.png'],
            ['key' => 'Oils', 'label' => 'Oils', 'img' => 'assets/categories/oil.png'],
            ['key' => 'Eggs', 'label' => 'Eggs', 'img' => 'assets/categories/dairy.png'],
            ['key' => 'Milk', 'label' => 'Milk', 'img' => 'assets/categories/dairy.png'],
            ['key' => 'Tender', 'label' => 'Tender Coconut', 'img' => 'assets/categories/tender.png'],
            ['key' => 'Sprouts', 'label' => 'Sprouts', 'img' => 'assets/categories/greens.png'],
            ['key' => 'Batter', 'label' => 'Batter', 'img' => 'assets/categories/breakfast.png'],
            ['key' => 'Breads', 'label' => 'Breads', 'img' => 'assets/categories/breakfast.png'],
            ['key' => 'Pickles', 'label' => 'Pickles', 'img' => 'assets/categories/snacks.png'],
            ['key' => 'Pets', 'label' => 'Pets', 'img' => 'assets/categories/care.png'],
            ['key' => 'Vegan', 'label' => 'Vegan', 'img' => 'assets/categories/veg.png']
        ];

        // Also merge any distinct categories currently in products table
        $prodCatsStmt = $pdo->query("SELECT DISTINCT cat FROM products WHERE cat IS NOT NULL AND cat != ''");
        $prodCats = $prodCatsStmt->fetchAll(PDO::FETCH_COLUMN);

        $ins = $pdo->prepare("INSERT IGNORE INTO `categories` (key_name, label, img_url) VALUES (?, ?, ?)");
        foreach ($defaultCategories as $c) {
            $ins->execute([$c['key'], $c['label'], $c['img']]);
        }
        foreach ($prodCats as $pc) {
            $ins->execute([$pc, $pc, 'assets/categories/Thinkspot_veggiesIcon.png']);
        }
    }

    // 3. Fetch all categories and attach product count
    $stmt = $pdo->query("SELECT id, key_name, label, img_url, disabled, sort_order, created_at FROM `categories` WHERE disabled = 0 ORDER BY label ASC");
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Compute count of products for each category
    $countMap = [];
    try {
        $pStmt = $pdo->query("SELECT cat, COUNT(*) as cnt FROM `products` WHERE cat IS NOT NULL AND cat != '' GROUP BY cat");
        while ($row = $pStmt->fetch(PDO::FETCH_ASSOC)) {
            $countMap[strtolower(trim($row['cat']))] = (int)$row['cnt'];
        }
    } catch (Exception $e) {}

    foreach ($categories as &$cat) {
        $k = strtolower(trim($cat['key_name']));
        $cat['product_count'] = isset($countMap[$k]) ? $countMap[$k] : 0;
        $cat['key'] = $cat['key_name'];
    }

    sendJson($categories);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
