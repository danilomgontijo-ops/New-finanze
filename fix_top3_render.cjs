const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const oldRender = `<div className={\`text-sm font-bold \${asset.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                      {asset.totalReturnPct > 0 ? '+' : ''}{asset.totalReturnPct.toFixed(2)}%
                    </div>`;

const newRender = `<div className="flex flex-col">
                      <span className={\`text-sm font-bold \${asset.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                        {asset.totalReturnPct > 0 ? '+' : ''}{asset.totalReturnPct.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {formatCurrency(asset.totalProfit)}
                      </span>
                    </div>`;

code = code.replace(oldRender, newRender);

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
