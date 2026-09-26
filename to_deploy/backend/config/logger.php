<?php
/**
 * TomorrowNeeds Centralized Logger
 * Supports rotating daily file logging and structured database logging.
 */

class Logger {
    const DEBUG    = 'DEBUG';
    const INFO     = 'INFO';
    const WARN     = 'WARN';
    const ERROR    = 'ERROR';
    const CRITICAL = 'CRITICAL';

    private static $logDir = null;

    /**
     * Get or initialize the log directory
     */
    public static function getLogDir() {
        if (self::$logDir === null) {
            self::$logDir = __DIR__ . '/../logs';
            if (!is_dir(self::$logDir)) {
                @mkdir(self::$logDir, 0755, true);
            }
            $htaccess = self::$logDir . '/.htaccess';
            if (!file_exists($htaccess)) {
                @file_put_contents($htaccess, "Order deny,allow\nDeny from all\n");
            }
        }
        return self::$logDir;
    }

    /**
     * Write log entry
     */
    public static function log($level, $message, array $context = [], $source = 'backend') {
        try {
            $timestamp = date('Y-m-d H:i:s');
            $ip = self::getClientIp();
            $safeContext = self::sanitize($context);
            $contextStr = !empty($safeContext) ? ' | Context: ' . json_encode($safeContext, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : '';

            $fileLogLine = sprintf(
                "[%s] [%-8s] [%-8s] [%s] %s%s\n",
                $timestamp,
                strtoupper($level),
                strtoupper($source),
                $ip,
                $message,
                $contextStr
            );

            // 1. File Logging (Daily rotating file)
            $logFile = self::getLogDir() . '/app_' . date('Y-m-d') . '.log';
            @file_put_contents($logFile, $fileLogLine, FILE_APPEND | LOCK_EX);

            // 2. Database Logging for Warnings, Errors & Critical events
            if (in_array(strtoupper($level), [self::WARN, self::ERROR, self::CRITICAL])) {
                self::logToDb($level, $source, $message, $safeContext);
            }
        } catch (Throwable $e) {
            // Fail silently without disrupting user operations
            @error_log("Logger failure: " . $e->getMessage());
        }
    }

    public static function info($message, array $context = [], $source = 'backend') {
        self::log(self::INFO, $message, $context, $source);
    }

    public static function warn($message, array $context = [], $source = 'backend') {
        self::log(self::WARN, $message, $context, $source);
    }

    public static function error($message, array $context = [], $source = 'backend') {
        self::log(self::ERROR, $message, $context, $source);
    }

    public static function critical($message, array $context = [], $source = 'backend') {
        self::log(self::CRITICAL, $message, $context, $source);
    }

    /**
     * Log frontend client error telemetry
     */
    public static function clientError($message, array $payload = []) {
        self::log(self::ERROR, $message, $payload, 'frontend');
    }

    /**
     * Log to system_logs database table if connection is active
     */
    private static function logToDb($level, $source, $message, array $context = []) {
        global $pdo;
        if (!$pdo) return;

        try {
            $sql = "INSERT INTO system_logs (level, source, message, file, line, trace, url, user_info, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            $stmt = $pdo->prepare($sql);

            $file = $context['file'] ?? ($context['component'] ?? null);
            $line = isset($context['line']) ? intval($context['line']) : null;
            $trace = isset($context['trace']) ? (is_string($context['trace']) ? $context['trace'] : json_encode($context['trace'])) : null;
            $url = $context['url'] ?? ($_SERVER['REQUEST_URI'] ?? null);
            $userInfo = isset($context['user']) ? json_encode($context['user']) : (isset($context['mobile']) ? json_encode(['mobile' => $context['mobile']]) : null);

            $stmt->execute([
                strtoupper($level),
                $source,
                mb_substr($message, 0, 1000),
                $file ? mb_substr($file, 0, 255) : null,
                $line,
                $trace ? mb_substr($trace, 0, 5000) : null,
                $url ? mb_substr($url, 0, 500) : null,
                $userInfo ? mb_substr($userInfo, 0, 500) : null
            ]);
        } catch (Throwable $dbEx) {
            // If DB logging fails, file logging already caught it
        }
    }

    /**
     * Get client IP
     */
    private static function getClientIp() {
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) return $_SERVER['HTTP_CLIENT_IP'];
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    /**
     * Sanitize sensitive keys (passwords, card numbers, OTPs)
     */
    private static function sanitize($data) {
        if (!is_array($data)) return $data;
        $sensitiveKeys = ['password', 'pwd', 'otp', 'token', 'secret', 'card', 'cvv', 'auth', 'authorization'];
        $clean = [];
        foreach ($data as $key => $val) {
            $lowerKey = strtolower((string)$key);
            $isSensitive = false;
            foreach ($sensitiveKeys as $sKey) {
                if (str_contains($lowerKey, $sKey)) {
                    $isSensitive = true;
                    break;
                }
            }
            if ($isSensitive) {
                $clean[$key] = '***MASKED***';
            } elseif (is_array($val)) {
                $clean[$key] = self::sanitize($val);
            } else {
                $clean[$key] = $val;
            }
        }
        return $clean;
    }
}
