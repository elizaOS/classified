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

  if (url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Plugin Rolodex Test Server</title>
</head>
<body>
    <h1>Plugin Rolodex Test Server</h1>
    <div id="test-container">
        <p>This is a test server for Rolodex plugin Cypress tests</p>
        <button id="contacts-button">Show Contacts</button>
        <div id="contacts-list"></div>
    </div>
    <script>
        document.getElementById('contacts-button').addEventListener('click', function() {
            document.getElementById('contacts-list').innerHTML = '<p>Contact list would go here</p>';
        });
    </script>
</body>
</html>
    `);
  } else if (url === '/test-components') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Rolodex Test Components</title>
</head>
<body>
    <h2>RolodexTab Component</h2>
    <div id="rolodex-container">
        <p>Rolodex component would be rendered here</p>
        <button id="add-contact">Add Contact</button>
        <div id="contact-form" style="display:none;">
            <input type="text" id="contact-name" placeholder="Contact Name" />
            <button id="save-contact">Save</button>
        </div>
    </div>
    <script>
        document.getElementById('add-contact').addEventListener('click', function() {
            document.getElementById('contact-form').style.display = 'block';
        });
        document.getElementById('save-contact').addEventListener('click', function() {
            const name = document.getElementById('contact-name').value;
            if (name) {
                alert('Contact ' + name + ' saved!');
                document.getElementById('contact-form').style.display = 'none';
            }
        });
    </script>
</body>
</html>
    `);
  } else if (url.startsWith('/api/contacts')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          contacts: [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
          ],
        },
      })
    );
  } else if (url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'plugin-rolodex-test' }));
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>404 - Not Found</h1>');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Rolodex test server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Rolodex test server shutting down...');
  server.close(() => {
    console.log('Rolodex test server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Rolodex test server shutting down...');
  server.close(() => {
    console.log('Rolodex test server stopped');
    process.exit(0);
  });
});
