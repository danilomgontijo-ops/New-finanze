import React, { useState } from 'react';
import { useSavedFindings } from '../../hooks/useSavedFindings';
import { copyFormattedHtml } from '../../utils/clipboard';
import DOMPurify from 'dompurify';
import { SavedFinding } from '../../types';
import { XMarkIcon, FolderIcon, SearchIcon, FormIcon, EditIcon, ViewIcon, CopyIcon, TrashIcon } from '../icons';

interface SavedFindingsModalProps {
  db: any; // Firestore instance
  currentUser?: any;
  onClose: () => void;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const SavedFindingsModal: React.FC<SavedFindingsModalProps> = ({ db, currentUser, onClose, addToast }) => {
  const { findings, isLoading, updateFindingTitle, deleteFinding } = useSavedFindings(db, currentUser);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [selectedFinding, setSelectedFinding] = useState<SavedFinding | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpdateTitle = async (id: string) => {
    if (!editingTitle.trim()) return;
    try {
      await updateFindingTitle(id, editingTitle);
      if (addToast) addToast('Título do Achado atualizado no banco de dados!', 'success');
    } catch (err: any) {
      console.error('Error updating finding title:', err);
      if (addToast) addToast(`Erro ao atualizar título: ${err.message}`, 'error');
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDeleteFinding = async (id: string) => {
    // First click arms the delete; a second click within 4s confirms it
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => {
        setDeletingId(prev => prev === id ? null : prev);
      }, 4000);
      return;
    }

    try {
      await deleteFinding(id);
      if (selectedFinding?.id === id) {
        setSelectedFinding(null);
      }
      if (addToast) addToast('Minuta de achado removida do banco de dados.', 'info');
    } catch (e: any) {
      console.error('Error deleting finding from database:', e);
      if (addToast) addToast(`Erro ao excluir: ${e.message}`, 'error');
    }
    setDeletingId(null);
  };

  const handleCopyFormatted = async (finding: SavedFinding) => {
    if (await copyFormattedHtml(finding.conteudoHtml)) {
      setCopiedId(finding.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const filteredFindings = findings.filter(f => 
    f.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.conteudoHtml.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-200 bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
          <div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <span className="p-2 bg-white/10 text-white rounded-xl border border-white/20 flex items-center justify-center">
                <FolderIcon className="h-5 w-5 text-white" />
              </span>
              <span>Minutas Padrão de Achados de Auditoria</span>
            </h2>
            <p className="text-xs text-tcepr-100/90 mt-1">
              Banco de teses e achados padronizados para reutilização em fiscalizações.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar minutas salvas por título, palavra-chave ou fundamentação..."
                className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-tcepr-500 focus:outline-none placeholder:text-slate-400 text-slate-800"
              />
            </div>
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
              {filteredFindings.length} minutas
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-tcepr-600 border-t-transparent"></div>
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-250 p-8 space-y-2">
              <FormIcon className="h-10 w-10 mx-auto text-slate-400 opacity-80" />
              <h3 className="font-bold text-slate-700 text-sm">Nenhuma minuta padrão salva ainda</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Ao gerar um Achado de Auditoria na Central de Análise por IA, clique em <strong>"Salvar Minuta Padrão"</strong> para reutilizá-lo em novas fiscalizações.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFindings.map((finding) => (
                <div 
                  key={finding.id} 
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Title Section with Edit Capability */}
                    {editingId === finding.id ? (
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="w-full p-2 border border-tcepr-400 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-tcepr-500"
                        />
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleUpdateTitle(finding.id)}
                            className="px-3 py-1 text-xs bg-tcepr-700 text-white font-bold rounded-lg cursor-pointer hover:bg-tcepr-800"
                          >
                            Salvar Novo Título
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                          {finding.titulo}
                        </h3>
                        <button 
                          onClick={() => {
                            setEditingId(finding.id);
                            setEditingTitle(finding.titulo);
                          }}
                          className="text-xs text-tcepr-600 hover:text-tcepr-800 font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                          title="Renomear título para adequar ao seu padrão"
                        >
                          <EditIcon className="h-3 w-3" />
                          <span>Renomear</span>
                        </button>
                      </div>
                    )}

                    <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>Salvo em: {finding.createdAt}</span>
                    </div>

                    {/* Content Preview */}
                    <div 
                      className="text-xs text-slate-600 line-clamp-4 bg-slate-50/80 p-3 rounded-xl border border-slate-100 font-sans leading-relaxed overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(finding.conteudoHtml) }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                    <button 
                      onClick={() => setSelectedFinding(finding)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <ViewIcon className="h-3.5 w-3.5" />
                      <span>Visualizar Completo</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleCopyFormatted(finding)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          copiedId === finding.id 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-tcepr-700 hover:bg-tcepr-800 text-white shadow-sm'
                        }`}
                        title="Copia diretamente com formatação pronta para o Microsoft Word"
                      >
                        {copiedId === finding.id ? (
                          <span>✓ Copiado!</span>
                        ) : (
                          <>
                            <CopyIcon className="h-3 w-3" />
                            <span>Copiar p/ Word</span>
                          </>
                        )}
                      </button>

                      <button 
                        onClick={() => handleDeleteFinding(finding.id)}
                        className={`px-2 py-1 text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center ${
                          deletingId === finding.id 
                            ? 'bg-rose-600 text-white font-bold animate-pulse px-2' 
                            : 'text-rose-500 hover:bg-rose-50 p-1.5'
                        }`}
                        title={deletingId === finding.id ? 'Clique novamente para confirmar exclusão' : 'Excluir minuta'}
                      >
                        {deletingId === finding.id ? (
                          <span>Excluir?</span>
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Viewer Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
              <h3 className="font-bold text-white text-base">{selectedFinding.titulo}</h3>
              <button 
                onClick={() => setSelectedFinding(null)}
                className="p-1.5 text-tcepr-200 hover:text-white rounded-lg cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div 
                className="prose prose-sm max-w-none text-slate-800 font-sans leading-relaxed"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedFinding.conteudoHtml) }}
              />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500">Salvo em {selectedFinding.createdAt}</span>
              <button 
                onClick={() => handleCopyFormatted(selectedFinding)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  copiedId === selectedFinding.id 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-tcepr-700 hover:bg-tcepr-800 text-white shadow-sm'
                }`}
              >
                {copiedId === selectedFinding.id ? (
                  <span>✓ Copiado com Formatação!</span>
                ) : (
                  <>
                    <CopyIcon className="h-4 w-4" />
                    <span>Copiar para o Word (com Formatação)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedFindingsModal;
