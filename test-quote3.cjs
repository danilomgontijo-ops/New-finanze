fetch('http://localhost:3000/api/brapi/quote/^BVSP?range=5y&interval=1mo')
  .then(r => r.json())
  .then(d => console.log('BVSP keys', Object.keys(d.results[0])))
  .catch(console.error);
