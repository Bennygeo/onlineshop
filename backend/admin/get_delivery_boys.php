<?php
require_once __DIR__ . '/../config/db.php';

$deliveryBoys = [
    [
        'id' => 'DB001',
        'name' => 'Karthik Raja',
        'mobile' => '9842100001',
        'vehicle' => 'TN-37-AB-1234',
        'zone' => 'Zone 1',
        'status' => 'Available',
        'activeOrders' => 2
    ],
    [
        'id' => 'DB002',
        'name' => 'Suresh Kumar',
        'mobile' => '9842100002',
        'vehicle' => 'TN-38-CD-5678',
        'zone' => 'Zone 2',
        'status' => 'On Delivery',
        'activeOrders' => 4
    ],
    [
        'id' => 'DB003',
        'name' => 'Manikandan P',
        'mobile' => '9842100003',
        'vehicle' => 'TN-37-EF-9012',
        'zone' => 'Zone 1',
        'status' => 'Available',
        'activeOrders' => 0
    ],
    [
        'id' => 'DB004',
        'name' => 'Vignesh M',
        'mobile' => '9842100004',
        'vehicle' => 'TN-37-GH-3456',
        'zone' => 'Zone 2',
        'status' => 'Available',
        'activeOrders' => 1
    ]
];

sendJson($deliveryBoys);
