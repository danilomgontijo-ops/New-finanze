import React from 'react';
import { motion } from 'motion/react';
import { Demand } from '../../types';
import { XMarkIcon, FormIcon } from '../icons';
import { ReportFindingsOverviewSection } from '../ReportFindingsOverviewSection';

interface ReportFindingsModalProps {
  demands: Demand[];
  onClose: () => void;
  onViewDemand: (demand: Demand) => void;
}

export const ReportFindingsModal: React.FC<ReportFindingsModalProps> = ({
  demands,
  onClose,
  onViewDemand,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[110] flex items-center justify-center p-3 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 text-slate-800"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-tcepr-700 via-tcepr-800 to-tcepr-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 text-white rounded-xl font-bold border border-white/20 flex items-center justify-center">
              <FormIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight leading-tight">
                Informações das fiscalizações
              </h3>
              <p className="text-xs font-semibold text-tcepr-100 mt-0.5">
                Achados do Resumo de Relatório (IA)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-tcepr-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            title="Fechar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6">
          <ReportFindingsOverviewSection
            demands={demands}
            onViewDemand={(demand) => {
              onViewDemand(demand);
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ReportFindingsModal;
