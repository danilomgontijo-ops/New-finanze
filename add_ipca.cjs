const fs = require('fs');
let code = fs.readFileSync('services/brapiService.ts', 'utf8');

const ipcaFunction = `
  fetchIpcaHistory: async (): Promise<{ date: string, value: number }[]> => {
      try {
          // BCB SGS Serie 433 (IPCA mensal)
          const response = await fetch('/api/bcb/ipca');
          if (!response.ok) return [];
          const data = await response.json();
          return data.map((d: any) => {
             // data is in DD/MM/YYYY
             const parts = d.data.split('/');
             return {
                 date: \`\${parts[2]}-\${parts[1]}-\${parts[0]}\`,
                 value: parseFloat(d.valor)
             };
          });
      } catch (e) {
          console.error("Erro fetchIpcaHistory BCB:", e);
          return [];
      }
  },
`;

code = code.replace(/fetchCdiHistory: async \(\): Promise<\{ date: string, value: number \}\[\]> => \{/, ipcaFunction + '\n  fetchCdiHistory: async (): Promise<{ date: string, value: number }[]> => {');
fs.writeFileSync('services/brapiService.ts', code, 'utf8');
console.log('Added fetchIpcaHistory');
