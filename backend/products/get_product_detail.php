<?php
require_once __DIR__ . '/../config/db.php';

$p_id = getParam('id') ?: (getParam('p_id') ?: getParam('product_id'));
$table_name = getParam('table_name') ?: 'products';

if (!$p_id) {
    sendJson(['error' => 'Product ID is required'], 400);
}

if (!$pdo) {
    // Return mock detailed product when db not connected
    sendJson(getMockProductDetail($p_id));
}

try {
    $tablesToSearch = [$table_name, 'products', 'zone1_products_new_1', 'zone2_products_new_1'];
    $tablesToSearch = array_values(array_unique($tablesToSearch));
    
    $product = null;
    foreach ($tablesToSearch as $tbl) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM `{$tbl}` WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1");
            $stmt->execute([$p_id, $p_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $product = $row;
                break;
            }
        } catch (Exception $eTbl) {
            continue;
        }
    }

    if (!$product) {
        // Try LIKE search as fallback
        try {
            $stmt = $pdo->prepare("SELECT * FROM `products` WHERE name LIKE ? LIMIT 1");
            $stmt->execute(["%$p_id%"]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $eLike) {}
    }

    if (!$product) {
        sendJson(['error' => 'Product not found', 'id' => $p_id], 404);
    }

    // Format fields
    $pId = $product['id'];
    $product['index'] = isset($product['index_num']) ? intval($product['index_num']) : 0;
    $product['price'] = (isset($product['price']) && floatval($product['price']) > 0) ? floatval($product['price']) : 60;
    $product['original_price'] = (isset($product['original_price']) && floatval($product['original_price']) > 0) ? floatval($product['original_price']) : floatval($product['price'] * 1.25);
    $product['weight'] = (isset($product['weight']) && intval($product['weight']) > 0) ? intval($product['weight']) : 500;
    $product['unit_name'] = !empty($product['unit_name']) ? $product['unit_name'] : 'grams';
    $product['disabled'] = (isset($product['disabled']) && ((int)$product['disabled'] === 1 || $product['disabled'] === true || $product['disabled'] === '1'));
    $product['is_unlimited'] = (isset($product['is_unlimited']) && ((int)$product['is_unlimited'] === 1 || $product['is_unlimited'] === true || $product['is_unlimited'] === '1'));
    
    $stockQty = isset($product['stock_qty']) && $product['stock_qty'] !== null ? floatval($product['stock_qty']) : 100.0;
    $isStockZero = (isset($product['in_stock']) && ((int)$product['in_stock'] === 0 || $product['in_stock'] === false || $product['in_stock'] === '0'));
    $product['in_stock'] = $product['is_unlimited'] || (!$isStockZero && $stockQty > 0);
    $product['stock_qty'] = $product['in_stock'] ? ($stockQty > 0 ? $stockQty : 100.0) : 0.0;

    $product['gst_percent'] = isset($product['gst_percent']) ? floatval($product['gst_percent']) : 5.00;
    $product['subscribe_flg'] = (isset($product['subscribe_flg']) && ((int)$product['subscribe_flg'] === 1 || $product['subscribe_flg'] === true || $product['subscribe_flg'] === '1')) ? 1 : 0;
    $product['subscribeFlg'] = ($product['subscribe_flg'] === 1);

    $product['allow_next_day'] = isset($product['allow_next_day']) ? (int)$product['allow_next_day'] : 1;
    $product['allow_immediate_10'] = isset($product['allow_immediate_10']) ? (int)$product['allow_immediate_10'] : 0;
    $product['allow_immediate_30'] = isset($product['allow_immediate_30']) ? (int)$product['allow_immediate_30'] : 0;
    $product['allow_immediate_60'] = isset($product['allow_immediate_60']) ? (int)$product['allow_immediate_60'] : 0;

    // Parse preferred days
    $rawPref = $product['preferred_days'] ?? '[]';
    if (is_array($rawPref)) {
        $product['preferred_days'] = $rawPref;
    } elseif (is_string($rawPref) && !empty($rawPref)) {
        $decoded = json_decode($rawPref, true);
        if (is_array($decoded)) {
            $product['preferred_days'] = array_values(array_filter($decoded));
        } else {
            $product['preferred_days'] = array_values(array_filter(array_map('trim', explode(',', $rawPref))));
        }
    } else {
        $product['preferred_days'] = [];
    }

    // Calculate Offer Percentage
    if ($product['original_price'] > $product['price']) {
        $diff = $product['original_price'] - $product['price'];
        $product['offer_percentage'] = round(($diff / $product['original_price']) * 100);
    } else {
        $product['offer_percentage'] = 0;
    }

    // Generate enriched details (Nutrition, Storage, Cooking, Highlights)
    $details = enrichProductDetails($product);
    $product = array_merge($product, $details);

    // Fetch related products from same category
    $related = [];
    try {
        $cat = $product['cat'] ?? '';
        $stmtRel = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, in_stock, stock_qty, is_unlimited FROM products WHERE (cat = ? OR sub_cat = ?) AND id != ? AND (disabled = 0 OR disabled IS NULL) ORDER BY RAND() LIMIT 6");
        $stmtRel->execute([$cat, $product['sub_cat'] ?? '', $pId]);
        $related = $stmtRel->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($related as &$rel) {
            $rel['price'] = floatval($rel['price'] ?? 0);
            $rel['original_price'] = floatval(!empty($rel['original_price']) ? $rel['original_price'] : $rel['price']);
            $rel['in_stock'] = (isset($rel['in_stock']) && ((int)$rel['in_stock'] === 0 || $rel['in_stock'] === false)) ? false : true;
        }
    } catch (Exception $eRel) {}

    $product['related_products'] = $related;

    sendJson($product);

} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}

