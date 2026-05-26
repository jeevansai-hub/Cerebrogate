// compressor.js
// Removes filler words to reduce token count
function compressPrompt(text) {
  if (!text) return text;
  
  const fillerWords = [
    "please", "can you", "could you", "help me", "i want to", "i would like to",
    "just", "basically", "actually", "i mean", "you know", "kind of", "sort of",
    "to be honest", "obviously", "clearly"
  ];

  let compressed = text;
  fillerWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b\\s*`, 'gi');
    compressed = compressed.replace(regex, '');
  });
  
  compressed = compressed.replace(/\s{2,}/g, ' ').trim();
  
  return compressed;
}

module.exports = { compressPrompt };
