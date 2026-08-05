const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

// Remove Simulador UI
const startIdx = code.indexOf('{/* SEÇÃO 4: SIMULADOR DE METAS */}');
let endIdx = code.indexOf('{/* SEÇÃO 5: CARTÕES & DÉBITO */}');

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + code.substring(endIdx);
    console.log("Removed Simulador successfully");
} else {
    console.log("Simulador not found!");
}

// Remove state variables
code = code.replace(/const \[isGoalSimulatorOpen, setIsGoalSimulatorOpen\] = useState\(false\);\n?/g, '');
code = code.replace(/const \[targetMet, setTargetMet\] = useState.*?;\n?/g, '');
code = code.replace(/const \[monthlyAporte, setMonthlyAporte\] = useState.*?;\n?/g, '');
code = code.replace(/const \[annualReturn, setAnnualReturn\] = useState.*?;\n?/g, '');

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