/**
 * Enriches product with category-tailored & item-tailored nutritional facts,
 * storage tips, benefits, and key features.
 */
function enrichProductDetails($product) {
    $name = strtolower($product['name'] ?? '');
    $cat  = strtolower($product['cat'] ?? '');
    $tamilName = $product['tamil_name'] ?? '';

    // Default highlights
    $highlights = [
        "100% Farm Fresh & Organically Grown",
        "Directly procured from local agricultural farms",
        "Hygienically cleaned and eco-friendly packed",
        "Zero chemical preservatives added"
    ];

    $nutrients = [
        ['label' => 'Calories', 'value' => 'Low calorie density'],
        ['label' => 'Dietary Fiber', 'value' => 'Rich in natural fibers'],
        ['label' => 'Vitamins', 'value' => 'Vitamin C, Vitamin A & Folates'],
        ['label' => 'Minerals', 'value' => 'Potassium, Iron & Magnesium']
    ];

    $storageTips = [
        "Store in a cool, dry place or in the vegetable crisper compartment of your refrigerator.",
        "Keep in perforated breathable bags to maintain optimal crispness and freshness.",
        "Consume within 3 to 5 days of delivery for peak taste and nutritional potency."
    ];

    $culinaryUses = [
        "Ideal for daily curries, stir-fries, poriyals, sambar, and fresh salads.",
        "Can be steamed, sautéed, or added to nutritious soups and smoothies."
    ];

    $origin = "Local Organic Farms, Tamil Nadu";
    $shelfLife = "3 - 5 Days from harvest";

    // Category / Item Specific Customization
    if (str_contains($name, 'tomato') || str_contains($cat, 'tomato')) {
        $origin = "Fresh Harvest Farms, Krishnagiri / Hosur";
        $shelfLife = "5 - 7 Days at room temperature / cool place";
        $highlights = [
            "Handpicked vine-ripened farm tomatoes",
            "High Lycopene antioxidant content for heart & skin health",
            "Juicy, firm texture perfect for curries, rasam, and sauces",
            "Zero artificial wax or ripening agents"
        ];
        $nutrients = [
            ['label' => 'Lycopene', 'value' => 'High Antioxidant'],
            ['label' => 'Vitamin C', 'value' => '28% Daily Value'],
            ['label' => 'Potassium', 'value' => 'Supports Heart Health'],
            ['label' => 'Calories', 'value' => '18 kcal / 100g']
        ];
        $storageTips = [
            "Store stem-side down at room temperature out of direct sunlight for best flavor.",
            "Refrigerate only when fully ripe to preserve aroma and sweetness."
        ];
        $culinaryUses = [
            "Essential base for authentic South Indian Sambar, Thokku, and Rasam.",
            "Great in salads, fresh pastes, pasta sauces, and gravies."
        ];
    } elseif (str_contains($name, 'onion') || str_contains($name, 'shallot') || str_contains($name, 'vengayam')) {
        $origin = "Perambalur & Dindigul Organic Farm Belts";
        $shelfLife = "10 - 15 Days in dry ventilated pantry";
        $highlights = [
            "Organically harvested with natural pungent aroma",
            "Rich in Quercetin and sulfur compounds for immunity",
            "Crisp layers, excellent caramelization"
        ];
        $nutrients = [
            ['label' => 'Quercetin', 'value' => 'Potent Flavonoid'],
            ['label' => 'Vitamin B6 & C', 'value' => 'Metabolism & Immunity'],
            ['label' => 'Fiber', 'value' => 'Prebiotic Gut Health']
        ];
        $storageTips = [
            "Keep in an open basket in a dry, dark, well-ventilated space.",
            "Do not store right next to potatoes as moisture can cause early sprouting."
        ];
    } elseif (str_contains($name, 'milk') || str_contains($cat, 'dairy') || str_contains($cat, 'milk')) {
        $origin = "Native Cow Dairy Farms, Direct Morning Milking";
        $shelfLife = "2 - 3 Days refrigerated at 4°C";
        $highlights = [
            "100% Pure unadulterated fresh farm milk",
            "No synthetic hormones, antibiotics, or milk powder mixing",
            "Naturally rich in bio-available Calcium & A2 Beta-Casein",
            "Delivered chilled at your doorstep before 7:00 AM"
        ];
        $nutrients = [
            ['label' => 'Protein', 'value' => '3.4g / 100ml'],
            ['label' => 'Calcium', 'value' => '120mg / 100ml'],
            ['label' => 'Vitamin D & B12', 'value' => 'Bone & Nerve Strength'],
            ['label' => 'Natural Fat', 'value' => 'Wholesome & Pure']
        ];
        $storageTips = [
            "Boil thoroughly upon arrival and refrigerate below 4°C.",
            "Use clean, dry utensils to prevent premature souring."
        ];
        $culinaryUses = [
            "Ideal for making fresh morning filter coffee, tea, homemade curd, and paneer."
        ];
    } elseif (str_contains($name, 'batter') || str_contains($cat, 'batter')) {
        $origin = "Traditional Stone-Ground Kitchen, Daily Fresh Batch";
        $shelfLife = "4 - 6 Days refrigerated";
        $highlights = [
            "Stone ground using premium RO purified water",
            "Naturally fermented for 12+ hours with zero soda or preservatives",
            "Makes super soft, fluffy idlis and golden crispy dosas",
            "Made with premium urad dal and traditional parboiled rice"
        ];
        $nutrients = [
            ['label' => 'Probiotics', 'value' => 'Natural Fermentation'],
            ['label' => 'Complex Carbs', 'value' => 'Sustained Energy'],
            ['label' => 'Plant Protein', 'value' => 'Dal & Rice Balance']
        ];
        $storageTips = [
            "Keep refrigerated immediately at 2°C to 5°C to regulate fermentation speed.",
            "Bring required amount to room temperature 15 minutes before cooking."
        ];
        $culinaryUses = [
            "Day 1-2: Perfect for soft steaming hot Idlis.",
            "Day 3-5: Add a splash of water for crispy, golden roast Dosas and Uthappams."
        ];
    } elseif (str_contains($name, 'coconut') || str_contains($cat, 'naturalhydrants') || str_contains($name, 'elaneer')) {
        $origin = "Pollachi Coconut Groves, Fresh Daily Pluck";
        $shelfLife = "Best consumed within 2 days of delivery";
        $highlights = [
            "Sweet, electrolyte-rich natural tender coconut water",
            "Packed with natural potassium, magnesium, and hydration minerals",
            "Fresh tender malai / pulp inside",
            "Natural isotonic drink, zero added sugar"
        ];
        $nutrients = [
            ['label' => 'Potassium', 'value' => '600mg per nut'],
            ['label' => 'Electrolytes', 'value' => 'Instant Hydration'],
            ['label' => 'Fat', 'value' => '0% Fat & Cholesterol Free']
        ];
    } elseif (str_contains($cat, 'greens') || str_contains($name, 'keerai') || str_contains($name, 'spinach')) {
        $origin = "Local Hydroponic & Soil Green Farms, Morning Harvest";
        $shelfLife = "2 - 3 Days refrigerated";
        $highlights = [
            "Morning harvested crisp, lush green leaves",
            "Rich in natural Iron, Folate, and Chlorophyll",
            "Washed with ozone-treated water to remove field dust"
        ];
        $nutrients = [
            ['label' => 'Iron', 'value' => 'Boosts Hemoglobin'],
            ['label' => 'Folate (B9)', 'value' => 'Essential for Cellular Health'],
            ['label' => 'Dietary Fiber', 'value' => 'Aids Smooth Digestion']
        ];
    } elseif (str_contains($cat, 'woodpressed') || str_contains($name, 'oil') || str_contains($name, 'marachekku')) {
        $origin = "Traditional Cold-Press Marachekku Mills";
        $shelfLife = "6 Months in cool dark pantry";
        $highlights = [
            "Extracted using traditional wooden chekku at below 40°C",
            "Preserves natural nutrients, authentic aroma, and antioxidants",
            "Unrefined, unbleached, with zero chemical additives"
        ];
    }

    return [
        'origin' => $origin,
        'shelf_life' => $shelfLife,
        'highlights' => $highlights,
        'nutrients' => $nutrients,
        'storage_tips' => $storageTips,
        'culinary_uses' => $culinaryUses,
        'shortdesctitle' => 'Product Highlights',
        'shortdesc' => implode('$', $highlights),
        'longdesc1title' => 'Nutritional Health Benefits',
        'longdesc1' => implode('#', array_map(function($n) { return $n['label'] . ': ' . $n['value']; }, $nutrients)),
        'longdesc2title' => 'Storage & Freshness Guide',
        'longdesc2' => implode('#', $storageTips),
        'longdesc3title' => 'Culinary Recommendations',
        'longdesc3' => implode('#', $culinaryUses),
    ];
}

