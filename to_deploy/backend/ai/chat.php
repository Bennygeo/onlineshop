<?php
/**
 * TomorrowNeeds AI Assistant Endpoint
 * 
 * Supports:
 *  - Google Gemini (gemini-3.6-flash / gemini-1.5-flash) via GEMINI_API_KEY
 *  - Groq Cloud (Llama 3.3 70B / Llama 3.1 8B) via GROQ_API_KEY
 *  - Grounded Store Product Catalog Search & 1-Click Cart Addition
 *  - Live User Orders & Saved Addresses retrieval (with users table & orders fallback)
 *  - Smart Rule-based Grounded Fallback when offline
 */
require_once __DIR__ . '/../config/db.php';

$message = trim(getParam('message') ?: getParam('query') ?: '');
$rawMobile = trim(getParam('mobile') ?: getParam('id') ?: '');

// Clean & normalize mobile variations (e.g. +91, spaces, 10-digit)
$cleanMobile = preg_replace('/[^0-9]/', '', $rawMobile);
$shortMobile = (strlen($cleanMobile) >= 10) ? substr($cleanMobile, -10) : $cleanMobile;
$mobile = (!empty($shortMobile) && $shortMobile !== 'xxxxxxxxxx') ? $shortMobile : '';

if (empty($message)) {
    sendJson(['error' => 'Message or query is required'], 400);
}

// 1. Fetch available products from DB for grounding
$availableProducts = [];
if ($pdo) {
    try {
        $stmt = $pdo->query("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url FROM products WHERE (disabled = 0 OR disabled IS NULL)");
        $availableProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}
}

// 2. Fetch User Orders and Saved Addresses if user is logged in
$userOrders = [];
$userAddresses = [];
$userOrdersContext = "No prior orders on record.";
$userAddressesContext = "No saved addresses on record.";

