import { mock } from 'bun:test';

const ForceGraph = mock(() => ({
  graphData: mock().mockReturnThis(),
  nodeAutoColorBy: mock().mockReturnThis(),
  nodeCanvasObject: mock().mockReturnThis(),
  linkDirectionalParticles: mock().mockReturnThis(),
  linkDirectionalParticleSpeed: mock().mockReturnThis(),
  onNodeClick: mock().mockReturnThis(),
  onNodeHover: mock().mockReturnThis(),
  d3Force: mock().mockReturnThis(),
  d3AlphaDecay: mock().mockReturnThis(),
  d3VelocityDecay: mock().mockReturnThis(),
  warmupTicks: mock().mockReturnThis(),
  cooldownTicks: mock().mockReturnThis(),
  width: mock().mockReturnThis(),
  height: mock().mockReturnThis(),
  backgroundColor: mock().mockReturnThis(),
  nodeLabel: mock().mockReturnThis(),
  linkLabel: mock().mockReturnThis(),
  linkColor: mock().mockReturnThis(),
  linkWidth: mock().mockReturnThis(),
  nodeRelSize: mock().mockReturnThis(),
  refresh: mock(),
  zoom: mock(),
  centerAt: mock(),
}));

export default ForceGraph;
