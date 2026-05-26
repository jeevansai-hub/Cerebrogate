// cache.js — Exact SHA-256 hash based semantic cache (no false positives)
const crypto = require('crypto');

const cacheStorage = new Map(); // hash → { response, timestamp, provider, tokens }

function hashPrompt(text) {
  // Normalize: lowercase, collapse whitespace, trim
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function checkCache(promptText) {
  const hash = hashPrompt(promptText);
  const entry = cacheStorage.get(hash);
  if (!entry) return null;

  // Expire after 24 hours
  if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
    cacheStorage.delete(hash);
    return null;
  }

  return entry;
}

function saveToCache(promptText, responseData, provider, tokens) {
  const hash = hashPrompt(promptText);
  cacheStorage.set(hash, {
    timestamp: Date.now(),
    response: responseData,
    provider,
    tokens
  });
}

function getCacheSize() {
  return cacheStorage.size;
}

module.exports = { checkCache, saveToCache, getCacheSize };
