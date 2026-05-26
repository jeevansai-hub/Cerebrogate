// dashboard.js
// In-memory telemetry for metrics
const stats = {
  total_requests: 0,
  cost_saved: 0.0,
  credits_used: 0.0,
  credits_left: 15.00, // Initial Credit Limit
  cache_hits: 0,
  total_response_time: 0,
  avg_response_time: 0,
  recent_requests: []
};

function logRequest({ cacheHit, duration, providersMap, costSaved }) {
  stats.total_requests++;
  if (cacheHit) stats.cache_hits++;
  stats.cost_saved += costSaved || 0;
  
  stats.total_response_time += duration;
  stats.avg_response_time = Math.round(stats.total_response_time / stats.total_requests);

  // Estimate credit transaction cost for demonstration
  let spent = cacheHit ? 0 : 0.015; // 1.5 cents per typical generation roughly
  if (providersMap && providersMap.length <= 1) spent = 0.002; // cheap chat
  
  stats.credits_used += spent;
  stats.credits_left = Math.max(0, stats.credits_left - spent);
  
  const complexity = (providersMap && providersMap.length > 1) ? "Mixed" : (providersMap && providersMap[0] ? providersMap[0].reason : "Unknown");
  const provider = (providersMap) ? providersMap.map(p => p.routed_to).join(', ') : 'Cache';

  stats.recent_requests.unshift({
    timestamp: new Date().toISOString(),
    complexity,
    provider,
    cache_hit: cacheHit,
    duration
  });

  if (stats.recent_requests.length > 10) {
    stats.recent_requests.pop();
  }
}

function getStats() {
  return stats;
}

module.exports = { logRequest, getStats };
