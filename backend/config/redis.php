<?php
/**
 * Redis Cache Configuration - Futsal Manager
 * 
 * Provides a simple cache layer for frequently accessed database queries.
 * Falls back gracefully if Redis is unavailable.
 */

class RedisCache {
    private static $redis = null;
    private static $connected = false;
    private static $stats = ['hits' => 0, 'misses' => 0];

    /**
     * Get Redis connection (lazy initialization)
     */
    public static function getConnection() {
        if (self::$redis === null) {
            self::$redis = new Redis();
            try {
                self::$redis->connect('127.0.0.1', 6379, 1.0);
                self::$redis->setOption(Redis::OPT_SERIALIZER, Redis::SERIALIZER_NONE);
                self::$connected = true;
            } catch (Exception $e) {
                self::$connected = false;
                self::$redis = null;
                error_log("Redis connection failed: " . $e->getMessage());
            }
        }
        return self::$connected ? self::$redis : null;
    }

    /**
     * Get value from cache
     * @param string $key Cache key
     * @return mixed|null Cached value or null if not found/unavailable
     */
    public static function get($key) {
        $redis = self::getConnection();
        if (!$redis) {
            self::$stats['misses']++;
            return null;
        }
        
        try {
            $data = $redis->get($key);
            if ($data !== false) {
                self::$stats['hits']++;
                return json_decode($data, true);
            }
            self::$stats['misses']++;
            return null;
        } catch (Exception $e) {
            error_log("Redis GET error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Set value in cache
     * @param string $key Cache key
     * @param mixed $value Value to cache (will be JSON encoded)
     * @param int $ttl Time to live in seconds (default: 60)
     * @return bool Success
     */
    public static function set($key, $value, $ttl = 60) {
        $redis = self::getConnection();
        if (!$redis) return false;
        
        try {
            return $redis->setex($key, $ttl, json_encode($value));
        } catch (Exception $e) {
            error_log("Redis SET error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Delete a specific key
     * @param string $key Cache key
     * @return bool Success
     */
    public static function del($key) {
        $redis = self::getConnection();
        if (!$redis) return false;
        
        try {
            return $redis->del($key) >= 0;
        } catch (Exception $e) {
            error_log("Redis DEL error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Invalidate all keys matching a pattern
     * @param string $pattern Pattern (e.g., "tournaments:*")
     * @return int Number of keys deleted
     */
    public static function invalidate($pattern) {
        $redis = self::getConnection();
        if (!$redis) return 0;
        
        try {
            $keys = $redis->keys($pattern);
            if (!empty($keys)) {
                return $redis->del($keys);
            }
            return 0;
        } catch (Exception $e) {
            error_log("Redis INVALIDATE error: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Get cache statistics
     * @return array ['hits' => int, 'misses' => int, 'ratio' => float]
     */
    public static function getStats() {
        $total = self::$stats['hits'] + self::$stats['misses'];
        return [
            'hits' => self::$stats['hits'],
            'misses' => self::$stats['misses'],
            'ratio' => $total > 0 ? round(self::$stats['hits'] / $total * 100, 2) : 0
        ];
    }

    /**
     * Check if Redis is available
     * @return bool
     */
    public static function isAvailable() {
        return self::getConnection() !== null;
    }

    /**
     * Flush all cache (use with caution)
     * @return bool
     */
    public static function flush() {
        $redis = self::getConnection();
        if (!$redis) return false;
        
        try {
            return $redis->flushDB();
        } catch (Exception $e) {
            error_log("Redis FLUSH error: " . $e->getMessage());
            return false;
        }
    }
}