function getMockProductDetail($id) {
    return [
        'id' => $id,
        'name' => 'Farm Fresh Organic Vegetable',
        'tamil_name' => 'இயற்கை காய்கறி',
        'cat' => 'Vegetables',
        'sub_cat' => 'Fresh Vegetables',
        'price' => 45,
        'original_price' => 60,
        'weight' => 500,
        'unit_name' => 'grams',
        'img_url' => 'assets/categories/Thinkspot_veggiesIcon.png',
        'in_stock' => true,
        'stock_qty' => 100,
        'offer_percentage' => 25,
        'origin' => 'Local Organic Farms, Tamil Nadu',
        'shelf_life' => '3 - 5 Days',
        'highlights' => [
            "100% Farm Fresh & Organically Grown",
            "Directly procured from local agricultural farms",
            "Hygienically cleaned and eco-friendly packed"
        ],
        'nutrients' => [
            ['label' => 'Vitamins', 'value' => 'Rich in Vitamin C & A'],
            ['label' => 'Fiber', 'value' => 'High Dietary Fiber']
        ],
        'storage_tips' => [
            "Store in vegetable crisper compartment of refrigerator.",
            "Keep in breathable bag."
        ],
        'culinary_uses' => [
            "Ideal for daily curries, poriyal, sambar, and fresh salads."
        ],
        'related_products' => []
    ];
}
