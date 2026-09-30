<?php
require_once __DIR__ . '/../config/db.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['error' => 'Method not allowed'], 405);
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['image']['error'] ?? -1;
    $errMap = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit (php.ini)',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION  => 'Upload blocked by a PHP extension',
    ];
    sendJson(['error' => $errMap[$errCode] ?? 'Upload failed (code ' . $errCode . ')'], 400);
}

$file     = $_FILES['image'];
$tmpPath  = $file['tmp_name'];
$origName = basename($file['name']);
$size     = $file['size'];

// 5 MB max
if ($size > 5 * 1024 * 1024) {
    sendJson(['error' => 'File too large. Maximum allowed size is 5 MB.'], 400);
}

// Validate MIME using finfo (not just extension)
$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($tmpPath);
$allowed  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

if (!in_array($mimeType, $allowed)) {
    sendJson(['error' => 'Invalid file type. Allowed: JPG, PNG, WEBP, GIF.'], 400);
}

$extMap = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
];
$ext = $extMap[$mimeType];

// Build a safe, unique filename
$safeBase = preg_replace('/[^a-z0-9_\-]/i', '_', pathinfo($origName, PATHINFO_FILENAME));
$safeBase = substr($safeBase, 0, 60);
$filename = $safeBase . '_' . time() . '_' . rand(100, 999) . '.' . $ext;

// Resolve upload directory relative to this PHP file
// backend/admin/ → go up two levels → project root → assets/uploads/products/
$uploadDir = realpath(__DIR__ . '/../../') . '/assets/uploads/products/';

if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        sendJson(['error' => 'Could not create upload directory on server.'], 500);
    }
}

$destPath = $uploadDir . $filename;

if (!move_uploaded_file($tmpPath, $destPath)) {
    sendJson(['error' => 'Failed to save uploaded file. Check server write permissions.'], 500);
}

// Return the public URL path (relative to the Angular app root)
// $publicUrl = 'assets/uploads/products/' . $filename;
$publicUrl = '/uploads/products/' . $filename;

sendJson([
    'status'  => 'SUCCESS',
    'url'     => $publicUrl,
    'message' => 'Image uploaded successfully',
]);
