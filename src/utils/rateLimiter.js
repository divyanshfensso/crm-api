/**
 * In-memory rate limiter per API key
 * Tracks requests per hour using a simple Map
 */

const rateLimitMap = new Map();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Check if an API key has exceeded its rate limit
 * @param {number} apiKeyId - The API key ID
 * @param {number} limit - Max requests per hour
 * @returns {boolean} true if within limit, false if exceeded
 */
const checkRateLimit = (apiKeyId, limit) => {
  const key = `apikey:${apiKeyId}`;
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    // Start new window
    entry = {
      count: 1,
      resetAt: now + 60 * 60 * 1000, // 1 hour from now
    };
    rateLimitMap.set(key, entry);
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
};

/**
 * Get rate limit info for response headers
 * @param {number} apiKeyId - The API key ID
 * @param {number} limit - Max requests per hour
 * @returns {{ remaining: number, resetAt: number }}
 */
const getRateLimitInfo = (apiKeyId, limit) => {
  const key = `apikey:${apiKeyId}`;
  const entry = rateLimitMap.get(key);

  if (!entry) {
    return { remaining: limit, resetAt: Date.now() + 60 * 60 * 1000 };
  }

  return {
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
};

module.exports = { checkRateLimit, getRateLimitInfo };
