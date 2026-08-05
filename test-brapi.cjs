const https = require('https');
https.get('https://brapi.dev/api/quote/^BVSP', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('BVSP:', data));
});
https.get('https://brapi.dev/api/quote/IBOV', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('IBOV:', data));
});
