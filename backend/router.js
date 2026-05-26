// router.js — CerebroGate Multi-Provider Routing Engine
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

function scoreComplexity(text) {
  const t = text.trim().toLowerCase();
  const words = t.split(/\s+/);
  const wordCount = words.length;

  const heavySignals = [
    /\b(architecture|distributed|microservice|infrastructure|deployment|optimization|deep learning|neural|blockchain|algorithm|analysis|comprehensive|technical report)\b/i,
    /design.*(system|database|api|schema|approach)/i,
    /compare.*(framework|library|database|language|approach)/i,
    /\b(code|script|generate|build|program|application|app|website|software|implement|create a|make a|develop)\b/i
  ];

  const easySignals = [
    /^(hi|hello|hey|sup|yo|greetings|thanks|thank you|ok|okay|cool|nice|great|bye|goodbye|help)[!., ]?$/i,
    /^what(\'s| is) (your name|this|that|here|time|date)\??$/i,
    /^how (to|do I|are you)\??$/i,
    /^who is \w+\s?\w+\??$/i,
    /^capital of \w+\??$/i
  ];

  if (easySignals.some(r => r.test(t))) return 'easy';
  if (heavySignals.some(r => r.test(t))) return 'heavy';

  const mediumSignals = [
    /\b(explain|describe|what is|how does|why does|elaborate|example|demonstrate|show me|translate|summarize|write|list|tell me)\b/i
  ];
  if (mediumSignals.some(r => r.test(t))) return 'medium';

  if (wordCount <= 7) return 'easy';
  if (wordCount <= 30) return 'medium';
  return 'heavy';
}

// ─── Providers ──────────────────────────────────────────────────────────────

async function callOpenRouterWithKey(prompt, model, apiKey, providerLabel = 'OpenRouter') {
  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'CerebroGate'
      }
    });
    console.log(`✅ OpenRouter/(${providerLabel}) (${model}) responded successfully`);
    return { 
      content: response.data.choices[0]?.message?.content || '', 
      tokens: response.data.usage?.total_tokens || 0, 
      provider: providerLabel, 
      model 
    };
  } catch (err) {
    const errDetails = err.response?.data?.error?.message || err.message;
    console.error(`❌ OpenRouter/(${providerLabel}) (${model}) FAILED:`, errDetails?.slice(0, 150));
    throw err;
  }
}

async function callGroq(prompt, model = 'llama-3.1-8b-instant') {
  console.log(`>>> Groq starting: ${model}`);
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chat = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.5
    });
    console.log(`✅ Groq (${model}) responded successfully`);
    return { content: chat.choices[0]?.message?.content || '', tokens: chat.usage?.total_tokens || 0, provider: 'Groq', model };
  } catch (err) {
    console.error(`❌ Groq (${model}) FAILED:`, err.message?.slice(0, 150));
    throw err;
  }
}

async function callOpenAI(prompt, model = 'gpt-4o-mini') {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-or-v1-')) {
    // 2 AN ONE IS MiniMax: MiniMax M2.5 (free) -> map to minimax/minimax-m2.5:free
    return callOpenRouterWithKey(prompt, 'minimax/minimax-m2.5:free', process.env.OPENAI_API_KEY, 'OpenAI');
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const chat = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.5
    });
    console.log(`✅ OpenAI (${model}) responded successfully`);
    return { content: chat.choices[0]?.message?.content || '', tokens: chat.usage?.total_tokens || 0, provider: 'OpenAI', model };
  } catch (err) {
    console.error(`❌ OpenAI (${model}) FAILED:`, err.message?.slice(0, 150));
    throw err;
  }
}

async function callAnthropic(prompt, model = 'claude-3-5-sonnet-20240620') {
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-or-v1-')) {
    // 3RD ONE OpenAI: gpt-oss-120b (free) -> map to openai/gpt-oss-120b:free
    return callOpenRouterWithKey(prompt, 'openai/gpt-oss-120b:free', process.env.ANTHROPIC_API_KEY, 'Anthropic');
  }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    });
    console.log(`✅ Anthropic (${model}) responded successfully`);
    return { content: msg.content[0].text || '', tokens: msg.usage?.input_tokens + msg.usage?.output_tokens || 0, provider: 'Anthropic', model };
  } catch (err) {
    console.error(`❌ Anthropic (${model}) FAILED:`, err.message?.slice(0, 150));
    throw err;
  }
}

