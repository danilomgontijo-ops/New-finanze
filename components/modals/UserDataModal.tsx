import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Demand } from '../../types';
import { XMarkIcon, DownloadIcon, UploadIcon, TrashIcon, FormIcon, AlertIcon } from '../icons';

interface UserDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  demands: Demand[];
  duplicateDocsCount?: number;
  onRemoveDuplicates?: () => Promise<void>;
  onImportDemands: (data: { demands: Partial<Demand>[]; savedFindings?: any[]; savedConsultations?: any[] }, replaceExisting: boolean) => Promise<void>;
  onExportDemands: () => void;
  onClearAllDemands: () => Promise<void>;
  onSignOut?: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserDataModal: React.FC<UserDataModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  demands,
  duplicateDocsCount = 0,
  onRemoveDuplicates,
  onImportDemands,
  onExportDemands,
  onClearAllDemands,
  onSignOut,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState<'options' | 'import' | 'clearConfirm'>('options');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ demands: Partial<Demand>[]; savedFindings?: any[]; savedConsultations?: any[] } | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      addToast('Por favor, selecione um arquivo no formato .json', 'error');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        let items: any[] = [];
        if (Array.isArray(json)) {
          items = json;
        } else if (json && Array.isArray(json.demands)) {
          items = json.demands;
        } else if (json && Array.isArray(json.fiscalizacoes)) {
          items = json.fiscalizacoes;
        } else if (json && typeof json === 'object') {
          // Single demand object wrapped
          items = [json];
        }

        if (items.length === 0) {
          addToast('Nenhuma fiscalização válida encontrada no arquivo JSON.', 'error');
          setParsedData(null);
          return;
        }

        // Clean & validate items basic structure with field alias support
        const validDemands = items.map((item) => ({
          ano: item.ano || item.exercicio || new Date().getFullYear(),
          municipio: item.municipio || 'Município não informado',
          nFiscalizacao: item.nFiscalizacao || item.fiscalizacao || '',
          numeroProcesso: item.numeroProcesso || '',
          objeto: item.objeto || '',
          modalidade: item.modalidade || '',
          tema: item.tema || item.esfera || '',
          valor: item.valor || '',
          status: item.status || 'Pendente',
          dataReqExterno: item.dataReqExterno || item.dataInicio || '',
          requerimentoExterno: item.requerimentoExterno || '',
          representacaoExterna: Array.isArray(item.representacaoExterna) 
            ? item.representacaoExterna 
            : (item.representacaoExterna ? [String(item.representacaoExterna)] : []),
          encaminhamentoProcessual: item.encaminhamentoProcessual || item.encaminhamento || item.linkProcesso || '',
          observacoes: item.observacoes || '',
          resumoRelatorio: item.resumoRelatorio || '',
          relatorioTextoCompleto: item.relatorioTextoCompleto || '',
          relatorioNomeArquivo: item.relatorioNomeArquivo || '',
          relatorioArquivos: Array.isArray(item.relatorioArquivos) ? item.relatorioArquivos : [],
        }));

        setParsedData({
          demands: validDemands,
          savedFindings: json.saved_findings || [],
          savedConsultations: json.saved_consultations || []
        });
        
        let msg = `${validDemands.length} fiscalizações carregadas!`;
        if (json.saved_findings?.length) msg += ` (+${json.saved_findings.length} minutas)`;
        if (json.saved_consultations?.length) msg += ` (+${json.saved_consultations.length} resumos)`;
        addToast(msg, 'info');
      } catch (err: any) {
        addToast(`Erro ao ler arquivo JSON: ${err.message}`, 'error');
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.demands.length === 0) return;
    setIsProcessing(true);
    try {
      await onImportDemands(parsedData, importMode === 'replace');
      addToast(`Importação concluída!`, 'success');
      setSelectedFile(null);
      setParsedData(null);
      setActiveTab('options');
      onClose();
    } catch (err: any) {
      addToast(`Erro durante a importação: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteClearAll = async () => {
    if (confirmDeleteText !== 'APAGAR') {
      addToast('Digite a palavra APAGAR para confirmar a exclusão.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await onClearAllDemands();
      addToast('Todas as fiscalizações foram excluídas com sucesso.', 'info');
      setConfirmDeleteText('');
      setActiveTab('options');
      onClose();
    } catch (err: any) {
      addToast(`Erro ao apagar dados: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[110] flex justify-center items-center p-3 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-white text-sm shadow-md">
              {(currentUser?.displayName || currentUser?.email || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {currentUser?.displayName || 'Perfil do Usuário'}
              </h3>
              <p className="text-xs text-tcepr-100/90 truncate max-w-[220px]">
                {currentUser?.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'options' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-tcepr-50 border border-tcepr-100 rounded-xl text-xs text-tcepr-900 flex items-center justify-between shadow-2xs">
                <div>
                  <p className="font-extrabold text-tcepr-950 text-xs">Fiscalizações Ativas no seu Portfólio:</p>
                  <p className="text-tcepr-700 text-[11px] mt-0.5">Armazenadas exclusivamente para o seu usuário</p>
                </div>
                <span className="text-lg font-black bg-white px-3 py-1 rounded-lg border border-tcepr-200 text-tcepr-800 shadow-2xs">
                  {demands.length}
                </span>
              </div>

              {/* Deduplication Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-tcepr-600" />
                      <span>Integridade & Duplicidades</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {duplicateDocsCount > 0
                        ? `${duplicateDocsCount} registro(s) repetido(s) identificado(s) no banco`
                        : 'Nenhuma duplicidade detectada - banco de dados íntegro'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    duplicateDocsCount > 0
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {duplicateDocsCount > 0 ? `${duplicateDocsCount} duplicatas` : '100% Íntegro'}
                  </span>
                </div>
                {onRemoveDuplicates && (
                  <button
                    type="button"
                    disabled={isDeduplicating}
                    onClick={async () => {
                      setIsDeduplicating(true);
                      try {
                        await onRemoveDuplicates();
                      } finally {
                        setIsDeduplicating(false);
                      }
                    }}
                    className="w-full mt-1 py-2 px-3 bg-white hover:bg-tcepr-50 border border-slate-200 hover:border-tcepr-300 text-tcepr-800 hover:text-tcepr-900 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-[0.99]"
                  >
                    {isDeduplicating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-tcepr-600 border-t-transparent rounded-full animate-spin" />
                        <span>Verificando e limpando duplicidades...</span>
                      </>
                    ) : (
                      <span>{duplicateDocsCount > 0 ? 'Remover Duplicidades Agora' : 'Verificar / Otimizar Banco'}</span>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Gerenciamento de Dados
                </p>

                {/* Export Button */}
                <button
                  type="button"
                  onClick={onExportDemands}
                  className="w-full p-4 bg-slate-50 hover:bg-tcepr-50/60 border border-slate-200 hover:border-tcepr-300 rounded-xl flex items-center justify-between transition-all group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 text-tcepr-700 rounded-xl group-hover:scale-105 transition-transform flex items-center justify-center shadow-2xs">
                      <DownloadIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-tcepr-900">Exportar Dados (JSON)</p>
                      <p className="text-xs text-slate-500">Baixar backup de todas as suas fiscalizações em arquivo JSON</p>
                    </div>
                  </div>
                  <span className="text-xs text-tcepr-700 font-bold group-hover:underline">Baixar</span>
                </button>

                {/* Import Button */}
                <button
                  type="button"
                  onClick={() => setActiveTab('import')}
                  className="w-full p-4 bg-slate-50 hover:bg-tcepr-50/60 border border-slate-200 hover:border-tcepr-300 rounded-xl flex items-center justify-between transition-all group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 text-tcepr-700 rounded-xl group-hover:scale-105 transition-transform flex items-center justify-center shadow-2xs">
                      <UploadIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-tcepr-900">Importar Dados (JSON)</p>
                      <p className="text-xs text-slate-500">Carregar arquivo JSON com novas fiscalizações</p>
                    </div>
                  </div>
                  <span className="text-xs text-tcepr-700 font-bold group-hover:underline">Carregar</span>
                </button>

                {/* Clear All Data Button */}
                <button
                  type="button"
                  onClick={() => setActiveTab('clearConfirm')}
                  className="w-full p-4 bg-rose-50/60 hover:bg-rose-100/70 border border-rose-200/80 hover:border-rose-300 rounded-xl flex items-center justify-between transition-all group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white border border-rose-200 text-rose-600 rounded-xl group-hover:scale-105 transition-transform flex items-center justify-center shadow-2xs">
                      <TrashIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-rose-800 group-hover:text-rose-900">Apagar Todos os Dados</p>
                      <p className="text-xs text-rose-600/80">Excluir permanentemente todas as suas fiscalizações no banco</p>
                    </div>
                  </div>
                  <span className="text-xs text-rose-700 font-bold group-hover:underline">Apagar</span>
                </button>
              </div>
            </div>
          )}

          {/* Import View */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <UploadIcon className="h-5 w-5 text-tcepr-600" />
                  <span>Importar Fiscalizações via JSON</span>
                </h4>
                <button
                  onClick={() => {
                    setActiveTab('options');
                    setSelectedFile(null);
                    setParsedData(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  Voltar
                </button>
              </div>

              {/* File Input Box */}
              <div className="border-2 border-dashed border-slate-200 hover:border-tcepr-500/60 rounded-xl p-6 text-center bg-slate-50 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="space-y-2">
                  <div className="flex justify-center py-2">
                    <FormIcon className="h-10 w-10 text-tcepr-300" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    {selectedFile ? selectedFile.name : 'Selecione o arquivo .json do seu computador'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    O arquivo deve conter um array de objetos de fiscalização.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-4 py-2 bg-tcepr-700 hover:bg-tcepr-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    {selectedFile ? 'Escolher Outro Arquivo' : 'Buscar Arquivo JSON'}
                  </button>
                </div>
              </div>

              {/* Preview & Import Options */}
              {parsedData && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-600">
                      ✓ {parsedData.demands.length} registro(s) pronto(s) para importar
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="font-bold text-slate-700">Modo de Importação:</p>
                    <label className="flex items-center gap-2 text-slate-650 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-tcepr-600 focus:ring-tcepr-500"
                      />
                      <span>
                        <strong>Adicionar</strong> aos dados existentes (Manter {demands.length} atuais)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-rose-650 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>
                        <strong>Substituir</strong> todos os dados existentes por esta importação
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleExecuteImport}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Importando para o Firestore...</span>
                      </>
                    ) : (
                      <span>Confirmar e Importar</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Clear All Confirmation View */}
          {activeTab === 'clearConfirm' && (
            <div className="space-y-4 p-4 bg-rose-50 border border-rose-100 rounded-xl">
              <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                <h4 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                  <AlertIcon className="h-4 w-4 text-rose-600" />
                  <span>Atenção: Apagar Todos os Dados</span>
                </h4>
                <button
                  onClick={() => {
                    setActiveTab('options');
                    setConfirmDeleteText('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Cancelar
                </button>
              </div>

              <p className="text-xs text-rose-600 leading-relaxed">
                Esta ação excluirá permanentemente todas as <strong>{demands.length} fiscalizações</strong> registradas sob o seu usuário no Firebase Firestore. Esta ação <strong>não pode ser desfeita</strong>.
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600">
                  Digite <span className="text-rose-600 select-all font-mono font-bold">APAGAR</span> no campo abaixo para confirmar:
                </p>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="APAGAR"
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs text-rose-750 font-mono tracking-widest focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <button
                type="button"
                disabled={confirmDeleteText !== 'APAGAR' || isProcessing}
                onClick={handleExecuteClearAll}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Excluindo dados...</span>
                  </>
                ) : (
                  <span>Confirmar Exclusão Definitiva</span>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="px-3 py-2 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 hover:border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              🚪 Sair da Conta
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default UserDataModal;
