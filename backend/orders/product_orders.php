<?php
require_once __DIR__ . '/../config/db.php';

$targetProduct = getParam('targetProduct');
$productData = is_string($targetProduct) ? json_decode($targetProduct, true) : $targetProduct;

sendJson('SUCCESS');