if (!empty($mobile) && $pdo) {
    $mobileVariants = array_values(array_unique(array_filter([
        $rawMobile,
        $cleanMobile,
        $shortMobile,
        '+91' . $shortMobile,
        '91' . $shortMobile,
        '+91 ' . $shortMobile,
        '0' . $shortMobile
    ])));

    $inPlaceholders = implode(',', array_fill(0, count($mobileVariants), '?'));
    $queryParams = array_merge($mobileVariants, ["%{$shortMobile}"]);

    // 2.1 Fetch user addresses from user_addresses table
    try {
        $stmtAddr = $pdo->prepare("
            SELECT id, mobile, name, address, pincode, landmark, 
                   COALESCE(title, landmark, 'My Home') AS title, 
                   is_default, is_default AS `default`, is_default AS active 
            FROM user_addresses 
            WHERE mobile IN ($inPlaceholders) OR mobile LIKE ? 
            ORDER BY is_default DESC, id DESC
        ");
        $stmtAddr->execute($queryParams);
        $userAddresses = $stmtAddr->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Exception $e) {
        $userAddresses = [];
    }

    // 2.1.1 Fallback: Fetch address from users table if user_addresses is empty
    if (empty($userAddresses)) {
        try {
            $stmtUser = $pdo->prepare("
                SELECT id, mobile, name, address, pincode, landmark 
                FROM users 
                WHERE (mobile IN ($inPlaceholders) OR mobile LIKE ?) 
                  AND address IS NOT NULL AND address != '' 
                ORDER BY id DESC LIMIT 1
            ");
            $stmtUser->execute($queryParams);
            $uRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($uRow && !empty(trim($uRow['address']))) {
                $userAddresses[] = [
                    'id' => (int)($uRow['id'] ?? 1),
                    'mobile' => $uRow['mobile'],
                    'name' => $uRow['name'] ?? '',
                    'address' => $uRow['address'],
                    'pincode' => $uRow['pincode'] ?? '',
                    'landmark' => $uRow['landmark'] ?? '',
                    'title' => 'Home',
                    'is_default' => 1,
                    'default' => 1,
                    'active' => 1
                ];
            }
        } catch (Exception $eUser) {}
    }

    // 2.1.2 Fallback: Fetch address from recent orders if still empty
    if (empty($userAddresses)) {
        try {
            $stmtOrdAddr = $pdo->prepare("
                SELECT address_json 
                FROM orders 
                WHERE (mobile IN ($inPlaceholders) OR mobile LIKE ?) 
                  AND address_json IS NOT NULL AND address_json != '' 
                ORDER BY id DESC LIMIT 1
            ");
            $stmtOrdAddr->execute($queryParams);
            $oRow = $stmtOrdAddr->fetch(PDO::FETCH_ASSOC);
            if ($oRow && !empty($oRow['address_json'])) {
                $dec = json_decode($oRow['address_json'], true);
                if ($dec && !empty($dec['address'])) {
                    $userAddresses[] = [
                        'id' => 1,
                        'mobile' => $shortMobile,
                        'name' => $dec['name'] ?? '',
                        'address' => $dec['address'],
                        'pincode' => $dec['pincode'] ?? '',
                        'landmark' => $dec['landmark'] ?? '',
                        'title' => 'Primary Address',
                        'is_default' => 1,
                        'default' => 1,
                        'active' => 1
                    ];
                }
            }
        } catch (Exception $eOrdAddr) {}
    }

    if (!empty($userAddresses)) {
        $addrLines = [];
        foreach ($userAddresses as $ua) {
            $defTag = (!empty($ua['is_default']) || !empty($ua['default'])) ? '[Default] ' : '';
            $addrLines[] = "{$defTag}{$ua['title']}: {$ua['address']}, Pincode: {$ua['pincode']}" . (!empty($ua['landmark']) ? " (Landmark: {$ua['landmark']})" : "");
        }
        $userAddressesContext = implode("; ", $addrLines);
    }

    // 2.2 Fetch recent orders (latest 5) with items
    try {
        $stmtOrd = $pdo->prepare("
            SELECT o.order_id, o.mobile, o.total_amount, o.status, o.delivery_date, 
                   COALESCE(o.delivery_slot_label, 'Anytime Delivery') AS delivery_slot_label,
                   o.created_at, o.payment_type
            FROM orders o 
            WHERE o.mobile IN ($inPlaceholders) OR o.mobile LIKE ? 
            ORDER BY o.id DESC 
            LIMIT 5
        ");
        $stmtOrd->execute($queryParams);
        $rawOrders = $stmtOrd->fetchAll(PDO::FETCH_ASSOC) ?: [];

        if (!empty($rawOrders)) {
            $orderLines = [];
            foreach ($rawOrders as $ro) {
                $itemsList = [];
                try {
                    $stmtOi = $pdo->prepare("
                        SELECT oi.product_id, COALESCE(NULLIF(oi.product_name, ''), p.name, 'Item') AS product_name, oi.quantity, oi.price, oi.weight, p.unit_name
                        FROM order_items oi
                        LEFT JOIN products p ON oi.product_id = p.id
                        WHERE oi.order_id = ?
                    ");
                    $stmtOi->execute([$ro['order_id']]);
                    $itemsList = $stmtOi->fetchAll(PDO::FETCH_ASSOC) ?: [];
                } catch (Exception $eOi) {}

                $itemStrs = [];
                $cleanItems = [];
                foreach ($itemsList as $it) {
                    $itemStrs[] = "{$it['quantity']}x {$it['product_name']}";
                    $cleanItems[] = [
                        'name' => $it['product_name'],
                        'quantity' => (int)$it['quantity'],
                        'price' => (float)$it['price'],
                        'unit_name' => $it['unit_name'] ?? ''
                    ];
                }

                $ro['items'] = $cleanItems;
                $ro['total_amount'] = (float)$ro['total_amount'];
                $userOrders[] = $ro;

                $orderLines[] = "Order #{$ro['order_id']} [Status: {$ro['status']}, Total: ₹{$ro['total_amount']}, Delivery: {$ro['delivery_date']} {$ro['delivery_slot_label']}, Items: " . implode(', ', $itemStrs) . "]";
            }
            $userOrdersContext = implode("\n", $orderLines);
        }
    } catch (Exception $e) {}
}

// Intent Detection for Orders and Addresses
$isOrderIntent = preg_match('/\b(order|orders|booking|booked|track|tracking|status of|delivery status|my items|bought|purchased|last order|recent order|past order|order history)\b/i', $message);
$isAddressIntent = preg_match('/\b(address|addresses|delivery address|delivery location|saved address|my location|ship to|shipping address|pincode|landmark|location)\b/i', $message);

// Prepare concise catalog sample for the AI context
$sampleCatalog = [];
foreach (array_slice($availableProducts, 0, 60) as $p) {
    $cleanName = trim(preg_replace('/^(tomorrowneeds|thinkspot)\s+/i', '', $p['name']));
    $sampleCatalog[] = "{$cleanName} (₹{$p['price']}, {$p['weight']}{$p['unit_name']})";
}
$catalogStr = implode(', ', $sampleCatalog);

$systemPrompt = "You are 'TomorrowNeeds AI Chef & Shopping Assistant', the friendly cooking, grocery and account guide for TomorrowNeeds Farm Fresh in Chennai / Tamil Nadu.
Your capabilities:
1. Authentic recipes and dish ideas (e.g. Sambar, Veg Kurma, Crunchy Salad, Dosa & Chutney, Rasam, Biryani, Soup, Tea, Poriyal, Dal).
2. Grounded suggestions for fresh ingredients available in our store (Vegetables, Fruits, Batters, Dairy, Cold-pressed Oils, Greens & Herbs).
3. Checking the customer's recent orders, delivery status, ordered items, and order history.
4. Checking the customer's saved delivery addresses and pincodes.
5. Subscription and delivery info (Morning 7 AM doorstep delivery, pause & resume anytime).

Logged-in Customer Mobile: " . (!empty($mobile) ? $mobile : 'Not Logged In (Guest)') . "
Customer Saved Addresses: {$userAddressesContext}
Customer Recent Orders:
{$userOrdersContext}

Sample store catalog items: {$catalogStr}.

Guidelines:
- Keep your reply friendly, concise, and structured with short bullet points.
- If the customer asks about their orders, cite the exact Order ID, Status, Items, and Delivery Date from their recent orders.
- If the customer asks about their address, cite their saved delivery addresses and default location.
- If a guest asks for their personal orders or addresses, politely remind them to log in with their mobile number.
- Explicitly mention fresh store ingredients when suggesting recipes.";

// Read API keys from Environment or configuration
$geminiKey = getenv('GEMINI_API_KEY') ?: (defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '');
$groqKey   = getenv('GROQ_API_KEY')   ?: (defined('GROQ_API_KEY')   ? GROQ_API_KEY   : '');

$reply = null;
$source = 'mock';

// 3. Try Google Gemini API if key is present
if (!empty($geminiKey)) {
    $modelsToTry = ['gemini-3.6-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
    foreach ($modelsToTry as $gemModel) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$gemModel}:generateContent?key=" . urlencode($geminiKey);
        $payload = [
            "contents" => [
                [
                    "parts" => [
                        ["text" => "{$systemPrompt}\n\nUser: {$message}\nAssistant:"]
                    ]
                ]
            ],
            "generationConfig" => [
                "temperature" => 0.7,
                "maxOutputTokens" => 650
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $res) {
            $json = json_decode($res, true);
            if (isset($json['candidates'][0]['content']['parts'][0]['text'])) {
                $reply = trim($json['candidates'][0]['content']['parts'][0]['text']);
                $source = $gemModel;
                break;
            }
        }
    }
}

// 4. Try Groq API (Llama 3.3 70B) if Gemini was not used or failed
if (empty($reply) && !empty($groqKey)) {
    $url = "https://api.groq.com/openai/v1/chat/completions";
    $payload = [
        "model" => "llama-3.3-70b-versatile",
        "messages" => [
            ["role" => "system", "content" => $systemPrompt],
            ["role" => "user", "content" => $message]
        ],
        "max_tokens" => 650,
        "temperature" => 0.7
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $groqKey
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
        $json = json_decode($res, true);
        if (isset($json['choices'][0]['message']['content'])) {
            $reply = trim($json['choices'][0]['message']['content']);
            $source = 'groq-llama-3.3-70b';
        }
    }
}

// 5. Smart Local Rule-based Fallback (Works 100% offline out-of-the-box)
if (empty($reply)) {
    $lower = strtolower($message);
    $source = 'offline-assistant';

    if ($isOrderIntent) {
        if (empty($mobile)) {
            $reply = "🔒 **Order History Access:**\n\nPlease log in with your mobile number to view and track your orders!";
        } else if (empty($userOrders)) {
            $reply = "📦 **No Recent Orders Found**\n\nYou haven't placed any orders yet with mobile **{$mobile}**.\n\n👉 *Browse our fresh farm vegetables, dairy & breakfast batters to place your first order!*";
        } else {
            $reply = "📦 **Your Recent Orders:**\n\n";
            foreach ($userOrders as $idx => $ord) {
                $statusEmoji = ($ord['status'] === 'DELIVERED') ? '✅' : (($ord['status'] === 'CANCELLED') ? '❌' : '🚚');
                $reply .= "• **Order #{$ord['order_id']}** — {$statusEmoji} **{$ord['status']}**\n";
                $reply .= "  - **Total:** ₹{$ord['total_amount']}\n";
                if (!empty($ord['delivery_date'])) {
                    $reply .= "  - **Delivery:** {$ord['delivery_date']} ({$ord['delivery_slot_label']})\n";
                }
                if (!empty($ord['items'])) {
                    $itemNames = array_map(function($i) { return "{$i['quantity']}x {$i['name']}"; }, $ord['items']);
                    $reply .= "  - **Items:** " . implode(', ', array_slice($itemNames, 0, 4)) . "\n";
                }
                $reply .= "\n";
            }
            $reply .= "👉 *You can view full details or re-order anytime from the Orders tab!*";
        }
    } else if ($isAddressIntent) {
        if (empty($mobile)) {
            $reply = "🔒 **Saved Addresses Access:**\n\nPlease log in to view and manage your saved delivery addresses!";
        } else if (empty($userAddresses)) {
            $reply = "📍 **No Saved Addresses Found**\n\nYou don't have any saved delivery addresses yet.\n\n👉 *Add your delivery address in Profile or during checkout for 7 AM morning doorstep delivery!*";
        } else {
            $reply = "📍 **Your Saved Delivery Addresses:**\n\n";
            foreach ($userAddresses as $ua) {
                $isDef = (!empty($ua['is_default']) || !empty($ua['default'])) ? ' ⭐ *(Default)*' : '';
                $reply .= "• **{$ua['title']}**{$isDef}\n";
                if (!empty($ua['name'])) $reply .= "  - **Name:** {$ua['name']}\n";
                $reply .= "  - **Address:** {$ua['address']}\n";
                $reply .= "  - **Pincode:** {$ua['pincode']}" . (!empty($ua['landmark']) ? " (Landmark: {$ua['landmark']})" : "") . "\n\n";
            }
            $reply .= "👉 *Morning doorstep deliveries will be dispatched to your default address.*";
        }
    } else if (strpos($lower, 'sambar') !== false) {
        $reply = "🥘 **Sambar Ingredients & Recipe:**\n"
               . "• **Tomatoes (Nattu Thakkali)** – Fresh & juicy for rich tangy base\n"
               . "• **Small Onions (Shallots)** – Essential for authentic aroma\n"
               . "• **Drumstick & Carrots** – Tender, vitamin-rich farm-fresh veggies\n"
               . "• **Brinjal (Kathirikai)** – Soft and flavour-absorbing\n"
               . "• **Coriander Leaves & Curry Leaves** – For fragrant tempering\n\n"
               . "👉 *Add these farm-fresh ingredients directly to your cart below!*";
    } else if (strpos($lower, 'salad') !== false) {
        $reply = "🥗 **Fresh Crunchy Salad Bowl:**\n"
               . "• **Crisp Cucumbers & Red Carrots**\n"
               . "• **Country Tomatoes & Radish**\n"
               . "• **Fresh Lemon & Coriander** for citrus dressing\n\n"
               . "👉 *All vegetables are farm-harvested daily!*";
    } else if (strpos($lower, 'kurma') !== false) {
        $reply = "🍲 **South Indian Veg Kurma:**\n"
               . "• **Fresh Beans, Carrots, and Baby Potatoes**\n"
               . "• **Onions, Tomatoes, and Green Chillies**\n"
               . "• **Grated Coconut & Ginger** for the creamy rich base\n\n"
               . "👉 *Grab the fresh veggie pack below!*";
    } else if (strpos($lower, 'dosa') !== false || strpos($lower, 'idli') !== false) {
        $reply = "🥞 **Crispy Dosa & Chutney Kit:**\n"
               . "• **Fresh Ground Idli / Dosa Batter** (No preservatives)\n"
               . "• **Fresh Coconut & Green Chillies** for hotel-style chutney\n"
               . "• **Cold-Pressed Gingelly / Sesame Oil** for golden crisp roast\n\n"
               . "👉 *Add to cart for an effortless South Indian breakfast!*";
    } else if (strpos($lower, 'subscription') !== false || strpos($lower, 'delivery') !== false) {
        $reply = "🚚 **TomorrowNeeds Subscription & Delivery:**\n"
               . "• **Morning 7 AM Delivery**: Daily fresh milk, veggies, and batter delivered right to your doorstep.\n"
               . "• **Flexible Scheduling**: Choose daily, alternate days, or custom calendar dates.\n"
               . "• **Pause & Resume Anytime**: Manage your deliveries in the Subscriptions tab without extra charges!";
    } else if (strpos($lower, 'refund') !== false || strpos($lower, 'cancel') !== false) {
        $reply = "💳 **Cancellations & Instant Refunds:**\n"
               . "• You can cancel individual items or entire orders from the **Orders** page before delivery.\n"
               . "• For Wallet/Prepaid orders, the exact refund is credited back to your **TomorrowNeeds Wallet** instantly.";
    } else if (strpos($lower, 'soup') !== false) {
        $reply = "🍵 **Fresh Healthy Soup Bowl:**\n"
               . "• **Country Tomatoes, Sweet Corn, and Tender Carrots**\n"
               . "• **Fresh Coriander, Ginger, and Crushed Pepper**\n\n"
               . "👉 *Warm, soothing, and freshly sourced from local farms!*";
    } else if (strpos($lower, 'tea') !== false || strpos($lower, 'chai') !== false) {
        $reply = "☕ **Farm Fresh Tea & Infusions:**\n"
               . "• **Pure Farm Fresh Milk** (Unadulterated & wholesome)\n"
               . "• **Fresh Ginger (Inji) & Mint Leaves (Pudhina)**\n\n"
               . "👉 *Brew a refreshing cup every morning!*";
    } else if (strpos($lower, 'diabetic') !== false || strpos($lower, 'sugar') !== false) {
        $reply = "🩺 **Diabetic-Friendly & Low-GI Nutrition:**\n"
               . "• **Bitter Gourd (Pavakkai) & Ladies Finger (Vendakkai)** – Supports steady blood sugar\n"
               . "• **Fresh Palak Keerai & Methi** – High fiber & micronutrients\n"
               . "• **Amla (Nellikai)** – Natural vitamin C and metabolic support\n\n"
               . "👉 *Add these low-glycemic fresh staples to your cart!*";
    } else if (strpos($lower, 'protein') !== false || strpos($lower, 'gym') !== false || strpos($lower, 'fitness') !== false) {
        $reply = "🏋️ **High Protein & Fitness Staples:**\n"
               . "• **Pure Farm Fresh Milk & Fresh Curd**\n"
               . "• **Green Sprouts & Sundal Pulses**\n"
               . "• **Fresh Palak & Drumstick Leaves**\n\n"
               . "👉 *Natural plant & dairy protein to power your day!*";
    } else if (strpos($lower, 'weight') !== false || strpos($lower, 'diet') !== false || strpos($lower, 'fat') !== false) {
        $reply = "🥗 **Weight Management & Detox Basket:**\n"
               . "• **Bottle Gourd (Sorakkai) & Cucumber** – High hydration, zero fat\n"
               . "• **Tender Coconut** – Pure natural electrolytes without refined sugar\n"
               . "• **Papaya & Red Carrots** – Rich in enzymes and gut-friendly fiber\n\n"
               . "👉 *Clean eating directly from local farms!*";
    } else if (strpos($lower, 'immunity') !== false || strpos($lower, 'cold') !== false || strpos($lower, 'cough') !== false) {
        $reply = "🌿 **Immunity & Vitality Essentials:**\n"
               . "• **Fresh Ginger (Inji), Garlic (Poondu), and Turmeric (Manjal)**\n"
               . "• **Fresh Lemon (Elumichai) & Mint**\n"
               . "• **Tender Coconut & Citrus Fruits**\n\n"
               . "👉 *Boost your immunity naturally with farm-fresh produce!*";
    } else {
        $reply = "👋 Hello! I am your **TomorrowNeeds AI Assistant**.\n\n"
               . "I can help you with:\n"
               . "1. 📦 **My Orders & Tracking**: View your recent orders and delivery status.\n"
               . "2. 📍 **Saved Addresses**: Check and view your delivery addresses.\n"
               . "3. 🛒 **Smart Grocery Search & 1-Click Cart**: Type in English, தமிழ் (Tamil), or Tanglish (e.g., *'1kg thakkali, paal, dosai maavu'* or *'Add 2kg onions'*).\n"
               . "4. 🥘 **Recipe Kits & Diets**: Sambar, Kurma, Dosa batter, Diabetic, Protein, and Weight Care baskets.\n\n"
               . "What would you like to ask or order today?";
    }
}

// 6. Intelligent Grounded Product Catalog Matching with Tamil & Tanglish Support
$combinedText = strtolower($message . ' ' . $reply);
$replyText = strtolower($reply);

// Tanglish / Tamil to Product Keyword Map
$tanglishMap = [
    'thakkali' => 'tomato',
    'thakali' => 'tomato',
    'vengayam' => 'onion',
    'venkayam' => 'onion',
    'chinna vengayam' => 'sambar onion',
    'paal' => 'milk',
    'maavu' => 'batter',
    'mavu' => 'batter',
    'dosa mavu' => 'idli dosa batter',
    'dosai maavu' => 'idli dosa batter',
    'idli mavu' => 'idli dosa batter',
    'thengai' => 'coconut',
    'elaneer' => 'tender coconut',
    'ilani' => 'tender coconut',
    'inji' => 'ginger',
    'poondu' => 'garlic',
    'kothumalli' => 'coriander',
    'kotthamalli' => 'coriander',
    'karuveppilai' => 'curry leaves',
    'kariveppilai' => 'curry leaves',
    'kathirikai' => 'brinjal',
    'kathirikkai' => 'brinjal',
    'vendaikkai' => 'ladies finger',
    'vendakkai' => 'ladies finger',
    'urulaikilangu' => 'potato',
    'urulai' => 'potato',
    'keerai' => 'keerai',
    'palak' => 'palak',
    'murungaikai' => 'drumstick',
    'murungai' => 'drumstick',
    'manjal' => 'turmeric',
    'elumichai' => 'lemon',
    'pudhina' => 'mint',
    'pudina' => 'mint',
    'muttai' => 'egg',
    'kadala' => 'sprouts',
    'sorakkai' => 'bottle gourd',
    'pavakkai' => 'bitter gourd',
    'seppankilangu' => 'taro',
    'vellari' => 'cucumber',
    'parangikai' => 'pumpkin',
    'kovakkai' => 'ivy gourd'
];

foreach ($tanglishMap as $tamilTerm => $englishTerm) {
    if (strpos($combinedText, $tamilTerm) !== false) {
        $combinedText .= ' ' . $englishTerm;
    }
}

// Stop words that shouldn't match as single isolated words
$genericStopWords = [
    'tomorrowneeds', 'thinkspot', 'fresh', 'farm', 'gram', 'grams', 'pack', 'small', 'big', 'kg', 'unit',
    'red', 'white', 'green', 'yellow', 'black', 'raw', 'long', 'sweet', 'organic', 'leaf', 'leaves',
    'super', 'pure', 'rich', 'best', 'good', 'item', 'items', 'with', 'for', 'and', 'the', 'from', 'your', 'powder',
    'venum', 'thevai', 'naalaiku', 'kaalaila', 'kudukavum', 'kudu', 'order', 'orders', 'please', 'add', 'want', 'need', 'give',
    'address', 'addresses', 'status', 'track', 'recent', 'where', 'show', 'tell', 'what', 'list'
];

// Recipe ingredient associations
$recipeIngredients = [
    'sambar' => ['sambar onion', 'shallots', 'drumstick', 'tomato', 'brinjal', 'carrot', 'coriander', 'tamarind', 'curry leaves', 'gingelly'],
    'salad' => ['cucumber', 'tomato', 'carrot', 'lemon', 'lettuce', 'radish', 'sprout', 'corn'],
    'kurma' => ['baby potato', 'potato', 'beans', 'carrot', 'cauliflower', 'coconut', 'ginger', 'onion', 'tomato'],
    'dosa' => ['idli dosa batter', 'batter', 'coconut', 'gingelly', 'chilli', 'coriander'],
    'idli' => ['idli dosa batter', 'batter', 'coconut', 'gingelly', 'chilli', 'coriander'],
    'chutney' => ['coconut', 'chilli', 'coriander', 'mint', 'ginger', 'tomato', 'onion'],
    'greens' => ['palak keerai', 'murungai keerai', 'arai keerai', 'siru keerai', 'methi'],
    'immunity' => ['ginger', 'lemon', 'tulsi', 'turmeric', 'tender coconut', 'amla'],
    'diabetic' => ['bitter gourd', 'ladies finger', 'palak keerai', 'methi', 'amla', 'cucumber'],
    'protein' => ['milk', 'curd', 'sprouts', 'palak keerai', 'drumstick'],
    'weight' => ['bottle gourd', 'cucumber', 'papaya', 'carrot', 'tender coconut'],
    'kids' => ['milk', 'batter', 'apple', 'banana', 'carrot', 'curd'],
    'tea' => ['ginger', 'lemon', 'tulsi', 'milk', 'mint'],
    'soup' => ['tomato', 'mushroom', 'sweet corn', 'coriander', 'carrot'],
    'juice' => ['watermelon', 'orange', 'pomegranate', 'apple', 'lemon', 'musk melon']
];

$recipeTokens = [];
foreach ($recipeIngredients as $key => $ingredients) {
    if (strpos($combinedText, $key) !== false) {
        foreach ($ingredients as $ing) {
            $recipeTokens[] = $ing;
        }
    }
}

$scoredProducts = [];
// Only match products if user didn't purely ask for orders / addresses
if (!$isOrderIntent && !$isAddressIntent) {
    foreach ($availableProducts as $prod) {
        $cleanName = strtolower(trim(preg_replace('/^(tomorrowneeds|thinkspot)\s+/i', '', $prod['name'])));
        $rawName = strtolower($prod['name']);
        $tamilName = strtolower($prod['tamil_name'] ?? '');

        $score = 0;

        // 1. Direct mention in AI's reply gets highest priority
        if (strlen($cleanName) >= 3 && strpos($replyText, $cleanName) !== false) {
            $score += 60;
        }

        // 2. Direct mention in user message
        if (strlen($cleanName) >= 3 && strpos(strtolower($message), $cleanName) !== false) {
            $score += 40;
        }

        // 3. Match specific recipe association tokens
        foreach ($recipeTokens as $rt) {
            if ($cleanName === $rt || strpos($cleanName, $rt) !== false) {
                $score += 25;
            }
        }

        // 4. Match individual significant words from clean name in reply or query
        $nameWords = array_filter(explode(' ', preg_replace('/[^a-z0-9]/', ' ', $cleanName)), function($w) use ($genericStopWords) {
            return strlen($w) >= 3 && !in_array($w, $genericStopWords);
        });

        foreach ($nameWords as $nw) {
            if (strpos($replyText, $nw) !== false) {
                $score += 15;
            } else if (strpos(strtolower($message), $nw) !== false) {
                $score += 10;
            }
        }

        // 5. Match Tamil name if present
        if ($tamilName && $tamilName !== $rawName && strlen($tamilName) >= 3) {
            if (strpos($replyText, $tamilName) !== false) {
                $score += 30;
            }
        }

        if ($score > 0) {
            $scoredProducts[] = [
                'product' => $prod,
                'score' => $score
            ];
        }
    }

    // Sort by score descending
    usort($scoredProducts, function($a, $b) {
        return $b['score'] - $a['score'];
    });
}

$matchedProducts = [];
$matchedIds = [];
foreach ($scoredProducts as $sp) {
    $p = $sp['product'];
    if (!isset($matchedIds[$p['id']])) {
        $matchedIds[$p['id']] = true;
        $matchedProducts[] = [
            'id' => $p['id'],
            'name' => $p['name'],
            'tamil_name' => $p['tamil_name'] ?? '',
            'price' => (float)$p['price'],
            'original_price' => (float)($p['original_price'] ?? $p['price']),
            'weight' => (int)($p['weight'] ?? 500),
            'unit_name' => $p['unit_name'] ?? 'grams',
            'unit' => ($p['weight'] ?? 500) . ' ' . ($p['unit_name'] ?? 'grams'),
            'img_url' => $p['img_url'] ?? '',
            'cat' => $p['cat'] ?? 'Vegetables',
            'sub_cat' => $p['sub_cat'] ?? 'General'
        ];
        if (count($matchedProducts) >= 8) break;
    }
}

$responsePayload = [
    'status' => 'success',
    'reply' => $reply,
    'source' => $source,
    'suggested_products' => $matchedProducts
];

// Attach structured user orders or addresses if relevant
if ($isOrderIntent && !empty($userOrders)) {
    $responsePayload['user_orders'] = $userOrders;
}
if ($isAddressIntent && !empty($userAddresses)) {
    $responsePayload['user_addresses'] = $userAddresses;
}

sendJson($responsePayload);
