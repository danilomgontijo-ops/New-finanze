import React from 'react';
import { motion } from 'motion/react';
import { Demand, AutocompleteOptions } from '../../types';
import DemandForm from '../DemandForm';
import { XMarkIcon, FormIcon, PlusCircleIcon, PencilIcon } from '../icons';

interface DemandFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Demand, 'id' | 'createdAt'>) => void;
  onUpdate: (data: Demand) => void;
  editingDemand: Demand | null;
  autocompleteOptions: AutocompleteOptions;
  onOpenSummarizeModal: (demand: Demand) => void;
}

export const DemandFormModal: React.FC<DemandFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  editingDemand,
  autocompleteOptions,
  onOpenSummarizeModal,
}) => {
  if (!isOpen) return null;

  // The parent closes the modal only after a successful save, so a failed save keeps the typed data
  const handleSubmit = (data: Omit<Demand, 'id' | 'createdAt'>) => onSubmit(data);
  const handleUpdate = (data: Demand) => onUpdate(data);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto text-slate-800"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white p-5 md:p-6 flex items-center justify-between shrink-0 border-b border-slate-200 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-tcepr-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="p-2.5 bg-white/10 text-white rounded-xl border border-white/20 shrink-0 shadow-md">
              {editingDemand ? <PencilIcon className="h-6 w-6 text-white" /> : <PlusCircleIcon className="h-6 w-6 text-white" />}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {editingDemand ? 'Editar Fiscalização' : 'Cadastrar Fiscalização'}
              </h3>
              <p className="text-xs text-tcepr-100/90 font-medium mt-0.5">
                {editingDemand
                  ? `Alterando dados do processo de ${editingDemand.municipio} (${editingDemand.ano})`
                  : 'Preencha os dados abaixo para registrar uma nova ação fiscalizatória'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-xl transition-all relative z-10 cursor-pointer"
            aria-label="Fechar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body with DemandForm */}
        <div className="p-5 md:p-8 overflow-y-auto max-h-[calc(92vh-80px)]">
          <DemandForm
            onSubmit={handleSubmit}
            onUpdate={handleUpdate}
            editingDemand={editingDemand}
            onCancelEdit={onClose}
            autocompleteOptions={autocompleteOptions}
            onOpenSummarizeModal={onOpenSummarizeModal}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DemandFormModal;
