const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

// Fix installment field
code = code.replace(/!t\.currentInstallment \|\| t\.currentInstallment === 1/g, '!t.installmentIndex || t.installmentIndex === 1');

// Remove goalProjectionData and chartData
const startGoal = code.indexOf('// Goal simulator calculations');
let endGoal = code.indexOf('// Card & Installment Data');

if (startGoal !== -1 && endGoal !== -1) {
    code = code.substring(0, startGoal) + code.substring(endGoal);
    console.log("Removed goal simulator logic.");
} else {
    console.log("Could not find goal simulator bounds!");
}

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
