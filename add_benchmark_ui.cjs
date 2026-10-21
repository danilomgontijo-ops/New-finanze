const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const targetStr = `<h3 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-500" />{" "}
                  Rentabilidade Acumulada (TWR vs Benchmarks)
                </h3>`;

const replaceStr = `<div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-500" />{" "}
                    Rentabilidade Acumulada (TWR vs Benchmarks)
                  </h3>
                  <div className="flex gap-3 text-[10px] font-bold">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selectedBenchmarks.includes('cdiAccum')} onChange={() => setSelectedBenchmarks(prev => prev.includes('cdiAccum') ? prev.filter(x => x !== 'cdiAccum') : [...prev, 'cdiAccum'])} className="accent-slate-700" />
                      CDI
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selectedBenchmarks.includes('ipcaAccum')} onChange={() => setSelectedBenchmarks(prev => prev.includes('ipcaAccum') ? prev.filter(x => x !== 'ipcaAccum') : [...prev, 'ipcaAccum'])} className="accent-rose-500" />
                      IPCA
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selectedBenchmarks.includes('ibovAccum')} onChange={() => setSelectedBenchmarks(prev => prev.includes('ibovAccum') ? prev.filter(x => x !== 'ibovAccum') : [...prev, 'ibovAccum'])} className="accent-blue-500" />
                      IBOV
                    </label>
                  </div>
                </div>`;

code = code.replace(targetStr, replaceStr);

const lineStr = `<Line
                      type="monotone"
                      dataKey="cdiAccum"
                      name="CDI Acumulado"
                      stroke="#334155"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={{ r: 0 }}
                    />`;

const replaceLineStr = `{selectedBenchmarks.includes('cdiAccum') && (
                      <Line
                        type="monotone"
                        dataKey="cdiAccum"
                        name="CDI Acumulado"
                        stroke="#334155"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 0 }}
                      />
                    )}
                    {selectedBenchmarks.includes('ipcaAccum') && (
                      <Line
                        type="monotone"
                        dataKey="ipcaAccum"
                        name="IPCA Acumulado"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 0 }}
                      />
                    )}
                    {selectedBenchmarks.includes('ibovAccum') && (
                      <Line
                        type="monotone"
                        dataKey="ibovAccum"
                        name="IBOV Acumulado"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 0 }}
                      />
                    )}`;

code = code.replace(lineStr, replaceLineStr);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Updated UI with toggles');
