import { redisClearKey, redisClearAll, redisGetAllKeys, redisGetAllKeysAndValues } from '../../redis.js'; // Import the Redis functions

// Function to clear cache for a specific key
const clearCacheByKey = async (req, res) => {
    const key = req.params.key;
    try {
      await redisClearKey(key);
      return res.json({ message: `Cache for key ${key} cleared` });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  
  // Function to clear all cache
  const clearAllCache = async (req, res) => {
    try {
      await redisClearAll();
      return res.json({ message: 'All cache cleared' });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  
  // Function to get all keys
  const getAllCacheKeys = async (req, res) => {
    try {
      const keys = await redisGetAllKeys();
      return res.json({ keys });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  const getAllCacheKeysAndValues = async (req, res) => {
    try {
      const keyValues = await redisGetAllKeysAndValues();
      return res.json({ keyValues });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  export { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues };