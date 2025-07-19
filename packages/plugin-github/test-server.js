import http from 'http';

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = req.url;
  const urlParams = new URL(url, `http://localhost:${PORT}`);

  if (url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Plugin GitHub Test Server</title>
</head>
<body>
    <h1>Plugin GitHub Test Server</h1>
    <div id="test-container">
        <p>This is a test server for GitHub plugin Cypress tests</p>
        <button id="repo-button">Get Repository</button>
        <button id="issues-button">Get Issues</button>
        <button id="pr-button">Get Pull Requests</button>
        <div id="repo-info"></div>
        <div id="issues-info"></div>
        <div id="pr-info"></div>
    </div>
    <script>
        document.getElementById('repo-button').addEventListener('click', function() {
            document.getElementById('repo-info').innerHTML = '<p>Repository: elizaos/eliza (1000 stars)</p>';
        });
        
        document.getElementById('issues-button').addEventListener('click', function() {
            document.getElementById('issues-info').innerHTML = '<p>Found 15 open issues</p>';
        });
        
        document.getElementById('pr-button').addEventListener('click', function() {
            document.getElementById('pr-info').innerHTML = '<p>Found 5 open pull requests</p>';
        });
    </script>
</body>
</html>
    `);
  } else if (url.startsWith('/api/repository')) {
    const agentId = urlParams.searchParams.get('agentId');
    const repo = urlParams.searchParams.get('repo') || 'elizaos/eliza';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          name: repo,
          stars: 1000,
          forks: 200,
          issues: 15,
          language: 'TypeScript',
          agentId,
        },
      })
    );
  } else if (url.startsWith('/api/issues')) {
    const agentId = urlParams.searchParams.get('agentId');
    const repo = urlParams.searchParams.get('repo') || 'elizaos/eliza';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          issues: [
            { id: 1, title: 'Bug in authentication', state: 'open', number: 123 },
            { id: 2, title: 'Feature request: new API', state: 'open', number: 124 },
          ],
          repo,
          agentId,
        },
      })
    );
  } else if (url.startsWith('/api/pulls')) {
    const agentId = urlParams.searchParams.get('agentId');
    const repo = urlParams.searchParams.get('repo') || 'elizaos/eliza';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          pulls: [
            { id: 1, title: 'Fix authentication bug', state: 'open', number: 50 },
            { id: 2, title: 'Add new feature', state: 'open', number: 51 },
          ],
          repo,
          agentId,
        },
      })
    );
  } else if (url.startsWith('/api/webhooks')) {
    const agentId = urlParams.searchParams.get('agentId');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          webhooks: [
            { id: 1, url: 'https://example.com/webhook', events: ['push', 'pull_request'] },
            { id: 2, url: 'https://example.com/webhook2', events: ['issues'] },
          ],
          agentId,
        },
      })
    );
  } else if (url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'plugin-github-test' }));
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>404 - Not Found</h1>');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GitHub test server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('GitHub test server shutting down...');
  server.close(() => {
    console.log('GitHub test server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('GitHub test server shutting down...');
  server.close(() => {
    console.log('GitHub test server stopped');
    process.exit(0);
  });
});
