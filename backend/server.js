const path = require('path');
// Load env FIRST before any other module reads process.env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');

const { scrubPII } = require('./scrubber');
const { handleBuildRequest, handleChat, handleRefineRequest } = require('./router');
const { assembleResponse } = require('./assembler');
const { logRequest, getStats } = require('./dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' })); // Increased for code contexts

// Static frontend serve
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate Limiter: Max 100 requests per IP per hour
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 100, 
  message: { error: 'Too many requests, try again later' }
});

app.post('/api/workspace_chat', limiter, async (req, res) => {
  try {
    const { messages, currentCodeContext, mode } = req.body;
    if (!messages || messages.length === 0) return res.status(400).json({ error: 'Messages required' });

    const lastMsgContent = scrubPII(messages[messages.length - 1].content);
    messages[messages.length - 1].content = lastMsgContent;

    const isBuild = mode === 'build' || lastMsgContent.trim().toLowerCase().startsWith('build');
    let chatResponse;

    if (isBuild) {
      try {
        const buildData = await handleBuildRequest(lastMsgContent);
        chatResponse = {
          type: 'build',
          pipelineData: {
            results: [
              { type: 'architecture', content: buildData.architecture, provider: buildData.architecture_provider },
              { type: 'code', content: buildData.frontend_code, provider: buildData.code_provider },
              { type: 'explanation', content: buildData.explanation, provider: buildData.explanation_provider }
            ],
            routingMap: [
              { segment: 'architecture', routed_to: buildData.architecture_provider, reason: 'build generation' },
              { segment: 'code', routed_to: buildData.code_provider, reason: 'build generation' },
              { segment: 'explanation', routed_to: buildData.explanation_provider, reason: 'build generation' }
            ],
            totalTokens: {},
            costSaved: '$0.005',
            isCacheHit: false,
            duration: buildData.duration
          }
        };
      } catch (buildErr) {
        console.error('🔥 Build Specific Error:', buildErr);
        return res.status(500).json({ error: 'Model failed during generation: ' + (buildErr.message || 'Check logs') });
      }
    } else {
      chatResponse = await handleChat(messages, currentCodeContext);
    }

    if (chatResponse.type === 'chat') {
       logRequest({
         cacheHit: false,
         duration: chatResponse.duration,
         providersMap: [{ segment: lastMsgContent.slice(0,40), routed_to: chatResponse.provider, reason: chatResponse.complexity || 'chat' }],
         costSaved: 0.002
       });
       res.json({
         mode: 'chat',
         message: chatResponse.content,
         provider: chatResponse.provider,
         model: chatResponse.model,
         complexity: chatResponse.complexity,
         tokens_used: chatResponse.tokens
       });
    } else if (chatResponse.type === 'build') {
       // Assembly logic for Build mode
       const pipelineData = chatResponse.pipelineData || {};
       
       const finalOutput = assembleResponse(
         pipelineData.results || [],
         pipelineData.routingMap || [],
         pipelineData.totalTokens || {},
         pipelineData.costSaved || '$0.000',
         pipelineData.isCacheHit || false
       );

       logRequest({
         cacheHit: !!pipelineData.isCacheHit,
         duration: pipelineData.duration || 0,
         providersMap: pipelineData.routingMap || [],
         costSaved: parseFloat((pipelineData.costSaved || '0').replace('$', '')) || 0
       });

       res.json({
         mode: 'build',
         message: "I have drafted the application architecture and generated the code across our API routers! Check the workspace preview.",
         pipelineData: pipelineData, // Keep for UI tracking
         build_data: finalOutput
       });
    }
  } catch (err) {
    console.error('Chat Error:', err);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

app.post('/api/refine', limiter, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || messages.length === 0) return res.status(400).json({ error: 'Messages required' });

    const lastMsgContent = scrubPII(messages[messages.length - 1].content);
    messages[messages.length - 1].content = lastMsgContent;

    const result = await handleRefineRequest(messages);
    
    logRequest({
      cacheHit: false,
      duration: result.duration,
      providersMap: [{ segment: lastMsgContent.slice(0, 40), routed_to: result.provider, reason: `Refine ${result.state}` }],
      costSaved: 0.001
    });

    res.json({
      state: result.state,
      question: result.question,
      response: result.response,
      provider: result.provider,
      model: result.model
    });
  } catch (err) {
    console.error('Refinement Endpoint Error:', err);
    res.status(500).json({ error: 'Failed to process refinement evaluation: ' + (err.message || 'Check logs') });
  }
});

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

app.post('/api/download_zip', (req, res) => {
  const { frontend_code, backend_code, architecture, explanation } = req.body;

  res.attachment('cerebrogate_app.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', function(err) {
      res.status(500).send({error: err.message});
  });

  archive.pipe(res);

  if(frontend_code) archive.append(frontend_code, { name: 'app/frontend/app.js' });
  if(backend_code) archive.append(backend_code, { name: 'app/backend/server.js' });
  if(architecture) archive.append(architecture, { name: 'docs/architecture.md' });
  if(explanation) archive.append(explanation, { name: 'docs/explanation.md' });

  archive.finalize();
});

process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`CerebroGate backend running on http://localhost:${PORT}`);
});
