<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([]);
}

$categoryIcons = [
    'Vegetables' => 'assets/categories/Thinkspot_veggiesIcon.png',
    'Naturalhydrants' => 'assets/categories/Thinkspot_tenderCocoIcon.png',
    'Fruits' => 'assets/categories/fruitsIcons.png',
    'Greenssprouts' => 'assets/categories/Thinkspot_greensIcon.png',
    'Flowers' => 'assets/categories/Thinkspot_flowers.png',
    'Honeyspices' => 'assets/categories/Thinkspot_Honey.png',
    'Woodpressed' => 'assets/categories/Thinkspot_oilsIcon.png',
    'Dairyeggs' => 'assets/categories/thinksot_milkAndEggs.png',
    'Naturalsugars' => 'assets/categories/Thinkspot_NaturalSugars.png',
    'Lentilspulses' => 'assets/categories/Thinkspot_Flour.png',
    'Breakfast' => 'assets/categories/Thinkspot_BatterIcon.png',
    'Quickmeals' => 'assets/categories/Thinkspot_ReadyMix.png',
    'Traditionalsnacks' => 'assets/categories/Thinkspot_PODI.png',
    'Skinhair' => 'assets/categories/Thinkspot_AncientSouk.png',
    'Veg' => 'assets/categories/Thinkspot_veggiesIcon.png',
    'Oils' => 'assets/categories/oil.png',
    'Eggs' => 'assets/categories/Thinkspot_EggsIcon.png',
    'Milk' => 'assets/categories/Thinkspot_milkIcon.png',
    'Tender' => 'assets/categories/Thinkspot_tenderCocoIcon.png',
    'Sprouts' => 'assets/categories/sprouts.png',
    'Batter' => 'assets/categories/Thinkspot_BatterIcon.png',
    'Breads' => 'assets/categories/Thinkspot_Breads.png',
    'Pickles' => 'assets/categories/Thinkspot_Pickles.png',
    'Pets' => 'assets/categories/Thinkspot_AncientSouk.png',
    'Vegan' => 'assets/categories/Thinkspot_veggiesIcon.png',
    'Greens' => 'assets/categories/Thinkspot_greensIcon.png'
];

try {
    try {
        $stmt = $pdo->query("SELECT id, key_name, label, img_url FROM `categories` WHERE disabled = 0 ORDER BY sort_order ASC, label ASC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($rows)) {
            $result = [];
            foreach ($rows as $r) {
                $k = $r['key_name'];
                $mappedIcon = isset($categoryIcons[$k]) ? $categoryIcons[$k] : null;
                $dbImg = !empty($r['img_url']) ? $r['img_url'] : null;

                // Prefer known category icon, otherwise DB icon or fallback
                $imgUrl = $mappedIcon ?: ($dbImg ?: 'assets/categories/Thinkspot_veggiesIcon.png');

                $result[] = [
                    'id' => $r['id'],
                    'name' => $r['label'],
                    'cat' => $r['key_name'],
                    'imgUrl' => $imgUrl,
                    'routerLink' => '/products/category/' . urlencode($r['key_name'])
                ];
            }
            sendJson($result);
        }
    } catch (Exception $e) {}

    // Fallback: distinct cats from products table
    $stmt = $pdo->query("SELECT DISTINCT cat FROM products WHERE cat IS NOT NULL AND cat != '' AND disabled = 0 ORDER BY cat ASC");
    $cats = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $result = [];
    foreach ($cats as $c) {
        $imgUrl = isset($categoryIcons[$c]) ? $categoryIcons[$c] : 'assets/categories/Thinkspot_veggiesIcon.png';

        $result[] = [
            'name' => $c,
            'cat' => $c,
            'imgUrl' => $imgUrl,
            'routerLink' => '/products/category/' . urlencode($c)
        ];
    }
    sendJson($result, 200, 300);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}