async function callGemini(prompt, retries = 2) {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('sk-or-v1-')) {
    // 1 ST ONE IS Google: Gemma 4 26B A4B (free) -> map to google/gemma-4-26b-a4b-it:free
    return callOpenRouterWithKey(prompt, 'google/gemma-4-26b-a4b-it:free', process.env.GEMINI_API_KEY, 'Gemini');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`✅ Gemini (gemini-2.0-flash) responded successfully on attempt ${attempt + 1}`);
      return { content: text, tokens: 0, provider: 'Gemini', model: 'gemini-2.0-flash' };
    } catch (err) {
      if (err.status === 429 && attempt < retries) {
        const waitSec = (attempt + 1) * 10;
        console.warn(`⏳ Gemini rate-limited (429), waiting ${waitSec}s...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      console.error(`❌ Gemini FAILED after ${attempt + 1} attempt(s):`, err.message?.slice(0, 150));
      throw err;
    }
  }
}

async function callOpenRouter(prompt, model = 'google/gemma-4-26b-a4b-it:free') {
  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'CerebroGate'
      }
    });
    console.log(`✅ OpenRouter (${model}) responded successfully`);
    return { content: response.data.choices[0]?.message?.content || '', tokens: response.data.usage?.total_tokens || 0, provider: 'OpenRouter', model };
  } catch (err) {
    console.error(`❌ OpenRouter (${model}) FAILED:`, err.message?.slice(0, 150));
    throw err;
  }
}

// ─── Internal Engine ─────────────────────────────────────────────────────────

async function withFallback(primaryFn, fallbacks, label = 'Req') {
  const start = Date.now();
  try {
    const res = await primaryFn();
    return { ...res, duration: Date.now() - start };
  } catch (err) {
    console.warn(`⚠️ [${label}] Primary failed, trying ${fallbacks.length} fallback(s)...`);
    for (let i = 0; i < fallbacks.length; i++) {
       try {
         const res = await fallbacks[i]();
         console.log(`🔄 [${label}] Fallback #${i + 1} succeeded`);
         return { ...res, duration: Date.now() - start };
       } catch (e) { continue; }
    }
    throw new Error('Fallback chain exhausted');
  }
}

// ─── Logic Handlers ──────────────────────────────────────────────────────────

async function handleBuildRequest(prompt) {
  // Use Anthropic (Claude 3.5 Sonnet) as primary build architect/coder if available
  const architecture = await withFallback(
    () => callAnthropic(`Architecture for: ${prompt}`),
    [() => callGemini(`Architecture for: ${prompt}`), () => callGroq(`Architecture for: ${prompt}`, 'llama-3.3-70b-versatile')],
    'Architecture'
  );
  
  const userPrompt = `Act as a professional full-stack developer and UI/UX designer. Ensure high quality React Code in a single HTML file using Babel and Tailwind CDNs. Prompt: ${prompt}`;

  const code = await withFallback(
    () => callAnthropic(userPrompt, 'claude-3-5-sonnet-20240620'),
    [() => callGemini(userPrompt), () => callOpenAI(userPrompt), () => callOpenRouter(userPrompt)],
    'Code'
  );
  
  const explanation = await withFallback(
     () => callGroq(`Explain app: ${prompt}`, 'llama-3.1-8b-instant'),
     [() => callOpenAI(`Explain: ${prompt}`)],
     'Explanation'
  );

  return { 
    type:'build', 
    architecture: architecture.content, 
    architecture_provider: architecture.provider,
    frontend_code: code.content, 
    code_provider: code.provider,
    explanation: explanation.content, 
    explanation_provider: explanation.provider,
    duration: architecture.duration + code.duration + explanation.duration 
  };
}

