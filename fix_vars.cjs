const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(/  const \[overviewFilterCategory, setOverviewFilterCategory\] = useState\(""\);\n/g, "");
code = code.replace(/  const \[overviewFilterSubCategory, setOverviewFilterSubCategory\] = useState\(""\);\n/g, "");
code = code.replace(/  const \[overviewFilterTicker, setOverviewFilterTicker\] = useState\(""\);\n/g, "");

// the state for subCategory was broken into two lines probably:
//   const [overviewFilterSubCategory, setOverviewFilterSubCategory] =
//     useState("");
code = code.replace(/  const \[overviewFilterSubCategory, setOverviewFilterSubCategory\] =\n    useState\(""\);\n/g, "");

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
