document.addEventListener('DOMContentLoaded', () => {
  const dataStr = sessionStorage.getItem('cerebrogate_output');
  if(!dataStr) {
    document.querySelector('.output-container').innerHTML = '<p>No generation result found. Please go back to the app and generate first.</p>';
    return;
  }
  const data = JSON.parse(dataStr);

  // Populate Summary
  document.getElementById('valCacheHit').innerText = data.cache_hit ? "Yes" : "No";
  document.getElementById('valCostSaved').innerText = data.cost_saved || "$0.000";
  const rmList = document.getElementById('routingMapList');
  if (data.routing_map && data.routing_map.length > 0) {
      data.routing_map.forEach(item => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${item.routed_to}</strong> (${item.reason}): <span style="color:var(--text-main)">"${item.segment}"</span>`;
          rmList.appendChild(li);
      });
  } else {
     rmList.innerHTML = "<li>No routing map provided.</li>";
  }

  // Populate Content
  document.getElementById('architectureContent').innerText = data.architecture || 'No architecture generated.';
  document.getElementById('frontCode').innerText = data.frontend_code || '// No frontend code generated';
  document.getElementById('backCode').innerText = data.backend_code || '// No backend code generated';
  document.getElementById('explanationContent').innerText = data.explanation || 'No explanation generated.';

  if (document.getElementById('badgeArch')) document.getElementById('badgeArch').innerText = data.architecture_provider || 'Gemini';
  if (document.getElementById('badgeFront')) document.getElementById('badgeFront').innerText = data.code_provider || 'OpenRouter';
  if (document.getElementById('badgeBack')) document.getElementById('badgeBack').innerText = data.code_provider || 'OpenRouter';
  if (document.getElementById('badgeExp')) document.getElementById('badgeExp').innerText = data.explanation_provider || 'Groq';

  // Download ZIP
  document.getElementById('downloadZipBtn').addEventListener('click', async () => {
    try {
      const response = await fetch('http://localhost:3000/api/download_zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontend_code: data.frontend_code,
          backend_code: data.backend_code,
          architecture: data.architecture,
          explanation: data.explanation
        })
      });
      
      if (!response.ok) throw new Error('Network response was not ok');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = 'cerebrogate_app.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch(e) {
      console.error(e);
      alert('Error creating ZIP file');
    }
  });

});

// Global copy function
window.copyCode = function(id) {
  const code = document.getElementById(id).innerText;
  navigator.clipboard.writeText(code).then(() => {
    // visual feedback could go here
  });
}
