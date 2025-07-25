// Simple health check for Docker
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/api/healthcheck',
  timeout: 2000
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode == 200) {
    process.exit(0);
  }
  else {
    process.exit(1);
  }
});

request.on('error', function(err) {
  console.log('ERROR');
  process.exit(1);
});

request.end();