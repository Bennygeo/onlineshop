<?php
require_once __DIR__ . '/../config/db.php';

$ordersDetails = getParam('ordersDetails');
$details = is_string($ordersDetails) ? json_decode($ordersDetails, true) : $ordersDetails;

sendJson('SUCCESS');