async function handleChat(messages, context = '') {
  const lastMsg = messages[messages.length - 1].content;
  const complexity = scoreComplexity(lastMsg);
  const prompt = context ? `Context: ${context}\nUser: ${lastMsg}` : lastMsg;
  console.log(`\n🧠 Routing ${complexity.toUpperCase()}: "${lastMsg.slice(0, 40)}..."`);

  let res;
  if (complexity === 'easy') {
    res = await withFallback(() => callGroq(prompt, 'llama-3.1-8b-instant'), [() => callOpenRouter(prompt)], 'Easy');
  } else if (complexity === 'medium') {
    res = await withFallback(() => callOpenAI(prompt), [() => callOpenRouter(prompt), () => callGemini(prompt)], 'Medium');
  } else {
    // HEAVY: Prioritize Anthropic (Claude 3.5 Sonnet)
    res = await withFallback(
      () => callAnthropic(prompt),
      [() => callGemini(prompt), () => callOpenRouter(prompt, 'google/gemma-2-27b-it'), () => callGroq(prompt, 'llama-3.3-70b-versatile')],
      'Heavy'
    );
  }

  return { type:'chat', content:res.content, provider:res.provider, model:res.model, complexity, duration: res.duration, tokens: res.tokens };
}

async function handleRefineRequest(messages) {
  // Format chat history
  const history = messages.slice(0, -1);
  const latestMessage = messages[messages.length - 1]?.content || '';
  
  let formattedChatHistory = history.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n');
  if (!formattedChatHistory) {
    formattedChatHistory = '(No chat history yet)';
  }

  const prompt = `You are an expert Context-Aware AI Refinement assistant. Your absolute priority is to analyze the user's initial intent alongside the ongoing conversation history to ensure the final output is 100% accurate, personalized, and free of irrelevant data.

Operating Procedure:
Analyze the CHAT HISTORY and the CURRENT USER INPUT. You must decide which state to execute and output the result in JSON format.

STATE 1: CLARIFY (No clarification has happened yet)
Look at the most recent user prompt. If this is a brand-new topic, or if the user's prompt is broad/ambiguous AND the history shows you have not yet asked a clarifying question for this specific topic, you MUST pause.
- Generate exactly ONE targeted, concise question to refine the context (e.g., asking for the tech stack, specific constraints, or target audience).
- Do not output the final answer yet.

STATE 2: ANSWER (Clarification received or prompt is already perfect)
If the CHAT HISTORY shows that you previously asked a clarifying question and the user has now provided their answer, or if the user's very first prompt is already perfectly detailed with zero ambiguity:
- Synthesize the entire conversation history.
- Generate the final, high-accuracy output.

[CHAT HISTORY]
${formattedChatHistory}

[CURRENT USER INPUT]
${latestMessage}

Respond ONLY with a valid JSON object containing "state", "question", and "response" properties. Do not wrap the JSON in markdown code blocks like \`\`\`json.
Example output format:
{"state": "CLARIFY", "question": "What programming language or framework would you prefer?", "response": null}`;

  console.log(`\n🧠 Evaluating refinement state for input: "${latestMessage.slice(0, 40)}..."`);
  // Call LLM with fallback
  const result = await withFallback(
    () => callGemini(prompt),
    [() => callOpenAI(prompt), () => callOpenRouter(prompt, 'google/gemma-4-26b-a4b-it:free')],
    'Refiner'
  );

  let data;
  try {
    let cleanContent = result.content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.substring(7);
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.substring(3);
    }
    if (cleanContent.endsWith('```')) {
      cleanContent = cleanContent.substring(0, cleanContent.length - 3);
    }
    cleanContent = cleanContent.trim();
    
    data = JSON.parse(cleanContent);
  } catch (err) {
    console.error('Failed to parse refiner JSON response:', result.content, err);
    data = {
      state: 'ANSWER',
      question: null,
      response: result.content
    };
  }

  return {
    state: data.state || 'ANSWER',
    question: data.question || null,
    response: data.response || null,
    provider: result.provider,
    model: result.model,
    duration: result.duration
  };
}

module.exports = { handleChat, handleBuildRequest, handleRefineRequest };
