const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const ipcaRoute = `
  app.get("/api/bcb/ipca", async (req, res) => {
    try {
      const url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json";
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch from BCB" });
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
`;

code = code.replace(/app\.get\("\/api\/bcb\/ptax", async \(req, res\) => \{/, ipcaRoute + '\n  app.get("/api/bcb/ptax", async (req, res) => {');
fs.writeFileSync('server.ts', code, 'utf8');
console.log('Added IPCA route');
