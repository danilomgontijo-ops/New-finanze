import React, { useState } from 'react';
import { UserSettings } from '../../types';
import { Target, Calendar, Fingerprint, History, RefreshCcw, Copy, Check, Info } from 'lucide-react';

interface GeneralSettingsProps {
  settings: UserSettings;
  setSettings: (s: UserSettings) => void;
  onSaveSettings: (s: UserSettings) => void;
  userId: string;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  setSettings,
  onSaveSettings,
  userId,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyUserId = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-2">
      {/* 1. Planejamento & Metas */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 rounded-2xl p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
            <Target size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Planejamento & Metas</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Compromisso orçamentário e taxa de poupança mensal.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-zinc-700 dark:text-zinc-300">Meta de Gastos da Receita</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-200/80 dark:bg-zinc-700/80 px-2.5 py-1 rounded-lg text-xs">
              {settings.monthlyBudgetPercentage}% da receita
            </span>
          </div>
          
          <input
            type="range"
            min="1"
            max="100"
            value={settings.monthlyBudgetPercentage}
            onChange={(e) => {
              const newSettings = { ...settings, monthlyBudgetPercentage: parseInt(e.target.value) };
              setSettings(newSettings);
              onSaveSettings(newSettings);
            }}
            className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
          />
          <div className="flex justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
            <span>Poupar Tudo (1%)</span>
            <span>Gastar Tudo (100%)</span>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/30 rounded-xl text-xs text-blue-700 dark:text-blue-300">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>A regra 50/30/20 recomenda gastar no máximo 80% (50% essenciais + 30% lazer) e aportar ao menos 20% para o futuro.</span>
          </div>

          <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide mb-1">
              Meta Fixa de Aporte Mensal (R$)
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              Valor nominal desejado para investir do próprio bolso todos os meses.
            </p>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
              <input
                type="number"
                step="100"
                placeholder="Ex: 2000"
                value={settings.monthlySavingsGoal || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const newSettings = {
                    ...settings,
                    monthlySavingsGoal: isNaN(val) || val <= 0 ? undefined : val,
                  };
                  setSettings(newSettings);
                  onSaveSettings(newSettings);
                }}
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ciclo Contábil & Salário */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 rounded-2xl p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Ciclo Mensal (Salário)</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Dia de pagamento e competência contábil.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide mb-1">
              Dia do Pagamento
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="31"
                value={settings.salaryDay || 1}
                onChange={(e) => {
                  const newDay = Math.min(31, Math.max(1, parseInt(e.target.value) || 1));
                  const currentShift = settings.salaryShift ?? (newDay >= 20 ? 1 : 0);
                  const newSettings = {
                    ...settings,
                    salaryDay: newDay,
                    salaryShift: currentShift,
                  };
                  setSettings(newSettings);
                  onSaveSettings(newSettings);
                }}
                className="w-20 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center font-bold text-sm text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-zinc-900"
              />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">de cada mês</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
              Regime de Competência
            </label>
            <div className="grid grid-cols-1 gap-2">
              <div
                onClick={() => {
                  const newSettings = { ...settings, salaryShift: 1 };
                  setSettings(newSettings);
                  onSaveSettings(newSettings);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  settings.salaryShift === 1
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  settings.salaryShift === 1 ? 'border-emerald-600 bg-emerald-600' : 'border-zinc-300 dark:border-zinc-600'
                }`}>
                  {settings.salaryShift === 1 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">Próximo Mês (Antecipação)</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Salário recebido no dia {settings.salaryDay || 1} financia as contas do mês seguinte.
                  </span>
                </div>
              </div>

              <div
                onClick={() => {
                  const newSettings = { ...settings, salaryShift: 0 };
                  setSettings(newSettings);
                  onSaveSettings(newSettings);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  settings.salaryShift === 0 || settings.salaryShift === undefined
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  settings.salaryShift === 0 || settings.salaryShift === undefined
                    ? 'border-emerald-600 bg-emerald-600'
                    : 'border-zinc-300 dark:border-zinc-600'
                }`}>
                  {(settings.salaryShift === 0 || settings.salaryShift === undefined) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">Mês Vigente</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Lançamentos a partir do dia {settings.salaryDay || 1} contam para o próprio mês.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Início do Histórico & Resgates */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 rounded-2xl p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <History size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Filtros de Histórico</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Controle de corte e visualização temporal.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide mb-1">
              Início do Histórico Mensal
            </label>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={settings.historyStartDate ? settings.historyStartDate.slice(0, 7) : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const newSettings = {
                    ...settings,
                    historyStartDate: val ? `${val}-01` : undefined,
                  };
                  setSettings(newSettings);
                  onSaveSettings(newSettings);
                }}
                className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-zinc-900"
              />
              {settings.historyStartDate && (
                <button
                  onClick={() => {
                    const newSettings = { ...settings, historyStartDate: undefined };
                    setSettings(newSettings);
                    onSaveSettings(newSettings);
                  }}
                  className="text-xs text-rose-500 font-bold hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Se não definido, serão exibidos os últimos 12 meses.
            </p>
          </div>

          <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide mb-1">
              Zerar Saldo de Resgates
            </label>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={settings.resgatesResetMonth || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const newSettings = {
                    ...settings,
                    resgatesResetMonth: val || undefined,
                  };
                  setSettings(newSettings);
                  onSaveSettings(newSettings);
                }}
                className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-zinc-900"
              />
              {settings.resgatesResetMonth && (
                <button
                  onClick={() => {
                    const newSettings = { ...settings, resgatesResetMonth: undefined };
                    setSettings(newSettings);
                    onSaveSettings(newSettings);
                  }}
                  className="text-xs text-rose-500 font-bold hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              O saldo acumulado de resgates de investimentos reiniciará a partir deste mês.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Identificação da Conta */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 rounded-2xl p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
            <Fingerprint size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Identificação da Conta</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Código único de isolamento e segurança dos dados.</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
            Seu ID de Usuário
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 truncate select-all">
              {userId || 'Carregando...'}
            </code>
            <button
              onClick={handleCopyUserId}
              disabled={!userId}
              className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 shrink-0 text-xs font-bold"
              title="Copiar ID"
            >
              {copiedId ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              <span>{copiedId ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Seus lançamentos, cartões e categorias estão criptograficamente associados a este identificador.
          </p>
        </div>
      </div>
    </div>
  );
};
