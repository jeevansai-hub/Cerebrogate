document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const promptInput = document.getElementById('promptInput');
  const pipelineDiagram = document.getElementById('pipelineDiagram');
  const statusMessage = document.getElementById('statusMessage');

  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Show pipeline animation
    pipelineDiagram.style.display = 'flex';
    generateBtn.disabled = true;
    generateBtn.style.opacity = '0.5';
    
    statusMessage.innerText = 'Routing prompt segments and generating code...';

    try {
      const response = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      
      // Store result in sessionStorage so output page can pick it up
      sessionStorage.setItem('cerebrogate_output', JSON.stringify(rawData));
      
      // Redirect to output page
      window.location.href = 'output.html';

    } catch (e) {
      console.error(e);
      statusMessage.innerText = 'Error generating app. Check console.';
      generateBtn.disabled = false;
      generateBtn.style.opacity = '1';
      pipelineDiagram.style.display = 'none';
    }
  });
});
