
import React from 'react';
import { motion } from 'motion/react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[110] flex justify-center items-center p-3 sm:p-4"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.3, bounce: 0.08 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-slate-800"
      >
         <div className="p-6">
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
          <p className="text-slate-600 mt-2.5 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 cursor-pointer active:scale-95 border border-slate-200"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm} 
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-rose-600/10 transition-all duration-200 hover:shadow-rose-600/20 cursor-pointer active:scale-95"
          >
            Confirmar Exclusão
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ConfirmationModal;
