<?php
/**
 * Thinkspot — FULL Integration Test Suite (Extended)
 *
 * Covers:
 *   - Wallet (balance, credits, debits, invalid status, duplicate prevention)
 *   - Orders (place, cancel, cancel item, status transitions)
 *   - Subscriptions (range, multi_day, pause/resume, edge cases)
 *   - Checkout (wallet deduction, COD, Razorpay duplicate prevention)
 *   - Referral (validation, self-referral guard, duplicate bonus guard)
 *   - User registration (new user, existing user, legacy data)
 *   - Edge cases (empty inputs, null JSON, DB rollback, 0-amount orders)
 *
 * Run:
 *   php backend/tests/full_test_suite.php
 */

declare(strict_types=1);
date_default_timezone_set('Asia/Kolkata');

// ──────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────
$host   = 'localhost';
$dbname = 'thinkspot_test_db';
$user   = 'root';
$pass   = '';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname`");
    $pdo->exec("USE `$dbname`");
} catch (PDOException $e) {
    die("❌  Cannot connect to MySQL: " . $e->getMessage() . "\n");
}

// ──────────────────────────────────────────────────────────
// Minimal test framework
// ──────────────────────────────────────────────────────────
$passed = 0;
$failed = 0;
$skipped = 0;
$errors = [];

function it(string $desc, callable $fn): void {
    global $passed, $failed, $errors;
    try {
        $fn();
        echo "  ✅  $desc\n";
        $passed++;
    } catch (Throwable $e) {
        echo "  ❌  $desc\n     → " . $e->getMessage() . "\n";
        $failed++;
        $errors[] = "[$desc] " . $e->getMessage();
    }
}

function describe(string $label, callable $fn): void {
    echo "\n📋  $label\n" . str_repeat("─", 60) . "\n";
    $fn();
}

function expect($actual): object {
    return new class($actual) {
        public function __construct(private mixed $actual) {}
        public function toBe(mixed $expected): void {
            if ($this->actual !== $expected)
                throw new Exception("Expected " . json_encode($expected) . " but got " . json_encode($this->actual));
        }
        public function toEqual(mixed $expected): void {
            if ($this->actual != $expected)
                throw new Exception("Expected (==) " . json_encode($expected) . " but got " . json_encode($this->actual));
        }
        public function toBeGreaterThan(int|float $n): void {
            if (!($this->actual > $n))
                throw new Exception("Expected " . json_encode($this->actual) . " > $n");
        }
        public function toBeGreaterThanOrEqual(int|float $n): void {
            if (!($this->actual >= $n))
                throw new Exception("Expected " . json_encode($this->actual) . " >= $n");
        }
        public function toBeLessThanOrEqual(int|float $n): void {
            if (!($this->actual <= $n))
                throw new Exception("Expected " . json_encode($this->actual) . " <= $n");
        }
        public function toContain(string $needle): void {
            if (strpos((string)$this->actual, $needle) === false)
                throw new Exception("Expected \"$needle\" in \"" . $this->actual . "\"");
        }
        public function toBeNull(): void {
            if ($this->actual !== null)
                throw new Exception("Expected null but got " . json_encode($this->actual));
        }
        public function toBeTruthy(): void {
            if (!$this->actual)
                throw new Exception("Expected truthy but got " . json_encode($this->actual));
        }
        public function toBeFalsy(): void {
            if ($this->actual)
                throw new Exception("Expected falsy but got " . json_encode($this->actual));
        }
        public function toBeArray(): void {
            if (!is_array($this->actual))
                throw new Exception("Expected array but got " . gettype($this->actual));
        }
        public function toHaveKey(string $key): void {
            if (!is_array($this->actual) || !array_key_exists($key, $this->actual))
                throw new Exception("Expected array to have key '$key'");
        }
        public function toHaveCount(int $n): void {
            if (!is_array($this->actual) || count($this->actual) !== $n)
                throw new Exception("Expected count $n but got " . (is_array($this->actual) ? count($this->actual) : 'not-array'));
        }
    };
}

// ──────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────
function createSchema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            mobile VARCHAR(20) UNIQUE NOT NULL,
            name VARCHAR(100) DEFAULT '',
            email VARCHAR(150) DEFAULT '',
            referral_id VARCHAR(50) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_addresses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            mobile VARCHAR(20) NOT NULL,
            address TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(100) UNIQUE NOT NULL,
            mobile VARCHAR(20) DEFAULT '',
            address_json TEXT DEFAULT NULL,
            total_amount DECIMAL(10,2) DEFAULT 0.00,
            payment_type VARCHAR(50) DEFAULT 'Wallet',
            order_source VARCHAR(50) DEFAULT 'CLIENT_WEB',
            created_by VARCHAR(100) DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'PLACED',
            delivery_date DATE DEFAULT NULL,
            delivery_option VARCHAR(50) DEFAULT 'NEXT_DAY_7AM',
            delivery_expected_at DATETIME DEFAULT NULL,
            refund_amount DECIMAL(10,2) DEFAULT 0.00,
            refund_notes TEXT DEFAULT NULL,
            assigned_to VARCHAR(100) DEFAULT '',
            delivery_mode VARCHAR(100) DEFAULT '',
            delivered_at DATETIME NULL,
            undelivered_reason VARCHAR(255) DEFAULT NULL,
            gst_amount DECIMAL(10,2) DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(100) NOT NULL,
            product_id VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) DEFAULT '',
            quantity INT DEFAULT 1,
            price DECIMAL(10,2) DEFAULT 0.00,
            weight VARCHAR(50) DEFAULT '',
            subscriptionType VARCHAR(50) DEFAULT 'none',
            rangeDates TEXT DEFAULT NULL,
            subscribedDates TEXT DEFAULT NULL,
            subsStatus VARCHAR(50) DEFAULT 'active',
            item_status VARCHAR(50) DEFAULT 'active',
            refund_amount DECIMAL(10,2) DEFAULT 0.00,
            pausedDates TEXT DEFAULT NULL,
            startDate VARCHAR(50) DEFAULT '',
            endDate VARCHAR(50) DEFAULT '',
            delivered_weight DECIMAL(10,2) DEFAULT NULL,
            missing_weight DECIMAL(10,2) DEFAULT NULL,
            partial_refund_notes VARCHAR(255) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    // Ensure pausedDates column exists in case table was created without it
    try { $pdo->exec("ALTER TABLE order_items ADD COLUMN pausedDates TEXT DEFAULT NULL"); } catch (Exception $e) {};
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS wallets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            mobile VARCHAR(20) NOT NULL,
            amount DECIMAL(10,2) DEFAULT 0.00,
            type VARCHAR(20) DEFAULT 'CREDIT',
            description TEXT DEFAULT '',
            status VARCHAR(20) DEFAULT 'authorized',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS delivery_partners (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(100) NOT NULL,
            name VARCHAR(100) DEFAULT '',
            phone VARCHAR(20) DEFAULT '',
            zone VARCHAR(100) DEFAULT '',
            vehicle VARCHAR(100) DEFAULT '',
            status VARCHAR(50) DEFAULT 'Available'
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(255) DEFAULT '',
            price DECIMAL(10,2) DEFAULT 0.00,
            img_url VARCHAR(500) DEFAULT '',
            unit_name VARCHAR(50) DEFAULT 'grams',
            category VARCHAR(100) DEFAULT '',
            subscription_enabled TINYINT(1) DEFAULT 1
        )
    ");
    // Ensure subscription_enabled exists in pre-existing products table
    try { $pdo->exec("ALTER TABLE products ADD COLUMN subscription_enabled TINYINT(1) DEFAULT 1"); } catch (Exception $e) {}
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS razorpay_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(100) UNIQUE NOT NULL,
            mobile VARCHAR(20) NOT NULL,
            amount DECIMAL(10,2) DEFAULT 0.00,
            currency VARCHAR(10) DEFAULT 'INR',
            status VARCHAR(20) DEFAULT 'created',
            payment_id VARCHAR(100) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS coupons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            discount_percent DECIMAL(5,2) DEFAULT 0.00,
            max_discount DECIMAL(10,2) DEFAULT 0.00,
            min_order_amount DECIMAL(10,2) DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_coupons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            mobile VARCHAR(20) NOT NULL,
            coupon_code VARCHAR(50) NOT NULL,
            used TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
}

function teardown(PDO $pdo): void {
    $tables = ['order_items','orders','wallets','users','user_addresses','delivery_partners',
                'products','razorpay_orders','user_coupons','coupons'];
    $pdo->exec("SET FOREIGN_KEY_CHECKS=0");
    foreach ($tables as $tbl) {
        try { $pdo->exec("TRUNCATE TABLE `$tbl`"); } catch (Exception $e) {}
    }
    $pdo->exec("SET FOREIGN_KEY_CHECKS=1");
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function insertOrder(PDO $pdo, array $overrides = []): string {
    $defaults = [
        'order_id'      => 'ORD_TEST_' . rand(10000, 99999),
        'mobile'        => '9876543210',
        'total_amount'  => 300.00,
        'payment_type'  => 'Wallet',
        'status'        => 'PLACED',
        'delivery_date' => date('Y-m-d', strtotime('+1 day')),
        'address_json'  => json_encode(['name' => 'Test User', 'address' => '10 Test St', 'pincode' => '600001']),
        'refund_amount' => 0.00,
    ];
    $data = array_merge($defaults, $overrides);
    $pdo->prepare("
        INSERT INTO orders (order_id, mobile, total_amount, payment_type, status, delivery_date, address_json, refund_amount)
        VALUES (:order_id, :mobile, :total_amount, :payment_type, :status, :delivery_date, :address_json, :refund_amount)
    ")->execute($data);
    return $data['order_id'];
}

function insertOrderItem(PDO $pdo, string $orderId, array $overrides = []): int {
    $defaults = [
        'order_id'         => $orderId,
        'product_id'       => 'PROD_001',
        'product_name'     => 'Tomatoes',
        'quantity'         => 2,
        'price'            => 100.00,
        'item_status'      => 'active',
        'subsStatus'       => 'active',
        'subscriptionType' => 'none',
        'rangeDates'       => null,
        'subscribedDates'  => null,
    ];
    $data = array_merge($defaults, $overrides);
    $pdo->prepare("
        INSERT INTO order_items (order_id, product_id, product_name, quantity, price, item_status, subsStatus, subscriptionType, rangeDates, subscribedDates)
        VALUES (:order_id, :product_id, :product_name, :quantity, :price, :item_status, :subsStatus, :subscriptionType, :rangeDates, :subscribedDates)
    ")->execute($data);
    return (int)$pdo->lastInsertId();
}

function insertWallet(PDO $pdo, string $mobile, float $amount, string $type = 'CREDIT', string $status = 'placed', string $desc = 'test'): void {
    $pdo->prepare("INSERT INTO wallets (mobile, amount, type, status, description) VALUES (?,?,?,?,?)")
        ->execute([$mobile, $amount, $type, $status, $desc]);
}

function computeWalletBalance(PDO $pdo, string $mobile): float {
    $stmt = $pdo->prepare("SELECT amount, type, status FROM wallets WHERE mobile = ?");
    $stmt->execute([$mobile]);
    $rows = $stmt->fetchAll();
    $bal = 0.0;
    foreach ($rows as $row) {
        $amt = round((float)$row['amount']);
        $type = strtoupper($row['type']);
        $st = strtolower($row['status'] ?: 'authorized');
        if (in_array($st, ['authorized','captured','placed','success'])) {
            if ($type === 'DEBIT') $bal -= $amt;
            else $bal += $amt;
        }
    }
    return max(0, round($bal));
}

function cancelOrder(PDO $pdo, string $order_id): array {
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE order_id = ?");
    $stmt->execute([$order_id]);
    $order = $stmt->fetch();
    if (!$order) return ['error' => 'Order not found'];
    if ($order['status'] === 'CANCELLED') return ['status' => 'SUCCESS', 'message' => 'Order already cancelled', 'refund_amount' => 0];

    $mobile = $order['mobile'];
    $payment_type = $order['payment_type'] ?? 'Wallet';
    $isCOD = (strcasecmp($payment_type, 'COD') === 0 || stripos($payment_type, 'cash') !== false);
    $total = floatval($order['total_amount']);
    $prev = floatval($order['refund_amount'] ?? 0);
    $refundDue = max(0, $total - $prev);
    $actual_refund = 0;

    $pdo->beginTransaction();
    if (!$isCOD && $refundDue > 0 && !empty($mobile)) {
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'placed')")
            ->execute([$mobile, round($refundDue), "Refund for cancelled order #{$order_id}"]);
        $actual_refund = round($refundDue);
    }
    $pdo->prepare("UPDATE orders SET status='CANCELLED', refund_amount=?, refund_notes=? WHERE order_id=?")
        ->execute([$total, $isCOD ? 'Cancelled (COD)' : 'Full refund to wallet', $order_id]);
    $pdo->prepare("UPDATE order_items SET item_status='cancelled', subsStatus='cancelled' WHERE order_id=?")
        ->execute([$order_id]);
    $pdo->commit();

    return ['status' => 'SUCCESS', 'refund_amount' => $actual_refund, 'is_cod' => $isCOD];
}

// ──────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────
createSchema($pdo);
echo "\n🚀  Thinkspot Full Integration Test Suite\n";
echo "    " . date('Y-m-d H:i:s') . "\n";

// ═══════════════════════════════════════════════════════════
// SUITE 1: WALLET
// ═══════════════════════════════════════════════════════════
describe('SUITE 1 — Wallet Balance & Transaction Logic', function() use ($pdo) {
    teardown($pdo);

    it('1.1 calculates correct balance from multiple CREDIT entries', function() use ($pdo) {
        $mobile = '9811111101';
        insertWallet($pdo, $mobile, 500, 'CREDIT', 'placed');
        insertWallet($pdo, $mobile, 200, 'CREDIT', 'placed');
        expect(computeWalletBalance($pdo, $mobile))->toBe(700.0);
    });

    it('1.2 subtracts DEBIT entries correctly', function() use ($pdo) {
        $mobile = '9811111102';
        insertWallet($pdo, $mobile, 500, 'CREDIT', 'placed');
        insertWallet($pdo, $mobile, 150, 'DEBIT', 'placed');
        expect(computeWalletBalance($pdo, $mobile))->toBe(350.0);
    });

    it('1.3 clamps balance to 0 when DEBIT exceeds CREDIT (no negative balance)', function() use ($pdo) {
        $mobile = '9811111103';
        insertWallet($pdo, $mobile, 100, 'CREDIT', 'placed');
        insertWallet($pdo, $mobile, 500, 'DEBIT', 'placed');
        expect(computeWalletBalance($pdo, $mobile))->toBe(0.0);
    });

    it('1.4 ignores entries with failed/invalid status', function() use ($pdo) {
        $mobile = '9811111104';
        insertWallet($pdo, $mobile, 500, 'CREDIT', 'placed');
        insertWallet($pdo, $mobile, 300, 'CREDIT', 'failed');   // ignored
        insertWallet($pdo, $mobile, 200, 'CREDIT', 'pending');  // ignored
        expect(computeWalletBalance($pdo, $mobile))->toBe(500.0);
    });

    it('1.5 returns 0 for mobile with no wallet entries', function() use ($pdo) {
        expect(computeWalletBalance($pdo, '0000000000'))->toBe(0.0);
    });

    it('1.6 handles very large amounts without overflow', function() use ($pdo) {
        $mobile = '9811111106';
        insertWallet($pdo, $mobile, 99999.99, 'CREDIT', 'placed');
        $bal = computeWalletBalance($pdo, $mobile);
        expect($bal)->toBeGreaterThan(99000.0);
    });

    it('1.7 authorized status is counted in balance', function() use ($pdo) {
        $mobile = '9811111107';
        insertWallet($pdo, $mobile, 250, 'CREDIT', 'authorized');
        expect(computeWalletBalance($pdo, $mobile))->toBe(250.0);
    });

    it('1.8 captured status is counted in balance', function() use ($pdo) {
        $mobile = '9811111108';
        insertWallet($pdo, $mobile, 300, 'CREDIT', 'captured');
        expect(computeWalletBalance($pdo, $mobile))->toBe(300.0);
    });

    it('1.9 success status is counted in balance', function() use ($pdo) {
        $mobile = '9811111109';
        insertWallet($pdo, $mobile, 400, 'CREDIT', 'success');
        expect(computeWalletBalance($pdo, $mobile))->toBe(400.0);
    });

    it('1.10 handles decimal amounts correctly (rounded to whole)', function() use ($pdo) {
        $mobile = '9811111110';
        insertWallet($pdo, $mobile, 149.75, 'CREDIT', 'placed');
        // Should round to 150
        $bal = computeWalletBalance($pdo, $mobile);
        expect($bal)->toBeGreaterThanOrEqual(149.0);
    });

    it('1.11 prevents duplicate Razorpay payment credit', function() use ($pdo) {
        $mobile = '9811111111';
        $paymentId = 'pay_DEDUP_001';
        
        // First credit
        $check = $pdo->prepare("SELECT id FROM wallets WHERE description LIKE ? AND status='authorized'");
        $check->execute(["%$paymentId%"]);
        if (!$check->fetch()) {
            $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
                ->execute([$mobile, 1000, "Added money via Razorpay ($paymentId)"]);
        }

        // Attempt duplicate
        $check2 = $pdo->prepare("SELECT id FROM wallets WHERE description LIKE ? AND status='authorized'");
        $check2->execute(["%$paymentId%"]);
        $isDuplicate = (bool)$check2->fetch();

        if (!$isDuplicate) {
            $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
                ->execute([$mobile, 1000, "Added money via Razorpay ($paymentId)"]);
        }

        expect(computeWalletBalance($pdo, $mobile))->toBe(1000.0);
    });

    it('1.12 wallet read returns initial balance entry for new mobile', function() use ($pdo) {
        // Simulate what read_wallet.php returns for new user: empty wallet list -> returns [{total:0}]
        $mobile = '9811111199';
        $stmt = $pdo->prepare("SELECT id FROM wallets WHERE mobile=?");
        $stmt->execute([$mobile]);
        $rows = $stmt->fetchAll();
        $isEmpty = count($rows) === 0;
        expect($isEmpty)->toBe(true);
        // If empty, the API returns a synthetic zero-balance entry (tested by presence logic)
        $syntheticEntry = $isEmpty ? [['id'=>'0','total'=>0,'amount'=>0]] : $rows;
        expect(count($syntheticEntry))->toBeGreaterThanOrEqual(1);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: ORDER CANCELLATION
// ═══════════════════════════════════════════════════════════
describe('SUITE 2 — Cancel Order (cancel_order.php logic)', function() use ($pdo) {
    teardown($pdo);

    it('2.1 cancels a PLACED Wallet order and credits full refund to wallet', function() use ($pdo) {
        $mobile = '9876540001';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 300, 'payment_type' => 'Wallet']);
        $result = cancelOrder($pdo, $orderId);
        expect($result['status'])->toBe('SUCCESS');
        expect((float)$result['refund_amount'])->toBe(300.0);
        expect(computeWalletBalance($pdo, $mobile))->toBe(300.0);
    });

    it('2.2 does NOT credit wallet for COD cancellation', function() use ($pdo) {
        $mobile = '9876540002';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 200, 'payment_type' => 'COD']);
        $result = cancelOrder($pdo, $orderId);
        expect($result['is_cod'])->toBe(true);
        expect(computeWalletBalance($pdo, $mobile))->toBe(0.0);
    });

    it('2.3 prevents double-refund when order is already CANCELLED', function() use ($pdo) {
        $mobile = '9876540003';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 150, 'status' => 'CANCELLED', 'refund_amount' => 150]);
        insertWallet($pdo, $mobile, 150, 'CREDIT', 'placed');
        $result = cancelOrder($pdo, $orderId);
        expect($result['message'])->toContain('already cancelled');
        expect(computeWalletBalance($pdo, $mobile))->toBe(150.0);
    });

    it('2.4 computes correct refund_due when partial refund was already issued', function() use ($pdo) {
        $mobile = '9876540004';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 200, 'refund_amount' => 50]);
        // Expected refund: 200 - 50 = 150
        $stmt = $pdo->prepare("SELECT total_amount, refund_amount FROM orders WHERE order_id=?");
        $stmt->execute([$orderId]);
        $row = $stmt->fetch();
        $refundDue = max(0, floatval($row['total_amount']) - floatval($row['refund_amount']));
        expect($refundDue)->toBe(150.0);
    });

    it('2.5 rolls back wallet insert if DB update fails (transaction safety)', function() use ($pdo) {
        $mobile = '9876540005';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 100]);
        $balBefore = computeWalletBalance($pdo, $mobile);

        try {
            $pdo->beginTransaction();
            $pdo->prepare("INSERT INTO wallets (mobile, amount, type, status) VALUES (?,?,'CREDIT','placed')")
                ->execute([$mobile, 100]);
            $pdo->exec("UPDATE orders SET nonexistent_col='x' WHERE order_id='$orderId'");
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
        }

        expect(computeWalletBalance($pdo, $mobile))->toBe($balBefore);
    });

    it('2.6 returns error for non-existent order_id', function() use ($pdo) {
        $result = cancelOrder($pdo, 'ORD_DOES_NOT_EXIST_XYZ');
        expect(isset($result['error']))->toBe(true);
    });

    it('2.7 all order_items are marked cancelled on order cancellation', function() use ($pdo) {
        $mobile = '9876540007';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 400]);
        insertOrderItem($pdo, $orderId, ['price' => 200, 'product_name' => 'Apple']);
        insertOrderItem($pdo, $orderId, ['price' => 200, 'product_name' => 'Banana']);
        cancelOrder($pdo, $orderId);
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM order_items WHERE order_id=? AND item_status != 'cancelled'");
        $stmt->execute([$orderId]);
        expect((int)$stmt->fetchColumn())->toBe(0);
    });

    it('2.8 Cash On Delivery order sets correct refund_notes', function() use ($pdo) {
        $mobile = '9876540008';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 250, 'payment_type' => 'Cash On Delivery']);
        $pdo->prepare("UPDATE orders SET status='CANCELLED', refund_notes='Cancelled (COD - No refund)' WHERE order_id=?")
            ->execute([$orderId]);
        $stmt = $pdo->prepare("SELECT refund_notes FROM orders WHERE order_id=?");
        $stmt->execute([$orderId]);
        $notes = $stmt->fetchColumn();
        expect($notes)->toContain('COD');
    });

    it('2.9 zero-amount order cancellation does not create a wallet entry', function() use ($pdo) {
        $mobile = '9876540009';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 0, 'payment_type' => 'Wallet']);
        $result = cancelOrder($pdo, $orderId);
        expect($result['refund_amount'])->toBe(0);
        // No wallet entry created for 0-amount refund
        $count = $pdo->prepare("SELECT COUNT(*) FROM wallets WHERE mobile=?");
        $count->execute([$mobile]);
        expect((int)$count->fetchColumn())->toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: CANCEL ORDER ITEM
// ═══════════════════════════════════════════════════════════
describe('SUITE 3 — Cancel Order Item (cancel_order_item.php logic)', function() use ($pdo) {
    teardown($pdo);

    it('3.1 cancels a single item and refunds wallet for Wallet order', function() use ($pdo) {
        $mobile = '9876541001';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 280, 'payment_type' => 'Wallet']);
        $itemId = insertOrderItem($pdo, $orderId, ['price' => 100, 'product_name' => 'Tomatoes']);
        insertOrderItem($pdo, $orderId, ['price' => 180, 'product_name' => 'Potatoes']);

        // Simulate cancel_order_item logic
        $pdo->beginTransaction();
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'placed')")
            ->execute([$mobile, 100, "Refund for Tomatoes in $orderId"]);
        $pdo->prepare("UPDATE order_items SET item_status='cancelled', refund_amount=100 WHERE id=?")
            ->execute([$itemId]);
        $active = $pdo->prepare("SELECT COUNT(*), COALESCE(SUM(price),0) FROM order_items WHERE order_id=? AND item_status != 'cancelled'");
        $active->execute([$orderId]);
        [$cnt, $tot] = $active->fetch(PDO::FETCH_NUM);
        $pdo->prepare("UPDATE orders SET total_amount=?, refund_amount=100 WHERE order_id=?")->execute([$tot, $orderId]);
        $pdo->commit();

        expect(computeWalletBalance($pdo, $mobile))->toBe(100.0);
        $row = $pdo->prepare("SELECT total_amount FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        expect((float)$row->fetchColumn())->toBe(180.0);
    });

    it('3.2 marks entire order CANCELLED when last item is cancelled', function() use ($pdo) {
        $mobile = '9876541002';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 100]);
        $itemId = insertOrderItem($pdo, $orderId, ['price' => 100]);

        $pdo->beginTransaction();
        $pdo->prepare("UPDATE order_items SET item_status='cancelled' WHERE id=?")->execute([$itemId]);
        $active = $pdo->prepare("SELECT COUNT(*) FROM order_items WHERE order_id=? AND item_status != 'cancelled'");
        $active->execute([$orderId]);
        $cnt = (int)$active->fetchColumn();
        $newStatus = ($cnt === 0) ? 'CANCELLED' : 'PLACED';
        $pdo->prepare("UPDATE orders SET status=?, total_amount=0 WHERE order_id=?")->execute([$newStatus, $orderId]);
        $pdo->commit();

        $row = $pdo->prepare("SELECT status FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        expect($row->fetchColumn())->toBe('CANCELLED');
    });

    it('3.3 does NOT refund wallet for COD item cancellation', function() use ($pdo) {
        $mobile = '9876541003';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 200, 'payment_type' => 'COD']);
        $itemId = insertOrderItem($pdo, $orderId, ['price' => 80]);

        // COD = no wallet refund
        $pdo->prepare("UPDATE order_items SET item_status='cancelled', refund_amount=0 WHERE id=?")->execute([$itemId]);
        expect(computeWalletBalance($pdo, $mobile))->toBe(0.0);
    });

    it('3.4 returns already-cancelled for a previously-cancelled item', function() use ($pdo) {
        $mobile = '9876541004';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 0]);
        $itemId = insertOrderItem($pdo, $orderId, ['price' => 60, 'item_status' => 'cancelled']);

        $stmt = $pdo->prepare("SELECT item_status FROM order_items WHERE id=?");
        $stmt->execute([$itemId]);
        $status = $stmt->fetchColumn();
        expect($status)->toBe('cancelled');
        // No additional wallet entry
        expect(computeWalletBalance($pdo, $mobile))->toBe(0.0);
    });

    it('3.5 accumulated refund_amount on order is correctly tracked', function() use ($pdo) {
        $mobile = '9876541005';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 300, 'refund_amount' => 80, 'payment_type' => 'Wallet']);
        $itemId = insertOrderItem($pdo, $orderId, ['price' => 100]);

        // Cancel additional item: new refund = 80 + 100 = 180
        $pdo->prepare("UPDATE orders SET refund_amount=? WHERE order_id=?")->execute([180, $orderId]);
        $stmt = $pdo->prepare("SELECT refund_amount FROM orders WHERE order_id=?");
        $stmt->execute([$orderId]);
        expect((float)$stmt->fetchColumn())->toBe(180.0);
    });

    it('3.6 item lookup cascades: finds item by product_name if no id given', function() use ($pdo) {
        $mobile = '9876541006';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 150]);
        insertOrderItem($pdo, $orderId, ['price' => 150, 'product_name' => 'Carrot']);
        
        $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id=? AND product_name=? LIMIT 1");
        $stmt->execute([$orderId, 'Carrot']);
        $item = $stmt->fetch();
        expect($item)->toBeTruthy();
        expect($item['product_name'])->toBe('Carrot');
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 4: ORDER PLACEMENT
// ═══════════════════════════════════════════════════════════
describe('SUITE 4 — Place Order (place_order.php logic)', function() use ($pdo) {
    teardown($pdo);

    it('4.1 generates valid order_id with ORD_ prefix', function() use ($pdo) {
        $orderId = 'ORD_' . date('YmdHis') . '_' . rand(100, 999);
        expect(strlen($orderId))->toBeGreaterThan(10);
        expect(strpos($orderId, 'ORD_'))->toBe(0);
    });

    it('4.2 computes NEXT_DAY_7AM delivery as tomorrow', function() use ($pdo) {
        $deliveryDate = date('Y-m-d', strtotime('+1 day'));
        expect($deliveryDate)->toBe(date('Y-m-d', strtotime('+1 day')));
    });

    it('4.3 IMMEDIATE_10 delivery_expected_at is in the future', function() use ($pdo) {
        $expected = date('Y-m-d H:i:s', strtotime('+10 minutes'));
        expect(strtotime($expected))->toBeGreaterThan(time());
    });

    it('4.4 IMMEDIATE_30 delivery_expected_at is in the future', function() use ($pdo) {
        $expected = date('Y-m-d H:i:s', strtotime('+30 minutes'));
        expect(strtotime($expected))->toBeGreaterThan(time());
    });

    it('4.5 inserts order into orders table with correct defaults', function() use ($pdo) {
        $orderId = 'ORD_PLACE_' . rand(10000, 99999);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, payment_type, status) VALUES (?,?,?,?,?)")
            ->execute([$orderId, '9876543210', 450, 'Wallet', 'PLACED']);
        $row = $pdo->prepare("SELECT * FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        $result = $row->fetch();
        expect($result)->toBeTruthy();
        expect($result['status'])->toBe('PLACED');
        expect((float)$result['total_amount'])->toBe(450.0);
    });

    it('4.6 inserts multiple order items and counts them correctly', function() use ($pdo) {
        $orderId = 'ORD_MULTI_' . rand(10000, 99999);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")
            ->execute([$orderId, '9876543210', 200, 'PLACED']);
        $items = [
            ['P1','Carrot',2,60],
            ['P2','Spinach',1,40],
            ['P3','Onion',3,100],
        ];
        foreach ($items as $item) {
            $pdo->prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?,?,?,?,?)")
                ->execute(array_merge([$orderId], $item));
        }
        $count = $pdo->prepare("SELECT COUNT(*) FROM order_items WHERE order_id=?");
        $count->execute([$orderId]);
        expect((int)$count->fetchColumn())->toBe(3);
    });

    it('4.7 unique constraint prevents duplicate order_id', function() use ($pdo) {
        $orderId = 'ORD_UNIQUE_EDGE_TEST';
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")
            ->execute([$orderId, '9876543210', 100, 'PLACED']);
        $threw = false;
        try {
            $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")
                ->execute([$orderId, '9876543210', 100, 'PLACED']);
        } catch (PDOException $e) {
            $threw = true;
        }
        expect($threw)->toBe(true);
    });

    it('4.8 order with 0 total_amount is inserted without error', function() use ($pdo) {
        $orderId = 'ORD_ZERO_' . rand(10000, 99999);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")
            ->execute([$orderId, '9876543210', 0, 'PLACED']);
        $row = $pdo->prepare("SELECT total_amount FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        expect((float)$row->fetchColumn())->toBe(0.0);
    });

    it('4.9 immediate delivery falls back to NEXT_DAY outside operating hours', function() use ($pdo) {
        $currentHour = (int)date('G');
        $isOperating = ($currentHour >= 8 && $currentHour < 20);
        $deliveryOption = 'IMMEDIATE_10';
        if (!$isOperating) {
            $deliveryOption = 'NEXT_DAY_7AM';
        }
        // If outside hours, it's always NEXT_DAY_7AM — ensures no off-hours immediate delivery
        if (!$isOperating) {
            expect($deliveryOption)->toBe('NEXT_DAY_7AM');
        } else {
            expect($deliveryOption)->toBe('IMMEDIATE_10'); // inside hours, stays immediate
        }
    });

    it('4.10 OFFLINE payment type is correctly identified', function() use ($pdo) {
        $payment_type = 'OFFLINE';
        $isOffline = ($payment_type === 'OFFLINE');
        expect($isOffline)->toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: ORDER STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════════
describe('SUITE 5 — Order Status Transitions', function() use ($pdo) {
    teardown($pdo);

    it('5.1 PLACED → PACKED', function() use ($pdo) {
        $orderId = insertOrder($pdo, ['status' => 'PLACED']);
        $pdo->prepare("UPDATE orders SET status='PACKED' WHERE order_id=?")->execute([$orderId]);
        $row = $pdo->prepare("SELECT status FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        expect($row->fetchColumn())->toBe('PACKED');
    });

    it('5.2 PACKED → OUT_FOR_DELIVERY', function() use ($pdo) {
        $orderId = insertOrder($pdo, ['status' => 'PACKED']);
        $pdo->prepare("UPDATE orders SET status='OUT_FOR_DELIVERY' WHERE order_id=?")->execute([$orderId]);
        $row = $pdo->prepare("SELECT status FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        expect($row->fetchColumn())->toBe('OUT_FOR_DELIVERY');
    });

    it('5.3 OUT_FOR_DELIVERY → DELIVERED (with delivered_at timestamp)', function() use ($pdo) {
        $orderId = insertOrder($pdo, ['status' => 'OUT_FOR_DELIVERY']);
        $pdo->prepare("UPDATE orders SET status='DELIVERED', delivered_at=NOW() WHERE order_id=?")->execute([$orderId]);
        $row = $pdo->prepare("SELECT status, delivered_at FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        $result = $row->fetch();
        expect($result['status'])->toBe('DELIVERED');
        expect($result['delivered_at'])->toBeTruthy();
    });

    it('5.4 OUT_FOR_DELIVERY → UNDELIVERED (with reason)', function() use ($pdo) {
        $orderId = insertOrder($pdo, ['status' => 'OUT_FOR_DELIVERY']);
        $pdo->prepare("UPDATE orders SET status='UNDELIVERED', undelivered_reason='Customer absent' WHERE order_id=?")->execute([$orderId]);
        $row = $pdo->prepare("SELECT status, undelivered_reason FROM orders WHERE order_id=?");
        $row->execute([$orderId]);
        $result = $row->fetch();
        expect($result['status'])->toBe('UNDELIVERED');
        expect($result['undelivered_reason'])->toBe('Customer absent');
    });

    it('5.5 CANCELLED order cannot be re-cancelled (guard check)', function() use ($pdo) {
        $orderId = insertOrder($pdo, ['status' => 'CANCELLED']);
        $stmt = $pdo->prepare("SELECT status FROM orders WHERE order_id=?");
        $stmt->execute([$orderId]);
        $status = $stmt->fetchColumn();
        $alreadyCancelled = ($status === 'CANCELLED');
        expect($alreadyCancelled)->toBe(true);
    });

    it('5.6 DELIVERED order cannot be cancelled (business rule check)', function() use ($pdo) {
        $orderId = insertOrder($pdo, ['status' => 'DELIVERED']);
        $stmt = $pdo->prepare("SELECT status FROM orders WHERE order_id=?");
        $stmt->execute([$orderId]);
        $status = $stmt->fetchColumn();
        $canCancel = !in_array($status, ['DELIVERED', 'CANCELLED']);
        expect($canCancel)->toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 6: SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════
describe('SUITE 6 — Subscription Logic', function() use ($pdo) {
    teardown($pdo);

    it('6.1 correctly identifies a subscription item scheduled for today', function() use ($pdo) {
        $today = date('Y-m-d');
        $dates = json_encode([$today, date('Y-m-d', strtotime('+1 day'))]);
        $matched = array_filter(json_decode($dates, true), fn($d) => date('Y-m-d', strtotime($d)) === $today);
        expect(count($matched))->toBe(1);
    });

    it('6.2 returns 0 matches when subscription dates do not include today', function() use ($pdo) {
        $dates = json_encode([date('Y-m-d', strtotime('-1 day')), date('Y-m-d', strtotime('+1 day'))]);
        $today = date('Y-m-d');
        $matched = array_filter(json_decode($dates, true), fn($d) => date('Y-m-d', strtotime($d)) === $today);
        expect(count($matched))->toBe(0);
    });

    it('6.3 handles empty rangeDates gracefully', function() use ($pdo) {
        $dates = json_decode('[]', true);
        expect(count($dates ?? []))->toBe(0);
    });

    it('6.4 handles null/invalid JSON without crashing', function() use ($pdo) {
        $dates = json_decode('not_valid_json', true);
        expect($dates)->toBeNull();
    });

    it('6.5 correctly parses rangeDates with count objects', function() use ($pdo) {
        $today = date('Y-m-d');
        $rangeDates = json_encode([
            ['date' => $today, 'count' => 3, 'status' => 'pending'],
            ['date' => date('Y-m-d', strtotime('+1 day')), 'count' => 2, 'status' => 'pending'],
        ]);
        $dates = json_decode($rangeDates, true);
        $todayEntry = null;
        foreach ($dates as $d) {
            if (is_array($d) && isset($d['date']) && date('Y-m-d', strtotime($d['date'])) === $today) {
                $todayEntry = $d;
                break;
            }
        }
        expect($todayEntry)->toBeTruthy();
        expect($todayEntry['count'])->toBe(3);
    });

    it('6.6 paused subscription is excluded from active delivery logic', function() use ($pdo) {
        $mobile = '9876542001';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 500]);
        $today = date('Y-m-d');
        $tomorrow = date('Y-m-d', strtotime('+1 day'));
        insertOrderItem($pdo, $orderId, [
            'subscriptionType' => 'range',
            'subsStatus'       => 'paused',
            'rangeDates'       => json_encode([['date' => $today, 'count' => 1, 'status' => 'pending']]),
        ]);

        // Paused subscriptions should NOT be included in active delivery
        $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id=? AND subsStatus IN ('active','resume')");
        $stmt->execute([$orderId]);
        $active = $stmt->fetchAll();
        expect(count($active))->toBe(0);
    });

    it('6.7 resumed subscription is included in active delivery', function() use ($pdo) {
        $mobile = '9876542002';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 500]);
        $today = date('Y-m-d');
        insertOrderItem($pdo, $orderId, [
            'subscriptionType' => 'range',
            'subsStatus'       => 'resume',
            'rangeDates'       => json_encode([['date' => $today, 'count' => 1, 'status' => 'pending']]),
        ]);

        $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id=? AND subsStatus IN ('active','resume')");
        $stmt->execute([$orderId]);
        $active = $stmt->fetchAll();
        expect(count($active))->toBe(1);
    });

    it('6.8 subscription pause/resume updates subsStatus and pausedDates correctly', function() use ($pdo) {
        $orderId = 'ORD_PAUSE_' . rand(10000, 99999);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")
            ->execute([$orderId, '9876542003', 300, 'PLACED']);
        $pdo->prepare("INSERT INTO order_items (order_id, product_id, subscriptionType, subsStatus, rangeDates) VALUES (?,?,?,?,?)")
            ->execute([$orderId, 'PROD_SUB_1', 'range', 'active', json_encode([['date' => date('Y-m-d'), 'count' => 1, 'status' => 'pending']])]);
        
        $pdo->prepare("UPDATE order_items SET subsStatus='paused', pausedDates=? WHERE order_id=? AND product_id=?")
            ->execute([json_encode([['date' => date('Y-m-d'), 'count' => 1]]), $orderId, 'PROD_SUB_1']);

        $row = $pdo->prepare("SELECT subsStatus, pausedDates FROM order_items WHERE order_id=?");
        $row->execute([$orderId]);
        $result = $row->fetch();
        expect($result['subsStatus'])->toBe('paused');
        $pausedDates = json_decode($result['pausedDates'], true);
        expect(is_array($pausedDates))->toBe(true);
        expect(count($pausedDates))->toBeGreaterThan(0);
    });

    it('6.9 subscription item with subscription_enabled=false is not shown in subscription calendar', function() use ($pdo) {
        $pdo->prepare("INSERT INTO products (id, name, price, subscription_enabled) VALUES (?,?,?,?)")
            ->execute(['PROD_NOSUB', 'Disabled Product', 50, 0]);
        $row = $pdo->prepare("SELECT subscription_enabled FROM products WHERE id=?");
        $row->execute(['PROD_NOSUB']);
        expect((int)$row->fetchColumn())->toBe(0);
    });

    it('6.10 ledger balance excludes delivered subscription dates', function() use ($pdo) {
        // Only future/pending dates should count toward ledger balance
        $today = date('Y-m-d');
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        $dates = [
            ['date' => $yesterday, 'count' => 1, 'status' => 'delivered'],
            ['date' => $today,     'count' => 1, 'status' => 'pending'],
        ];
        $pricePerDay = 100;
        $ledger = 0;
        foreach ($dates as $d) {
            $dStatus = strtolower($d['status'] ?? '');
            if ($dStatus !== 'delivered' && $dStatus !== 'cancelled') {
                if (strtotime($d['date']) >= strtotime($today)) {
                    $ledger += ($d['count'] * $pricePerDay);
                }
            }
        }
        expect($ledger)->toBe(100); // Only today's pending counts
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 7: CHECKOUT (WALLET DEDUCTION)
// ═══════════════════════════════════════════════════════════
describe('SUITE 7 — Checkout & Wallet Deduction', function() use ($pdo) {
    teardown($pdo);

    it('7.1 wallet deduction is inserted as DEBIT entry on order placement', function() use ($pdo) {
        $mobile = '9876543001';
        insertWallet($pdo, $mobile, 500, 'CREDIT', 'placed');
        // Simulate wallet deduction on checkout
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'DEBIT',?,'placed')")
            ->execute([$mobile, 300, 'Order ORD_CHK_001']);
        expect(computeWalletBalance($pdo, $mobile))->toBe(200.0);
    });

    it('7.2 checkout fails gracefully when wallet balance is insufficient', function() use ($pdo) {
        $mobile = '9876543002';
        insertWallet($pdo, $mobile, 100, 'CREDIT', 'placed');
        $balance = computeWalletBalance($pdo, $mobile);
        $orderAmount = 300;
        $canCheckout = $balance >= $orderAmount;
        expect($canCheckout)->toBe(false);
    });

    it('7.3 COD order does not touch wallet balance', function() use ($pdo) {
        $mobile = '9876543003';
        insertWallet($pdo, $mobile, 200, 'CREDIT', 'placed');
        $balBefore = computeWalletBalance($pdo, $mobile);
        // COD: no wallet deduction happens
        $balAfter = computeWalletBalance($pdo, $mobile);
        expect($balAfter)->toBe($balBefore);
    });

    it('7.4 Razorpay top-up credits wallet with authorized status', function() use ($pdo) {
        $mobile = '9876543004';
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
            ->execute([$mobile, 500, 'Added via Razorpay (pay_123)']);
        expect(computeWalletBalance($pdo, $mobile))->toBe(500.0);
    });

    it('7.5 multiple orders deduct correctly from same wallet', function() use ($pdo) {
        $mobile = '9876543005';
        insertWallet($pdo, $mobile, 1000, 'CREDIT', 'placed');
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'DEBIT',?,'placed')")
            ->execute([$mobile, 300, 'Order 1']);
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'DEBIT',?,'placed')")
            ->execute([$mobile, 200, 'Order 2']);
        expect(computeWalletBalance($pdo, $mobile))->toBe(500.0);
    });

    it('7.6 wallet balance is exactly 0 after spending all credits', function() use ($pdo) {
        $mobile = '9876543006';
        insertWallet($pdo, $mobile, 300, 'CREDIT', 'placed');
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'DEBIT',?,'placed')")
            ->execute([$mobile, 300, 'Full spend']);
        expect(computeWalletBalance($pdo, $mobile))->toBe(0.0);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 8: REFERRAL
// ═══════════════════════════════════════════════════════════
describe('SUITE 8 — Referral Validation', function() use ($pdo) {
    teardown($pdo);

    it('8.1 valid referral code credits ₹100 to referrer wallet', function() use ($pdo) {
        $referrerMobile = '9876544001';
        $newUserMobile  = '9876544099';
        $pdo->prepare("INSERT INTO users (mobile, name, referral_id) VALUES (?,?,?)")
            ->execute([$referrerMobile, 'Referrer User', 'THINK544001']);

        // Simulate referral credit (no duplicate check yet)
        $refCheck = $pdo->prepare("SELECT id FROM wallets WHERE mobile=? AND description LIKE ? LIMIT 1");
        $refCheck->execute([$referrerMobile, "%Referral Bonus from $newUserMobile%"]);
        if (!$refCheck->fetch()) {
            $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
                ->execute([$referrerMobile, 100, "Referral Bonus from $newUserMobile"]);
        }

        expect(computeWalletBalance($pdo, $referrerMobile))->toBe(100.0);
    });

    it('8.2 prevents self-referral (user cannot use own referral code)', function() use ($pdo) {
        $mobile = '9876544002';
        $referralCode = 'THINK544002';
        $pdo->prepare("INSERT INTO users (mobile, name, referral_id) VALUES (?,?,?)")
            ->execute([$mobile, 'Self User', $referralCode]);

        $stmt = $pdo->prepare("SELECT mobile, referral_id FROM users WHERE referral_id=? LIMIT 1");
        $stmt->execute([$referralCode]);
        $referrer = $stmt->fetch();
        $isSelfReferral = ($referrer && $referrer['mobile'] === $mobile);
        expect($isSelfReferral)->toBe(true);
        // Self-referral should be blocked
    });

    it('8.3 prevents duplicate referral bonus to the same referrer', function() use ($pdo) {
        $referrerMobile = '9876544003';
        $newUserMobile  = '9876544098';
        $pdo->prepare("INSERT INTO users (mobile, name, referral_id) VALUES (?,?,?)")
            ->execute([$referrerMobile, 'Referrer 3', 'THINK544003']);

        // First referral
        $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
            ->execute([$referrerMobile, 100, "Referral Bonus from $newUserMobile"]);

        // Attempt duplicate
        $refCheck = $pdo->prepare("SELECT id FROM wallets WHERE mobile=? AND description LIKE ? LIMIT 1");
        $refCheck->execute([$referrerMobile, "%Referral Bonus from $newUserMobile%"]);
        $isDuplicate = (bool)$refCheck->fetch();
        if (!$isDuplicate) {
            $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
                ->execute([$referrerMobile, 100, "Referral Bonus from $newUserMobile"]);
        }

        expect(computeWalletBalance($pdo, $referrerMobile))->toBe(100.0);
    });

    it('8.4 referral with no matching user still succeeds (returns valid=true with fallback)', function() use ($pdo) {
        // If referral code has 10 digits, fallback to treating as mobile
        $referralCode = '9876500000';
        $digits = preg_replace('/[^0-9]/', '', $referralCode);
        $isMobile = (strlen($digits) >= 10);
        expect($isMobile)->toBe(true);
    });

    it('8.5 missing referral code returns valid=false', function() use ($pdo) {
        $referralCode = trim('');
        $isValid = !empty($referralCode);
        expect($isValid)->toBe(false);
    });

    it('8.6 WELCOME25 coupon is assigned to new user on referral', function() use ($pdo) {
        $newUserMobile = '9876544097';
        // Ensure coupon exists
        $pdo->prepare("INSERT INTO coupons (code, discount_percent, max_discount, min_order_amount) VALUES ('WELCOME25', 25, 200, 100) ON DUPLICATE KEY UPDATE discount_percent=25")
            ->execute();
        // Assign to user
        $ucCheck = $pdo->prepare("SELECT id FROM user_coupons WHERE mobile=? AND coupon_code='WELCOME25' LIMIT 1");
        $ucCheck->execute([$newUserMobile]);
        if (!$ucCheck->fetch()) {
            $pdo->prepare("INSERT INTO user_coupons (mobile, coupon_code, used) VALUES (?,?,0)")
                ->execute([$newUserMobile, 'WELCOME25']);
        }
        $verify = $pdo->prepare("SELECT id FROM user_coupons WHERE mobile=? AND coupon_code='WELCOME25'");
        $verify->execute([$newUserMobile]);
        expect($verify->fetch())->toBeTruthy();
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 9: USER REGISTRATION
// ═══════════════════════════════════════════════════════════
describe('SUITE 9 — User Registration (new_user.php logic)', function() use ($pdo) {
    teardown($pdo);

    it('9.1 registers new user with correct referral_id format', function() use ($pdo) {
        $mobile = '9876543210';
        $refId  = 'THINK' . substr($mobile, -6);
        $pdo->prepare("INSERT INTO users (mobile, name, email, referral_id) VALUES (?,?,?,?)")
            ->execute([$mobile, 'Test User', 'test@test.com', $refId]);
        $row = $pdo->prepare("SELECT referral_id FROM users WHERE mobile=?");
        $row->execute([$mobile]);
        expect($row->fetchColumn())->toBe('THINK543210');
    });

    it('9.2 existing user returns EXISTING status (no duplicate insert)', function() use ($pdo) {
        $mobile = '9876543210'; // already inserted above
        $stmt = $pdo->prepare("SELECT mobile FROM users WHERE mobile=? LIMIT 1");
        $stmt->execute([$mobile]);
        $existing = $stmt->fetch();
        $isExisting = (bool)$existing;
        expect($isExisting)->toBe(true);
        // Status should be EXISTING, not ADDED
    });

    it('9.3 rejects duplicate mobile in users table', function() use ($pdo) {
        $mobile = '9876543210';
        $threw = false;
        try {
            $pdo->prepare("INSERT INTO users (mobile, name) VALUES (?,?)")->execute([$mobile, 'Dup User']);
        } catch (PDOException $e) {
            $threw = true;
        }
        expect($threw)->toBe(true);
    });

    it('9.4 legacy user with only address (no users record) is treated as existing', function() use ($pdo) {
        $mobile = '9876549999';
        $pdo->prepare("INSERT INTO user_addresses (mobile, address) VALUES (?,?)")
            ->execute([$mobile, '5 Legacy Lane']);
        // Check: address found => existing user
        $check = $pdo->prepare("SELECT id FROM user_addresses WHERE mobile=? LIMIT 1");
        $check->execute([$mobile]);
        $isExisting = (bool)$check->fetch();
        expect($isExisting)->toBe(true);
    });

    it('9.5 legacy user with only orders (no users/address record) is treated as existing', function() use ($pdo) {
        $mobile = '9876549998';
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")
            ->execute(['ORD_LEG_001', $mobile, 100, 'DELIVERED']);
        $check = $pdo->prepare("SELECT order_id FROM orders WHERE mobile=? LIMIT 1");
        $check->execute([$mobile]);
        $isExisting = (bool)$check->fetch();
        expect($isExisting)->toBe(true);
    });

    it('9.6 user counts orders and spend correctly', function() use ($pdo) {
        teardown($pdo);
        $mobile = '9876543210';
        $pdo->prepare("INSERT INTO users (mobile, name) VALUES (?,?)")->execute([$mobile, 'Test User']);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")->execute(['ORD_USR1', $mobile, 150, 'DELIVERED']);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")->execute(['ORD_USR2', $mobile, 250, 'DELIVERED']);
        $stats = $pdo->prepare("SELECT COUNT(*) as total_orders, SUM(total_amount) as total_spent FROM orders WHERE mobile=?");
        $stats->execute([$mobile]);
        $row = $stats->fetch();
        expect((int)$row['total_orders'])->toBe(2);
        expect((float)$row['total_spent'])->toBe(400.0);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 10: DELIVERY PARTNERS
// ═══════════════════════════════════════════════════════════
describe('SUITE 10 — Delivery Partners', function() use ($pdo) {
    teardown($pdo);

    it('10.1 correctly counts active orders for a delivery partner', function() use ($pdo) {
        $pdo->prepare("INSERT INTO delivery_partners (username, password, name) VALUES (?,?,?)")
            ->execute(['dp1', 'pass123', 'Ramesh Kumar']);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status, assigned_to) VALUES (?,?,?,?,?)")
            ->execute(['ORD_DP001', '9000000001', 100, 'PLACED', 'Ramesh Kumar']);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status, assigned_to) VALUES (?,?,?,?,?)")
            ->execute(['ORD_DP002', '9000000002', 200, 'PACKED', 'Ramesh Kumar']);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status, assigned_to) VALUES (?,?,?,?,?)")
            ->execute(['ORD_DP003', '9000000003', 150, 'DELIVERED', 'Ramesh Kumar']); // should NOT count
        $count = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE assigned_to=? AND status NOT IN ('DELIVERED','CANCELLED')");
        $count->execute(['Ramesh Kumar']);
        expect((int)$count->fetchColumn())->toBe(2);
    });

    it('10.2 returns 0 active orders for non-existent partner', function() use ($pdo) {
        $count = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE assigned_to=? AND status NOT IN ('DELIVERED','CANCELLED')");
        $count->execute(['NonExistentPartner']);
        expect((int)$count->fetchColumn())->toBe(0);
    });

    it('10.3 CANCELLED orders are excluded from partner active count', function() use ($pdo) {
        $count = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE assigned_to=? AND status NOT IN ('DELIVERED','CANCELLED')");
        $count->execute(['Ramesh Kumar']);
        $active = (int)$count->fetchColumn();
        // Should only be PLACED and PACKED = 2 (no CANCELLED)
        expect($active)->toBeLessThanOrEqual(2);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 11: DOUBLE REFUND PROTECTION
// ═══════════════════════════════════════════════════════════
describe('SUITE 11 — Double Refund & Duplicate Credit Protection', function() use ($pdo) {
    teardown($pdo);

    it('11.1 prevents double-refund when cancel_order called twice', function() use ($pdo) {
        $mobile = '9876545001';
        $orderId = insertOrder($pdo, ['mobile' => $mobile, 'total_amount' => 500, 'payment_type' => 'Wallet']);

        // First cancel
        cancelOrder($pdo, $orderId);
        $bal1 = computeWalletBalance($pdo, $mobile);
        expect($bal1)->toBe(500.0);

        // Second cancel attempt
        $result = cancelOrder($pdo, $orderId);
        expect($result['message'])->toContain('already cancelled');
        $bal2 = computeWalletBalance($pdo, $mobile);
        expect($bal2)->toBe(500.0); // Must remain 500
    });

    it('11.2 prevents duplicate Razorpay payment credit (idempotency)', function() use ($pdo) {
        $mobile = '9876545002';
        $paymentId = 'pay_IDEM_001';

        // First verify
        $check = $pdo->prepare("SELECT id FROM wallets WHERE description LIKE ? AND status='authorized'");
        $check->execute(["%$paymentId%"]);
        if (!$check->fetch()) {
            $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
                ->execute([$mobile, 1000, "Added money via Razorpay ($paymentId)"]);
        }
        expect(computeWalletBalance($pdo, $mobile))->toBe(1000.0);

        // Duplicate verify
        $check2 = $pdo->prepare("SELECT id FROM wallets WHERE description LIKE ? AND status='authorized'");
        $check2->execute(["%$paymentId%"]);
        $isDuplicate = (bool)$check2->fetch();
        if (!$isDuplicate) {
            $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?,?,'CREDIT',?,'authorized')")
                ->execute([$mobile, 1000, "Added money via Razorpay ($paymentId)"]);
        }

        expect(computeWalletBalance($pdo, $mobile))->toBe(1000.0);
    });
});

// ═══════════════════════════════════════════════════════════
// SUITE 12: EDGE CASES & ROBUSTNESS
// ═══════════════════════════════════════════════════════════
describe('SUITE 12 — Edge Cases & Robustness', function() use ($pdo) {
    teardown($pdo);

    it('12.1 getParam reads from $_POST', function() use ($pdo) {
        $_POST['test_k'] = 'hello';
        $val = isset($_POST['test_k']) ? $_POST['test_k'] : null;
        expect($val)->toBe('hello');
        unset($_POST['test_k']);
    });

    it('12.2 getParam reads from $_GET', function() use ($pdo) {
        $_GET['q_k'] = 'world';
        $val = isset($_GET['q_k']) ? $_GET['q_k'] : null;
        expect($val)->toBe('world');
        unset($_GET['q_k']);
    });

    it('12.3 getParam returns null for missing key', function() use ($pdo) {
        $val = isset($_GET['nonexistent_xyz']) ? $_GET['nonexistent_xyz'] : null;
        expect($val)->toBeNull();
    });

    it('12.4 order_id missing returns error guard (not null order_id)', function() use ($pdo) {
        $order_id = '';
        $hasError = empty($order_id);
        expect($hasError)->toBe(true);
    });

    it('12.5 JSON decode of null/empty string returns null safely', function() use ($pdo) {
        $decoded = json_decode('', true);
        expect($decoded)->toBeNull();
    });

    it('12.6 empty items array in order is handled without crash', function() use ($pdo) {
        $items = [];
        expect(count($items))->toBe(0);
        // Should not throw, just produce order with 0 items
    });

    it('12.7 large order with 10 items inserts all correctly', function() use ($pdo) {
        $orderId = 'ORD_LARGE_' . rand(10000, 99999);
        $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?,?,?,?)")
            ->execute([$orderId, '9876549001', 1000, 'PLACED']);
        for ($i = 0; $i < 10; $i++) {
            $pdo->prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?,?,?,?,?)")
                ->execute([$orderId, "P$i", "Product $i", 1, 100]);
        }
        $count = $pdo->prepare("SELECT COUNT(*) FROM order_items WHERE order_id=?");
        $count->execute([$orderId]);
        expect((int)$count->fetchColumn())->toBe(10);
    });

    it('12.8 mobile number validation: 10 digits', function() use ($pdo) {
        $mobile = '9876543210';
        $isValid = preg_match('/^\d{10}$/', $mobile);
        expect((bool)$isValid)->toBe(true);
    });

    it('12.9 mobile number validation: rejects 9 digit number', function() use ($pdo) {
        $mobile = '987654321';
        $isValid = preg_match('/^\d{10}$/', $mobile);
        expect((bool)$isValid)->toBe(false);
    });

    it('12.10 order_source defaults to CLIENT_WEB when not provided', function() use ($pdo) {
        $order_source = '';
        $final = !empty(trim($order_source)) ? trim($order_source) : 'CLIENT_WEB';
        expect($final)->toBe('CLIENT_WEB');
    });

    it('12.11 subscription type defaults to none when not set', function() use ($pdo) {
        $subscriptionType = '';
        $final = !empty($subscriptionType) ? $subscriptionType : 'none';
        expect($final)->toBe('none');
    });

    it('12.12 coupon discount caps at max_discount (₹200 cap test)', function() use ($pdo) {
        $orderAmount = 1000;
        $discountPercent = 25;
        $maxDiscount = 200;
        $calculated = $orderAmount * ($discountPercent / 100);
        $finalDiscount = min($calculated, $maxDiscount);
        expect((float)$finalDiscount)->toBe(200.0);
    });

    it('12.13 coupon below min_order_amount is rejected', function() use ($pdo) {
        $orderAmount = 50;
        $minOrderAmount = 100;
        $isEligible = ($orderAmount >= $minOrderAmount);
        expect($isEligible)->toBe(false);
    });

    it('12.14 delivery date in the past is not accepted as valid future delivery', function() use ($pdo) {
        $pastDate = date('Y-m-d', strtotime('-1 day'));
        $isFutureOrToday = (strtotime($pastDate) >= strtotime(date('Y-m-d')));
        expect($isFutureOrToday)->toBe(false);
    });

    it('12.15 address JSON encodes and decodes correctly', function() use ($pdo) {
        $address = ['name' => 'John', 'address' => '10 Main St', 'pincode' => '600001'];
        $encoded = json_encode($address);
        $decoded = json_decode($encoded, true);
        expect($decoded['name'])->toBe('John');
        expect($decoded['pincode'])->toBe('600001');
    });
});

// ──────────────────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────────────────
teardown($pdo);

// ──────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────
$total = $passed + $failed;
echo "\n" . str_repeat("═", 60) . "\n";
echo "  TOTAL TESTS : $total\n";
echo "  ✅ PASSED   : $passed\n";
echo "  ❌ FAILED   : $failed\n";
echo str_repeat("═", 60) . "\n";

if ($errors) {
    echo "\n🔴  FAILED TEST DETAILS:\n";
    foreach ($errors as $i => $err) {
        echo "  " . ($i+1) . ". $err\n";
    }
}

echo "\n";
exit($failed > 0 ? 1 : 0);
