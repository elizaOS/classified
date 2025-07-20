const { spawn } = require('child_process');
const path = require('path');

// Start the test server
const testServer = require('./support/test-server.cjs');

const server = testServer.listen(7777, () => {
  console.log('Test server started on http://localhost:7777');

  // Run Cypress after server starts
  const cypressArgs = process.argv.slice(2);
  const cypressCmd = cypressArgs.includes('open') ? 'open' : 'run';

  console.log(`Running cypress ${cypressCmd}...`);

  const cypress = spawn('npx', ['cypress', cypressCmd, ...cypressArgs], {
    stdio: 'inherit',
    shell: true,
  });

  cypress.on('close', (code) => {
    console.log(`Cypress exited with code ${code}`);
    console.log('Stopping test server...');
    server.close(() => {
      process.exit(code);
    });
  });

  cypress.on('error', (err) => {
    console.error('Failed to start Cypress:', err);
    server.close(() => {
      process.exit(1);
    });
  });
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down test server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down test server...');
  server.close(() => {
    process.exit(0);
  });
});
