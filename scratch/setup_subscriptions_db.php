<?php
require_once __DIR__ . '/../backend/config/db.php';

if ($pdo) {
    // 1. Ensure user_addresses or products table has correct data
    // Add/Update Tender Coconut product under Subscriptions
    $stmt1 = $pdo->prepare("INSERT INTO products (id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, index_num, offer) 
        VALUES ('p_sub_tender_coconut', 'Fresh Tender Coconut', 'இளநீர்', 'Subscriptions', 'Daily Subscription', 45.00, 55.00, 1, 'piece', 'assets/products/tender/thinkspot_iceApple.jpg', 0, 1, 18)
        ON DUPLICATE KEY UPDATE cat = 'Subscriptions', sub_cat = 'Daily Subscription', disabled = 0");
    $stmt1->execute();

    // Add/Update Milk product under Subscriptions
    $stmt2 = $pdo->prepare("INSERT INTO products (id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, index_num, offer) 
        VALUES ('p_sub_fresh_milk', 'Farm Fresh Milk', 'பசும்பால்', 'Subscriptions', 'Daily Subscription', 35.00, 42.00, 1, 'liter', 'assets/products/milk/thinkspot_butter.jpg', 0, 2, 16)
        ON DUPLICATE KEY UPDATE cat = 'Subscriptions', sub_cat = 'Daily Subscription', disabled = 0");
    $stmt2->execute();

    // Also update existing tender coconut and milk products if any
    $pdo->exec("UPDATE products SET cat = 'Subscriptions' WHERE id IN ('p_thinkspot_tender_coconut', 'p_thinkspot_milk_1', 'p_sub_tender_coconut', 'p_sub_fresh_milk')");

    echo "Subscriptions category products setup successfully!";
}
