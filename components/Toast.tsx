
import React, { useEffect, useRef } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  // Keep the latest onClose in a ref so parent re-renders (new arrow function) don't restart the timer
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), 4500);
    return () => clearTimeout(timer);
  }, []);

  const styles = {
    success: 'bg-white text-slate-800 border-l-emerald-500 shadow-emerald-500/5',
    error: 'bg-white text-slate-800 border-l-rose-500 shadow-rose-500/5',
    info: 'bg-white text-slate-800 border-l-tcepr-600 shadow-tcepr-600/5',
  };

  const badgeColors = {
    success: 'bg-emerald-50 text-emerald-600',
    error: 'bg-rose-50 text-rose-600',
    info: 'bg-tcepr-50 text-tcepr-700',
  };

  return (
    <div className={`pl-4 pr-5 py-3 rounded-xl border border-slate-100 border-l-4 shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300 max-w-sm ${styles[type]}`}>
      <div className={`p-1 rounded-lg ${badgeColors[type]} flex-shrink-0`}>
        {type === 'success' && <span className="text-xs font-bold font-sans">✓</span>}
        {type === 'error' && <span className="text-xs font-bold font-sans">✕</span>}
        {type === 'info' && <span className="text-xs font-bold font-sans">ℹ</span>}
      </div>
      <p className="text-sm font-semibold text-slate-700 tracking-tight leading-snug">{message}</p>
    </div>
  );
};

export default Toast;
