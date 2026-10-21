fetch('http://localhost:3000/api/brapi/quote/IBOV')
  .then(r => r.json())
  .then(d => console.log('IBOV', d))
  .catch(console.error);
fetch('http://localhost:3000/api/brapi/quote/^BVSP')
  .then(r => r.json())
  .then(d => console.log('BVSP', d))
  .catch(console.error);
