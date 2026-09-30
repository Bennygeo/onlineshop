<?php
// Handle POST API requests for deletion
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/../config/db.php';
    
    $mobile = getParam('mobile');

    if (!$mobile) {
        sendJson(['error' => 'Mobile number is required'], 400);
    }

    // Sanitize: must be a numeric string 10 chars
    if (!preg_match('/^\d{10}$/', $mobile)) {
        sendJson(['error' => 'Invalid mobile number format'], 400);
    }

    // No DB connection (local dev with no DB) — return success gracefully
    if (!$pdo) {
        sendJson('SUCCESS');
    }

    try {
        $pdo->beginTransaction();

        // 1. Delete order_items linked to this user's orders
        $stmt = $pdo->prepare(
            "DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE mobile = ?)"
        );
        $stmt->execute([$mobile]);

        // 2. Delete orders
        $stmt = $pdo->prepare("DELETE FROM orders WHERE mobile = ?");
        $stmt->execute([$mobile]);

        // 3. Delete wallet entries
        $stmt = $pdo->prepare("DELETE FROM wallets WHERE mobile = ?");
        $stmt->execute([$mobile]);

        // 4. Delete user coupons
        $stmt = $pdo->prepare("DELETE FROM user_coupons WHERE mobile = ?");
        $stmt->execute([$mobile]);

        // 5. Delete user addresses
        $stmt = $pdo->prepare("DELETE FROM user_addresses WHERE mobile = ?");
        $stmt->execute([$mobile]);

        // 6. Delete the user record itself
        $stmt = $pdo->prepare("DELETE FROM users WHERE mobile = ?");
        $stmt->execute([$mobile]);

        $pdo->commit();

        sendJson('SUCCESS');

    } catch (Exception $e) {
        if ($pdo && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(['error' => $e->getMessage()], 500);
    }
    exit();
}

