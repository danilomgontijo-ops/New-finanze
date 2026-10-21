import React, { useState, useEffect } from 'react';
import { HistoricalPriceService, HistoricalDataPoint } from '../services/HistoricalPriceService';

interface AtualizadorAtivosProps {
    tickers: string[];
    onUpdatePrice?: (ticker: string, data: HistoricalDataPoint[]) => void;
    onClose?: () => void;
}

export const AtualizadorAtivos: React.FC<AtualizadorAtivosProps> = ({ tickers, onUpdatePrice, onClose }) => {
  const [status, setStatus] = useState("Aguardando início...");
  const [log, setLog] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Start automatically when component mounts
  useEffect(() => {
    if (tickers.length > 0 && !carregando) {
        iniciarProcessamento();
    }
  }, []);

  async function iniciarProcessamento() {
    setCarregando(true);
    setLog([]);
    setStatus("🚀 Iniciando processamento da lista...");

    try {
      // 1. Loop para processar cada ativo individualmente
      for (const ticker of tickers) {
        setStatus(`⏳ Buscando dados de ${ticker}...`);
        
        try {
          const data = await HistoricalPriceService.getHistoricalPrices(ticker);

          if (data && data.length > 0) {
            setLog(prev => [...prev, `✅ ${ticker}: ${data.length} meses sincronizados.`]);
            
            // Update app state if callback provided
            if (onUpdatePrice) {
                onUpdatePrice(ticker, data);
            }

          } else {
            setLog(prev => [...prev, `❌ ${ticker}: Falha ao buscar dados ou histórico vazio.`]);
          }
        } catch (err) {
          setLog(prev => [...prev, `💥 ${ticker}: Erro de conexão.`]);
        }

        // PAUSA DE SEGURANÇA: 2 segundos entre cada ativo
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setStatus("🏁 Sincronização Finalizada!");
    } catch (error: any) {
      console.error(error);
      setStatus(`❌ Erro crítico: ${error.message}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">🔄 Sincronizador de Ativos (Google Sheets)</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
            <p className="text-sm text-gray-700 mb-4"><strong>Status atual:</strong> <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-900">{status}</span></p>
            <p className="text-xs text-gray-500 mb-4">Ativos na fila: <strong>{tickers.join(", ")}</strong></p>
            
            <button 
            onClick={iniciarProcessamento} 
            disabled={carregando}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${carregando ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30'}`}
            >
            {carregando ? "Sincronizando..." : "Reiniciar Sincronização"}
            </button>

            <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-[300px] overflow-y-auto font-mono text-xs custom-scrollbar">
            <strong className="block mb-2 text-gray-500 uppercase text-[10px] tracking-wider">Log de Operações:</strong>
            {log.length === 0 && <p className="text-gray-500 italic">Nenhuma atividade.</p>}
            <ul className="space-y-1">
                {log.map((item, idx) => (
                    <li key={idx} className={`${item.includes('❌') || item.includes('💥') ? 'text-rose-600' : item.includes('✅') ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {item}
                    </li>
                ))}
            </ul>
            </div>
        </div>
      </div>
    </div>
  );
}
