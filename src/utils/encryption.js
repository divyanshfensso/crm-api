const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get encryption key from environment (hashed to 32 bytes)
 */
const getKey = () => {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  return crypto.createHash('sha256').update(raw).digest();
};

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} text - Plaintext to encrypt
 * @returns {string|null} Encrypted text as base64 (iv:tag:ciphertext)
 */
const encrypt = (text) => {
  if (!text) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
};

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Encrypted text (iv:tag:ciphertext format)
 * @returns {string|null} Decrypted plaintext
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  const key = getKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = { encrypt, decrypt };
