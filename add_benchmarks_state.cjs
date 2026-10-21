const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const regex = /const \[activeTab, setActiveTab\] = useState</;
const replacement = `const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['cdiAccum']);\n  const [activeTab, setActiveTab] = useState<`;

code = code.replace(regex, replacement);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Added benchmarks state');
