// assembler.js — Clean merger of pipeline outputs
function assembleResponse(segmentsData, routingMap, totalTokens, costSaved, isCacheHit) {
  const finalOutput = {
    architecture: '',
    architecture_provider: '',
    frontend_code: '',
    code_provider: '',
    explanation: '',
    explanation_provider: '',
    tokens_used: {
      gemini: totalTokens.gemini || 0,
      openrouter: totalTokens.openrouter || 0,
      groq: totalTokens.groq || 0
    },
    cost_saved: costSaved || '$0.000',
    cache_hit: isCacheHit,
    routing_map: routingMap
  };

  segmentsData.forEach((res) => {
    if (!res || !res.content) return;

    if (res.type === 'architecture') {
      finalOutput.architecture = res.content.trim();
      finalOutput.architecture_provider = res.provider || 'Gemini';
    }
    else if (res.type === 'code') {
      let html = res.content || '';

      // 1. Strip DeepSeek/reasoning <think>...</think> blocks
      html = html.replace(/<think>[\s\S]*?<\/think>/gi, '');

      // 2. Strip markdown code fences (```html ... ``` or ``` ... ```)
      html = html.replace(/^```[\w]*\s*/i, '').replace(/```\s*$/i, '');

      // 3. Extract just the HTML doc (ignore leading/trailing markdown)
      // We look for the first occurrence of doctype or html tag and the last </html>
      const startIdx = Math.max(
        html.toLowerCase().indexOf('<!doctype'),
        html.toLowerCase().indexOf('<html')
      );
      const endIdx = html.toLowerCase().lastIndexOf('</html>');

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        html = html.substring(startIdx, endIdx + 7);
      } else if (html.includes('<script') || html.includes('<div')) {
        // Fallback: If it's a code snippet but missing full tags, wrap it slightly
        // or just keep it as is if it looks like partial HTML
      } else {
        console.warn('⚠️ Assembler could not find valid HTML structure in code segment');
      }

      finalOutput.frontend_code = html.trim();
      finalOutput.code_provider = res.provider || 'OpenRouter';
    }
    else if (res.type === 'explanation') {
      finalOutput.explanation = res.content.trim();
      finalOutput.explanation_provider = res.provider || 'Groq';
    }
  });

  return finalOutput;
}

module.exports = { assembleResponse };
