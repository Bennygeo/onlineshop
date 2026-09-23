<?php
/**
 * TomorrowNeeds AI Assistant Endpoint
 * 
 * Supports:
 *  - Google Gemini (gemini-3.6-flash / gemini-1.5-flash) via GEMINI_API_KEY
 *  - Groq Cloud (Llama 3.3 70B / Llama 3.1 8B) via GROQ_API_KEY
 *  - Grounded Store Product Catalog Search & 1-Click Cart Addition
 *  - Smart Rule-based Grounded Fallback when offline
 */
require_once __DIR__ . '/../config/db.php';

$message = trim(getParam('message') ?: getParam('query') ?: '');
$mobile  = trim(getParam('mobile') ?: '');

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

// Prepare concise catalog sample for the AI context
$sampleCatalog = [];
foreach (array_slice($availableProducts, 0, 60) as $p) {
    $cleanName = trim(preg_replace('/^(tomorrowneeds|thinkspot)\s+/i', '', $p['name']));
    $sampleCatalog[] = "{$cleanName} (₹{$p['price']}, {$p['weight']}{$p['unit_name']})";
}
$catalogStr = implode(', ', $sampleCatalog);

$systemPrompt = "You are 'TomorrowNeeds AI Chef & Shopping Assistant', the friendly cooking and fresh grocery guide for TomorrowNeeds Farm Fresh in Chennai / Tamil Nadu.
Your goal is to assist customers with:
1. Authentic recipes and dish ideas (e.g. Sambar, Veg Kurma, Crunchy Salad, Dosa & Chutney, Rasam, Biryani, Soup, Tea, Poriyal, Dal).
2. Suggesting fresh ingredients available in our store (Vegetables, Fruits, Batters, Dairy, Cold-pressed Oils, Greens & Herbs).
3. Subscription info (Morning 7 AM doorstep delivery, pause & resume anytime).

Sample store catalog items: {$catalogStr}.
Keep your reply friendly, structured with short bullet points, and explicitly mention store ingredients to cook the dish.";

// Read API keys from Environment or configuration
$geminiKey = getenv('GEMINI_API_KEY') ?: (defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '');
$groqKey   = getenv('GROQ_API_KEY')   ?: (defined('GROQ_API_KEY')   ? GROQ_API_KEY   : '');

$reply = null;
$source = 'mock';

// 2. Try Google Gemini API if key is present
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
                "maxOutputTokens" => 600
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

// 3. Try Groq API (Llama 3.3 70B) if Gemini was not used or failed
if (empty($reply) && !empty($groqKey)) {
    $url = "https://api.groq.com/openai/v1/chat/completions";
    $payload = [
        "model" => "llama-3.3-70b-versatile",
        "messages" => [
            ["role" => "system", "content" => $systemPrompt],
            ["role" => "user", "content" => $message]
        ],
        "max_tokens" => 600,
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

// 4. Smart Local Rule-based Fallback (Works 100% offline out-of-the-box)
if (empty($reply)) {
    $lower = strtolower($message);
    $source = 'offline-assistant';

    if (strpos($lower, 'sambar') !== false) {
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
        $reply = "👋 Hello! I am your **TomorrowNeeds AI Chef & Voice Shopping Assistant**.\n\n"
               . "I can help you with:\n"
               . "1. 🎙️ **Voice Order & Grocery Search**: Speak in English, தமிழ் (Tamil), or Tanglish (e.g., *'1kg thakkali, paal, dosai maavu'*).\n"
               . "2. 🥘 **Recipe Kits**: Sambar, Kurma, Rasam, Chutney, Soup, and Poriyal bundles.\n"
               . "3. 🥗 **Dietary Guidance**: Diabetic-friendly, High Protein, Immunity, and Weight Care curations.\n"
               . "4. 📦 **Morning 7 AM Doorstep Delivery** & Subscriptions.\n\n"
               . "What would you like to cook or order today?";
    }
}

// 5. Intelligent Grounded Product Catalog Matching with Tamil & Tanglish Support
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
    'venum', 'thevai', 'naalaiku', 'kaalaila', 'kudukavum', 'kudu', 'order', 'please', 'add', 'want', 'need', 'give'
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

sendJson([
    'status' => 'success',
    'reply' => $reply,
    'source' => $source,
    'suggested_products' => $matchedProducts
]);
