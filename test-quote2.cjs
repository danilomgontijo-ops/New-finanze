fetch('http://localhost:3000/api/brapi/quote/^BVSP?range=5y&interval=1mo')
  .then(r => r.json())
  .then(d => console.log('BVSP', d?.results?.[0]?.historicalData?.length))
  .catch(console.error);