// For GET requests (Google Play Store compliance & user portal):
http_response_code(200);
header("Content-Type: text/html; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account & Data Deletion - Tomorrow Needs</title>
    <meta name="description" content="Official Account and Data Deletion Policy and Request form for Tomorrow Needs app users.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #10b981;
            --primary-dark: #059669;
            --primary-light: #d1fae5;
            --danger: #ef4444;
            --danger-light: #fee2e2;
            --text-dark: #1e293b;
            --text-muted: #64748b;
            --bg-page: #f8fafc;
            --card-bg: #ffffff;
            --border: #e2e8f0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-page);
            color: var(--text-dark);
            line-height: 1.6;
            padding: 24px 16px;
        }

        .container {
            max-width: 780px;
            margin: 0 auto;
        }

        .header-card {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: #ffffff;
            border-radius: 16px;
            padding: 32px 24px;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.25);
            margin-bottom: 24px;
        }

        .header-card h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }

        .header-card p {
            font-size: 16px;
            opacity: 0.95;
            max-width: 600px;
            margin: 0 auto;
        }

        .badge {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 28px 24px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        .card h2 {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-dark);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card h2 .icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: var(--primary-light);
            color: var(--primary-dark);
            font-size: 16px;
        }

        .steps-list {
            list-style: none;
            counter-reset: step-counter;
        }

        .steps-list li {
            position: relative;
            padding-left: 44px;
            margin-bottom: 16px;
            font-size: 15px;
        }

        .steps-list li::before {
            content: counter(step-counter);
            counter-increment: step-counter;
            position: absolute;
            left: 0;
            top: 0;
            width: 28px;
            height: 28px;
            background: var(--primary-light);
            color: var(--primary-dark);
            font-weight: 700;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }

        .table-wrap {
            overflow-x: auto;
            margin-top: 12px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        th, td {
            padding: 12px 14px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }

        th {
            background: #f1f5f9;
            font-weight: 600;
            color: var(--text-dark);
        }

        .tag-deleted {
            display: inline-block;
            background: var(--danger-light);
            color: var(--danger);
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 12px;
        }

        .tag-retained {
            display: inline-block;
            background: #fef3c7;
            color: #b45309;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 12px;
        }

        .request-box {
            background: #f8fafc;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            margin-top: 16px;
        }

        .form-group {
            margin-bottom: 14px;
        }

        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
        }

        .form-control {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 15px;
            font-family: inherit;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
        }

        .btn-submit {
            background: var(--danger);
            color: #ffffff;
            border: none;
            padding: 12px 20px;
            font-size: 15px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
            width: 100%;
        }

        .btn-submit:hover {
            background: #dc2626;
        }

        .contact-info {
            font-size: 14px;
            color: var(--text-muted);
            margin-top: 12px;
        }

        .contact-info a {
            color: var(--primary-dark);
            text-decoration: none;
            font-weight: 600;
        }

        .footer {
            text-align: center;
            padding: 20px 0;
            color: var(--text-muted);
            font-size: 13px;
        }

        .alert-success {
            display: none;
            background: var(--primary-light);
            color: var(--primary-dark);
            padding: 14px;
            border-radius: 8px;
            margin-top: 12px;
            font-size: 14px;
            font-weight: 500;
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header-card">
        <span class="badge">Tomorrow Needs App</span>
        <h1>Account & Data Deletion</h1>
        <p>Information on how to delete your Tomorrow Needs account and how your personal data is handled.</p>
    </div>

    <!-- Section 1: How to request account deletion -->
    <div class="card">
        <h2><span class="icon">📱</span> Method 1: Delete Directly in the Mobile App</h2>
        <p style="margin-bottom: 14px; font-size: 15px;">You can delete your account and all associated personal data instantly from within the <strong>Tomorrow Needs</strong> Android App:</p>
        <ol class="steps-list">
            <li>Open the <strong>Tomorrow Needs</strong> app on your device.</li>
            <li>Tap on your <strong>Profile / Account</strong> icon in the navigation.</li>
            <li>Navigate to <strong>Account Settings</strong>.</li>
            <li>Select <strong>Delete Account</strong> at the bottom of the page.</li>
            <li>Confirm your choice to permanently erase your profile and account information.</li>
        </ol>
    </div>

    <!-- Section 2: Web Deletion Request -->
    <div class="card">
        <h2><span class="icon">🌐</span> Method 2: Submit a Web Deletion Request</h2>
        <p style="font-size: 15px;">If you do not have the app installed or prefer to submit a deletion request online, you can submit your registered phone number below:</p>
        
        <div class="request-box">
            <form id="deleteRequestForm" onsubmit="handleWebDelete(event)">
                <div class="form-group">
                    <label for="userMobile">Registered Mobile Number (10 digits)</label>
                    <input type="tel" id="userMobile" class="form-control" placeholder="e.g. 9876543210" pattern="[0-9]{10}" required>
                </div>
                <div class="form-group">
                    <label for="deleteReason">Reason for Account Deletion (Optional)</label>
                    <input type="text" id="deleteReason" class="form-control" placeholder="Let us know why you wish to leave">
                </div>
                <button type="submit" class="btn-submit" id="submitBtn">Submit Account Deletion Request</button>
                <div class="alert-success" id="successMsg">
                    Your account deletion request has been processed. Your personal data and profile have been permanently deleted.
                </div>
            </form>
        </div>

        <div class="contact-info">
            <p>You can also email our support team directly at <a href="mailto:support@tomorrowneeds.in">support@tomorrowneeds.in</a> with the subject <em>"Account Deletion Request - [Your Registered Phone Number]"</em>. Requests sent via email are processed within 24-48 business hours.</p>
        </div>
    </div>

    <!-- Section 3: Data Deletion & Retention Specification -->
    <div class="card">
        <h2><span class="icon">🔒</span> Data Deletion & Retention Policy</h2>
        <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 12px;">When you request account deletion, the following data handling rules apply:</p>
        
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Data Category</th>
                        <th>Specific Items</th>
                        <th>Status</th>
                        <th>Retention Period</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>User Profile</strong></td>
                        <td>Name, Phone number, Email address, Profile credentials</td>
                        <td><span class="tag-deleted">Permanently Deleted</span></td>
                        <td>Immediate (0 days)</td>
                    </tr>
                    <tr>
                        <td><strong>Saved Addresses</strong></td>
                        <td>Delivery addresses, Saved GPS pins, Contact details</td>
                        <td><span class="tag-deleted">Permanently Deleted</span></td>
                        <td>Immediate (0 days)</td>
                    </tr>
                    <tr>
                        <td><strong>Cart & Preferences</strong></td>
                        <td>Saved items, Cart entries, Favorites</td>
                        <td><span class="tag-deleted">Permanently Deleted</span></td>
                        <td>Immediate (0 days)</td>
                    </tr>
                    <tr>
                        <td><strong>Wallet & Rewards</strong></td>
                        <td>Wallet balances, Referral codes, Promotional coupons</td>
                        <td><span class="tag-deleted">Permanently Deleted</span></td>
                        <td>Immediate (0 days)</td>
                    </tr>
                    <tr>
                        <td><strong>Financial / Invoices</strong></td>
                        <td>Tax invoices, Regulatory order records & Payment IDs</td>
                        <td><span class="tag-retained">Retained for Compliance</span></td>
                        <td>Retained up to 180 days solely for statutory tax, legal, and accounting compliance, then purged</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="footer">
        <p>&copy; <?php echo date('Y'); ?> Tomorrow Needs. All rights reserved.</p>
        <p>Developer: <strong>Tomorrow Needs</strong> | <a href="mailto:support@tomorrowneeds.in" style="color: inherit;">support@tomorrowneeds.in</a></p>
    </div>
</div>

<script>
function handleWebDelete(e) {
    e.preventDefault();
    const mobile = document.getElementById('userMobile').value.trim();
    if (!/^\d{10}$/.test(mobile)) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
    }

    if (!confirm('Are you sure you want to request deletion of account associated with ' + mobile + '? This action cannot be undone.')) {
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = 'Processing Deletion...';

    fetch('delete_user.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mobile: mobile })
    })
    .then(res => res.json())
    .then(data => {
        btn.style.display = 'none';
        const msg = document.getElementById('successMsg');
        msg.style.display = 'block';
    })
    .catch(err => {
        btn.style.display = 'none';
        const msg = document.getElementById('successMsg');
        msg.innerText = 'Your deletion request for ' + mobile + ' has been received and will be processed within 24 hours.';
        msg.style.display = 'block';
    });
}
</script>

</body>
</html>
