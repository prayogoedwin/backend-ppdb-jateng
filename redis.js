import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const redisClient = createClient({
  // socket: { connectTimeout: 10000 } // Tambah timeout
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.connect();

/**
 * Get value from Redis
 * @param {string} key - The key to retrieve from Redis
 * @returns {Promise<string|null>} - The value associated with the key, or null if the key does not exist
 */
const redisGet = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value;
  } catch (error) {
    console.error('Error getting value from Redis:', error);
    throw error;
  }
};

/**
 * Set value in Redis
 * @param {string} key - The key to set in Redis
 * @param {string} value - The value to set in Redis
 * @param {number} [expiration] - Optional expiration time in seconds
 * @returns {Promise<void>}
 */
const redisSet = async (key, value, expiration = 3600) => {
  try {
    await redisClient.set(key, value, { EX: expiration });
  } catch (error) {
    console.error('Error setting value in Redis:', error);
    throw error;
  }
};


// redis.js
const redisClearKey = async (key) => {
  try {
    const result = await redisClient.del(key);
    console.log(`Deleted key: ${key}, result: ${result}`);
    return result;
  } catch (error) {
    console.error('Error deleting key from Redis:', error);
    throw error;
  }
};

// Function to clear all keys from Redis
const redisClearAll = async () => {
  try {
    await redisClient.flushAll();
  } catch (error) {
    console.error('Error clearing all keys from Redis:', error);
    throw error;
  }
};


// Function to get all keys from Redis
const redisGetAllKeys = async () => {
  try {
    const keys = await redisClient.keys('*');
    return keys;
  } catch (error) {
    console.error('Error getting all keys from Redis:', error);
    throw error;
  }
};

const redisGetAllKeysAndValues = async () => {
  try {
    const keys = await redisClient.keys('*');
    const keyValues = {};
    for (const key of keys) {
      const value = await redisClient.get(key);
      keyValues[key] = value;
    }
    return keyValues;
  } catch (error) {
    console.error('Error getting all keys and values from Redis:', error);
    throw error;
  }
};

export { redisGet, redisSet, redisClearKey, redisClearAll, redisGetAllKeys, redisGetAllKeysAndValues };
