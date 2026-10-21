const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const oldCardsHeader = `              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency((stats.creditTotal || 0))}
              </span>
            </div>`;

const newCardsHeader = `              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency((stats.totalCredit || 0))}
                </span>
                {stats.myCreditTotal !== stats.totalCredit && (
                  <span className="text-[10px] text-zinc-500 font-medium">Sua parte: {formatCurrency(stats.myCreditTotal || 0)}</span>
                )}
              </div>
            </div>`;

code = code.replace(oldCardsHeader, newCardsHeader);

const oldCardItem = `                    <div className="flex items-center gap-2 min-w-0">
                      <BankLogo bankId={card.icon || 'generic'} className="w-6 h-6 rounded-md shrink-0" />
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{card.name}</span>
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                      {formatCurrency((card.total || 0))}
                    </span>`;

const newCardItem = `                    <div className="flex items-center gap-2 min-w-0">
                      <BankLogo bankId={card.icon || 'generic'} className="w-6 h-6 rounded-md shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{card.name}</span>
                        {card.total !== card.myTotal && (
                          <span className="text-[9px] text-zinc-500 font-medium truncate">Sua parte: {formatCurrency(card.myTotal || 0)}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                      {formatCurrency((card.total || 0))}
                    </span>`;

code = code.replace(oldCardItem, newCardItem);

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
