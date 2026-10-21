const lines = [
"BTLG11|05/08/2026|COMPRA|85|100.47|0.65|Inter|0.43|BRL||Renda Variável - BR|FII|"
];
for (let i = 0; i < lines.length; i++) {
    let columns = lines[i].split('\t');
    if (columns.length < 5) columns = lines[i].split('|');
    if (columns.length < 5) columns = lines[i].split(';');
    console.log(columns);
    console.log("Length:", columns.length);
}
