import React, { useState, useRef } from 'react';
import { Category, SubCategory, CreditCard, UserSettings, Transaction, TransactionType } from '../../types';
import { StorageService } from '../../services/storageService';
import { History, Calendar, Download, UploadCloud, Loader2, Trash2, Filter } from 'lucide-react';

interface DataSettingsProps {
  categories: Category[];
  subCategories: SubCategory[];
  creditCards: CreditCard[];
  settings: UserSettings;
  setSettings: (s: UserSettings) => void;
  onSaveSettings: (s: UserSettings) => void;
  transactions: Transaction[];
  onRestoreSuccess?: () => void;
}

export const DataSettings: React.FC<DataSettingsProps> = ({
  categories,
  subCategories,
  creditCards,
  settings,
  setSettings,
  onSaveSettings,
  transactions,
  onRestoreSuccess,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch delete state
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [batchMonth, setBatchMonth] = useState('');
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Backup Export
  const handleExportBackup = async () => {
    const mappings = await StorageService.getMappings();
    const backupData = {
      categories,
      subCategories,
      creditCards,
      settings,
      mappings,
      transactions,
      exportedAt: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `financas_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Backup Restore
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Atenção: A restauração pode sobrescrever configurações existentes. Deseja continuar?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.categories) await StorageService.saveCategories(data.categories);
      if (data.subCategories) await StorageService.saveSubCategories(data.subCategories);
      if (data.creditCards) await StorageService.saveCreditCards(data.creditCards);
      if (data.settings) await StorageService.saveSettings(data.settings);
      if (data.mappings) await StorageService.replaceMappings(data.mappings);

      alert('Backup restaurado com sucesso! A página será atualizada.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Erro ao processar o arquivo de backup. Verifique se o formato é válido.');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Transactions to delete in batch
  const transactionsToDelete = transactions.filter(t => {
    if (!batchCategoryId || !batchMonth) return false;
    const tMonth = t.date.slice(0, 7);
    return t.categoryId === batchCategoryId && tMonth === batchMonth;
  });

  const totalValueToDelete = transactionsToDelete.reduce((acc, t) => acc + (t.amount || 0), 0);

  const handleBatchDelete = async () => {
    if (transactionsToDelete.length === 0) return;
    if (!confirm(`Tem certeza que deseja apagar ${transactionsToDelete.length} lançamentos desta categoria?\nEssa ação é irreversível.`)) return;

    setIsDeletingBatch(true);
    try {
      const ids = transactionsToDelete.map(t => t.id);
      await StorageService.batchDeleteTransactions(ids);
      setBatchCategoryId('');
      alert('Lançamentos apagados com sucesso.');
    } catch (e) {
      console.error(e);
      alert('Erro ao apagar lançamentos.');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-left-2">
      {/* 1. Backup & Restauração */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 p-5 rounded-2xl flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Download size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Backup dos Dados</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Baixe um arquivo JSON com todas as suas informações e configurações.</p>
          </div>
          <button
            onClick={handleExportBackup}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs mt-auto"
          >
            Baixar Backup Completo
          </button>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 p-5 rounded-2xl flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl">
            {isRestoring ? <Loader2 size={22} className="animate-spin" /> : <UploadCloud size={22} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Restaurar Backup</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Carregue um arquivo JSON exportado anteriormente para recuperar dados.</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50 mt-auto"
          >
            {isRestoring ? 'Restaurando...' : 'Carregar Arquivo'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestoreBackup}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

      {/* 2. Zerar Saldo Acumulado */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 p-5 md:p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
            <History size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Data de Corte do Saldo Acumulado</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Defina uma data inicial para reiniciar a contagem do Saldo Acumulado Geral.</p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={settings.balanceResetDate ? settings.balanceResetDate.split('T')[0] : ''}
              onChange={(e) => {
                const val = e.target.value;
                const iso = val ? new Date(val + 'T12:00:00').toISOString() : undefined;
                const newSettings = { ...settings, balanceResetDate: iso };
                setSettings(newSettings);
                onSaveSettings(newSettings);
              }}
              className="border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900"
            />
            {settings.balanceResetDate && (
              <button
                onClick={() => {
                  const newSettings = { ...settings, balanceResetDate: undefined };
                  setSettings(newSettings);
                  onSaveSettings(newSettings);
                }}
                className="text-xs text-rose-500 font-bold hover:underline"
              >
                Limpar (Usar todo o histórico)
              </button>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Transações anteriores a esta data serão ignoradas no cálculo do "Acumulado Geral" no Dashboard.
          </p>
        </div>
      </div>

      {/* 3. Exclusão em Lote */}
      <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 p-5 md:p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
            <Trash2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Exclusão em Lote por Categoria</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Remova com rapidez lançamentos agrupados por mês e categoria.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-1">
              Mês de Referência
            </label>
            <input
              type="month"
              value={batchMonth}
              onChange={(e) => setBatchMonth(e.target.value)}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-rose-500 outline-none bg-white dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-1">
              Categoria
            </label>
            <select
              value={batchCategoryId}
              onChange={(e) => setBatchCategoryId(e.target.value)}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-rose-500 outline-none bg-white dark:bg-zinc-900"
            >
              <option value="">Selecione a categoria...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === TransactionType.EXPENSE ? 'Despesa' : (c.type === TransactionType.INVESTMENT ? 'Investimento' : 'Receita')})
                </option>
              ))}
            </select>
          </div>
        </div>

        {batchCategoryId && batchMonth && (
          <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 flex justify-between items-center animate-in zoom-in-95">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block mb-0.5">Encontrados</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{transactionsToDelete.length} lançamentos</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block mb-0.5">Valor Total</span>
              <span className="text-sm font-bold text-rose-600">
                R$ {(totalValueToDelete || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleBatchDelete}
          disabled={transactionsToDelete.length === 0 || isDeletingBatch}
          className="w-full py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isDeletingBatch ? 'Apagando...' : <><Trash2 size={15} /> Confirmar Exclusão em Lote</>}
        </button>
      </div>
    </div>
  );
};
