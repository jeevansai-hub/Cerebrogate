// scrubber.js
// Removes PII (emails, phone numbers, API keys) from strings
function scrubPII(text) {
  if (!text) return text;
  
  let scrubbed = text;
  
  // Scub Emails
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  scrubbed = scrubbed.replace(emailRegex, '[REDACTED_EMAIL]');
  
  // Scrub Phone numbers (basic format matching)
  const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g;
  scrubbed = scrubbed.replace(phoneRegex, '[REDACTED_PHONE]');
  
  // Scrub potential API keys (sk_live..., AIzaSy...)
  const apiKeyRegex = /(sk-[a-zA-Z0-9]{32,}|AIza[0-9A-Za-z-_]{35})/g;
  scrubbed = scrubbed.replace(apiKeyRegex, '[REDACTED_API_KEY]');
  
  return scrubbed;
}

module.exports = { scrubPII };
