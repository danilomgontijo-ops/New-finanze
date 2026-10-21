const fs = require('fs');
const content = fs.readFileSync('components/Investments.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Object.keys') || line.includes('Object.values') || line.includes('Object.entries')) {
    console.log((i+1) + ": " + line.trim());
  }
});
