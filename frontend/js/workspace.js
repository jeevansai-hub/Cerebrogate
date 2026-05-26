let chatHistoryData = [];
let currentCodeContext = ''; // Holds the current code so the LLM has it for modifications

function switchTab(tabId) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  // Update content
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
}

function addChatBubble(text, role) {
  const historyDiv = document.getElementById('chatHistory');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-${role === 'user' ? 'user' : 'ai'}`;
  
  // Basic markdown-like link/bold parser if needed, or simple text:
  bubble.innerText = text;
  
  historyDiv.appendChild(bubble);
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

document.getElementById('sendBtn').addEventListener('click', async () => {
   const inputEl = document.getElementById('chatInput');
   const text = inputEl.value.trim();
   if(!text) return;
   
   // Add user message
   addChatBubble(text, 'user');
   chatHistoryData.push({ role: 'user', content: text });
   inputEl.value = '';
   
   // Disable input
   const sendBtn = document.getElementById('sendBtn');
   sendBtn.disabled = true;
   sendBtn.innerText = '...';

   try {
     const response = await fetch('/api/workspace_chat', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ 
         messages: chatHistoryData,
         currentCodeContext: currentCodeContext 
       })
     });

     if (!response.ok) {
       const errData = await response.json().catch(() => ({}));
       const errMsg = errData.error || `Server error: ${response.status}`;
       addChatBubble(`⚠️ Error: ${errMsg}`, 'ai');
       sendBtn.disabled = false;
       sendBtn.innerText = 'Send';
       return;
     }

     const data = await response.json();

     if (data.error) {
       addChatBubble(`⚠️ Error: ${data.error}`, 'ai');
       sendBtn.disabled = false;
       sendBtn.innerText = 'Send';
       return;
     }

     if(data.mode === 'chat') {
        // Pure conversation
        chatHistoryData.push({ role: 'assistant', content: data.message });
        addChatBubble(data.message, 'ai');
     } 
     else if (data.mode === 'build') {
        // Build or modification returned
        chatHistoryData.push({ role: 'assistant', content: data.message });
        addChatBubble(data.message, 'ai');

        const bd = data.build_data;

        // 1. Clean HTML code (strip markdown blocks if present)
        let rawHtml = bd.frontend_code || '';
        rawHtml = rawHtml.replace(/```html/gi, '').replace(/```javascript/gi, '').replace(/```css/gi, '').replace(/```/g, '').trim();

        // Remove the hardcoded comments our assembler added if any are polluting HTML structure at the very top:
        rawHtml = rawHtml.replace(/^\/\/ Generated via.*\n/g, '');

        currentCodeContext = rawHtml; // Save context for future edits

        // 2. Inject into iframe
        const frame = document.getElementById('previewFrame');
        document.getElementById('previewEmpty').style.display = 'none';
        frame.srcdoc = rawHtml;

        // 3. Populate Code UI Tabs
        document.getElementById('codeViewer').innerText = rawHtml;
        document.getElementById('archViewer').innerText = bd.architecture || '';
     }
   } catch(e) {
     console.error(e);
     addChatBubble("Sorry, an error occurred communicating with the Gateway.", "ai");
   }

   sendBtn.disabled = false;
   sendBtn.innerText = 'Send';
});
