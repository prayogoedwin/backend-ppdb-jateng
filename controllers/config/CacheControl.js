import { redisClearKey, redisClearAll, redisGetAllKeys, redisGetAllKeysAndValues, redisClearByPrefix } from '../../redis.js'; // Import the Redis functions

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

  // Function to clear cache for a specific key / untuk di konsumsi fungsi private
  const clearCacheByKeyFunction = async (key) => {
    try {
        await redisClearKey(key);
        return { message: `Cache for key ${key} cleared` };
    } catch (error) {
        console.error('Error:', error);
        throw new Error('Internal Server Error');
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

  // Function to clear cache by prefix
const clearCacheByPrefix = async (req, res) => {
  const { prefix } = req.body; // Ambil prefix dari body request
  
  if (!prefix) {
    return res.status(400).json({ error: 'Prefix parameter is required' });
  }

  try {
    const deletedCount = await redisClearByPrefix(prefix);
    return res.json({ 
      message: `Cache cleared for keys with prefix: ${prefix}`,
      deletedCount 
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Function to clear cache by prefix (untuk konsumsi internal)
const clearCacheByPrefixFunction = async (prefix) => {
  try {
    const deletedCount = await redisClearByPrefix(prefix);
    return { 
      message: `Cache cleared for keys with prefix: ${prefix}`,
      deletedCount 
    };
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Internal Server Error');
  }
};


  export { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues, 
    clearCacheByKeyFunction, clearCacheByPrefix,
    clearCacheByPrefixFunction  };