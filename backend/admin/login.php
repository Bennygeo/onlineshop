<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson(['status' => 'ERROR', 'error' => 'Database connection failed'], 500);
}

try {
    // 1. Ensure admin_users table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS `admin_users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `username` VARCHAR(50) NOT NULL UNIQUE,
        `password_hash` VARCHAR(255) NOT NULL,
        `display_name` VARCHAR(100) DEFAULT 'Store Manager',
        `role` VARCHAR(50) DEFAULT 'Super Admin',
        `status` VARCHAR(20) DEFAULT 'ACTIVE',
        `last_login` DATETIME NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Primary secure admin user
    $adminUser = '9384450877';
    $securePass = 'Tomorrow#9384@Admin2026';
    $secureHash = password_hash($securePass, PASSWORD_DEFAULT);

    // Check if primary admin exists; if not, create
    $checkStmt = $pdo->prepare("SELECT id, password_hash FROM `admin_users` WHERE username = ?");
    $checkStmt->execute([$adminUser]);
    $existingAdmin = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existingAdmin) {
        $ins = $pdo->prepare("INSERT INTO `admin_users` (username, password_hash, display_name, role, status) VALUES (?, ?, ?, ?, ?)");
        $ins->execute([$adminUser, $secureHash, 'Super Admin', 'Super Admin', 'ACTIVE']);
    }

    // Disable / remove legacy insecure demo account if present
    try {
        $pdo->prepare("UPDATE `admin_users` SET status = 'DEACTIVATED' WHERE username = 'admin' AND role != 'Super Admin'")->execute();
    } catch (Exception $e) {}

    // 3. Read username & password from request
    $username = trim(getParam('username', ''));
    $password = trim(getParam('password', ''));

    if (empty($username) || empty($password)) {
        sendJson([
            'status' => 'ERROR',
            'error' => 'Username and password are required.'
        ], 400);
    }

    // 4. Query user
    $stmt = $pdo->prepare("SELECT id, username, password_hash, display_name, role, status FROM `admin_users` WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    $authenticated = false;

    if ($user) {
        // Verify hashed password or direct match with new secure credentials
        if (password_verify($password, $user['password_hash']) || ($username === $adminUser && $password === $securePass)) {
            $authenticated = true;
            // Update hash if plaintext or upgraded
            if ($password === $securePass || !password_verify($password, $user['password_hash'])) {
                $newHash = password_hash($password, PASSWORD_DEFAULT);
                $upd = $pdo->prepare("UPDATE `admin_users` SET password_hash = ?, status = 'ACTIVE' WHERE id = ?");
                $upd->execute([$newHash, $user['id']]);
            }
        }
    } else {
        // Fallback check for primary admin if table is empty or uninitialized
        if ($username === $adminUser && $password === $securePass) {
            $authenticated = true;
            $user = [
                'id' => 1,
                'username' => $adminUser,
                'display_name' => 'Super Admin',
                'role' => 'Super Admin',
                'status' => 'ACTIVE'
            ];
            try {
                $ins = $pdo->prepare("INSERT INTO `admin_users` (username, password_hash, display_name, role, status) VALUES (?, ?, ?, ?, ?)");
                $ins->execute([$adminUser, $secureHash, 'Super Admin', 'Super Admin', 'ACTIVE']);
            } catch (Exception $e) {}
        }
    }

    if (!$authenticated) {
        sendJson([
            'status' => 'ERROR',
            'error' => 'Invalid username or password. Please try again.'
        ], 401);
    }

    if (isset($user['status']) && $user['status'] !== 'ACTIVE') {
        sendJson([
            'status' => 'ERROR',
            'error' => 'This account has been deactivated.'
        ], 403);
    }

    // Update last_login
    if (isset($user['id'])) {
        try {
            $pdo->prepare("UPDATE `admin_users` SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);
        } catch (Exception $e) {}
    }

    // Generate token
    $tokenPayload = $user['username'] . ':' . time() . ':' . bin2hex(random_bytes(16));
    $token = 'tnk_adm_' . base64_encode($tokenPayload);

    sendJson([
        'status' => 'SUCCESS',
        'message' => 'Login successful',
        'token' => $token,
        'user' => [
            'id' => $user['id'] ?? 1,
            'username' => $user['username'],
            'displayName' => $user['display_name'] ?? 'Super Admin',
            'role' => $user['role'] ?? 'Super Admin'
        ]
    ]);

} catch (Exception $e) {
    sendJson([
        'status' => 'ERROR',
        'error' => 'Server error: ' . $e->getMessage()
    ], 500);
}
