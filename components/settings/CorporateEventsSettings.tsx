import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType } from '../../types';
import { StorageService, AssetHistory } from '../../services/storageService';
import { GeminiService } from '../../services/geminiService';
import { TrendingUp, Sparkles, Loader2, CheckSquare, Square, Check } from 'lucide-react';

interface CorporateEventsSettingsProps {
  transactions: Transaction[];
  assetHistory: Record<string, AssetHistory>;
}

export const CorporateEventsSettings: React.FC<CorporateEventsSettingsProps> = ({
  transactions,
  assetHistory: initialAssetHistory,
}) => {
  const [assetHistory, setAssetHistory] = useState<Record<string, AssetHistory>>(initialAssetHistory || {});
  const [isFetchingEvents, setIsFetchingEvents] = useState(false);
  const [eventsMessage, setEventsMessage] = useState('');
  const [pendingCorporateEvents, setPendingCorporateEvents] = useState<any[]>([]);
  const [isReviewingEvents, setIsReviewingEvents] = useState(false);

  const uniqueTickers = useMemo(() => {
    const tickers = new Set<string>();
    transactions.forEach(t => {
      if (t.type === TransactionType.INVESTMENT && t.investmentDetails?.ticker) {
        tickers.add(t.investmentDetails.ticker.trim().toUpperCase());
      }
    });
    return Array.from(tickers).sort();
  }, [transactions]);

  const [selectedAssetsToSearch, setSelectedAssetsToSearch] = useState<string[]>([]);

  useEffect(() => {
    if (uniqueTickers.length > 0 && selectedAssetsToSearch.length === 0) {
      setSelectedAssetsToSearch(uniqueTickers);
    }
  }, [uniqueTickers]);

  const handleFetchCorporateEvents = async () => {
    setIsFetchingEvents(true);
    setEventsMessage('Buscando eventos corporativos com IA...');
    setPendingCorporateEvents([]);
    setIsReviewingEvents(false);

    try {
      // Calculate first date for each selected ticker
      const assetPayload = selectedAssetsToSearch.map(ticker => {
        const matchingTxs = transactions
          .filter(t => t.type === TransactionType.INVESTMENT && t.investmentDetails?.ticker?.toUpperCase() === ticker)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const firstDate = matchingTxs.length > 0 ? matchingTxs[0].date.split('T')[0] : '2020-01-01';
        return { ticker, firstDate };
      });

      const { events } = await GeminiService.findCorporateEvents(assetPayload);
      if (!events || events.length === 0) {
        setEventsMessage('Nenhum evento corporativo recente encontrado para os ativos selecionados.');
      } else {
        setPendingCorporateEvents(events.map((e: any) => ({ ...e, selected: true })));
        setIsReviewingEvents(true);
        setEventsMessage(`${events.length} evento(s) corporativo(s) localizado(s). Revise abaixo.`);
      }
    } catch (e: any) {
      console.error(e);
      setEventsMessage(`Erro ao buscar eventos: ${e?.message || 'Falha na requisição'}`);
    } finally {
      setIsFetchingEvents(false);
    }
  };

  const handleConfirmCorporateEvents = async () => {
    const selected = pendingCorporateEvents.filter(e => e.selected);
    if (selected.length === 0) {
      alert('Nenhum evento selecionado para aplicar.');
      return;
    }

    setIsFetchingEvents(true);
    try {
      const investCat = transactions.find(t => t.type === TransactionType.INVESTMENT)?.categoryId || 'investments';

      for (const ev of selected) {
        const ticker = ev.ticker.toUpperCase();
        const eventType = ev.event === 'MERGE' ? 'MERGE' : ev.event === 'BONUS' ? 'BONUS' : 'SPLIT';
        const label = eventType === 'SPLIT' ? 'Desdobramento' : eventType === 'BONUS' ? 'Bonificação' : 'Grupamento';
        
        const newTx: any = {
          description: `${label} ${ticker}`,
          amount: 0,
          date: `${ev.date}T12:00:00.000Z`,
          type: TransactionType.INVESTMENT,
          categoryId: investCat,
          paymentMethod: 'DEBIT_CASH',
          isPaid: true,
          investmentDetails: {
            ticker,
            event: eventType,
            quantity: Number(ev.factor),
            price: 0,
            fees: 0
          }
        };

        await StorageService.addTransaction(newTx);
      }

      setIsReviewingEvents(false);
      setPendingCorporateEvents([]);
      setEventsMessage(`${selected.length} evento(s) corporativo(s) aplicados com sucesso aos lançamentos!`);
    } catch (e: any) {
      console.error(e);
      setEventsMessage(`Erro ao salvar eventos: ${e?.message || 'Falha desconhecida'}`);
    } finally {
      setIsFetchingEvents(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-2 max-w-3xl">
      <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 p-5 md:p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Eventos Corporativos (B3 & Bolsas)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Busque desdobramentos, grupamentos e bonificações com inteligência artificial.</p>
            </div>
          </div>
          <button
            onClick={handleFetchCorporateEvents}
            disabled={isFetchingEvents || selectedAssetsToSearch.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 text-xs font-bold shadow-xs shrink-0"
          >
            {isFetchingEvents ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            <span>Buscar com IA</span>
          </button>
        </div>

        {uniqueTickers.length > 0 && (
          <div className="pt-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                Ativos da Carteira ({uniqueTickers.length})
              </label>
              <button
                onClick={() => {
                  if (selectedAssetsToSearch.length === uniqueTickers.length) {
                    setSelectedAssetsToSearch([]);
                  } else {
                    setSelectedAssetsToSearch(uniqueTickers);
                  }
                }}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                {selectedAssetsToSearch.length === uniqueTickers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 custom-scrollbar">
              {uniqueTickers.map(ticker => (
                <label
                  key={ticker}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                    selectedAssetsToSearch.includes(ticker)
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selectedAssetsToSearch.includes(ticker)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAssetsToSearch([...selectedAssetsToSearch, ticker]);
                      } else {
                        setSelectedAssetsToSearch(selectedAssetsToSearch.filter(t => t !== ticker));
                      }
                    }}
                  />
                  <span>{ticker}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {eventsMessage && (
          <div className={`p-3 rounded-xl text-xs font-medium ${
            eventsMessage.includes('Erro')
              ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
          }`}>
            {eventsMessage}
          </div>
        )}

        {isReviewingEvents && pendingCorporateEvents.length > 0 && (
          <div className="mt-4 p-4 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-xs uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
                Revisão de Eventos Encontrados
              </h4>
              <button
                onClick={() => {
                  const allSelected = pendingCorporateEvents.every(e => e.selected);
                  setPendingCorporateEvents(pendingCorporateEvents.map(e => ({ ...e, selected: !allSelected })));
                }}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                {pendingCorporateEvents.every(e => e.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {pendingCorporateEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => {
                        const newEvents = [...pendingCorporateEvents];
                        newEvents[idx].selected = !newEvents[idx].selected;
                        setPendingCorporateEvents(newEvents);
                      }}
                      className="text-zinc-500 hover:text-zinc-800"
                    >
                      {event.selected ? <CheckSquare size={16} className="text-emerald-600" /> : <Square size={16} />}
                    </button>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      event.event === 'SPLIT'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : event.event === 'BONUS'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                    }`}>
                      {event.event === 'SPLIT' ? 'Desdobramento' : event.event === 'BONUS' ? 'Bonificação' : 'Grupamento'}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{event.ticker}</span>
                    <span className="text-zinc-400">{event.date}</span>
                  </div>
                  <div className="font-bold text-zinc-800 dark:text-zinc-200">
                    Fator: {event.factor}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setPendingCorporateEvents([]);
                  setIsReviewingEvents(false);
                  setEventsMessage('Busca cancelada.');
                }}
                className="px-3.5 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCorporateEvents}
                disabled={isFetchingEvents}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isFetchingEvents ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmar e Gravar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
