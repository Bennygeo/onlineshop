<?php
require_once __DIR__ . '/../config/db.php';

$pincode = getParam('pincode');

sendJson([
    'pincode' => $pincode,
    'zone' => 'Zone-1',
    'serviceable' => true
]);
