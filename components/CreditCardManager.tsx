
import React, { useState } from 'react';
import { CreditCard, Transaction } from '../types';
import { 
  Plus, Trash2, Pencil, X, CreditCard as CardIcon
} from 'lucide-react';

interface CreditCardManagerProps {
  cards: CreditCard[];
  transactions: Transaction[];
  onAddCard: (card: CreditCard) => void;
  onUpdateCard: (card: CreditCard) => void;
  onDeleteCard: (id: string) => void;
}

// Safe ID Generator
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const BRANDS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outros'];

const CARD_COLORS = [
    '#3b82f6', // Blue
    '#820AD1', // Nubank Purple
    '#EC7000', // Itau Orange
    '#CC092F', // Bradesco Red
    '#FADD00', // BB Yellow
    '#EC0000', // Santander Red
    '#000000', // Black
    '#10b981', // Emerald
    '#f43f5e', // Rose
    '#8b5cf6', // Violet
    '#0ea5e9', // Sky
    '#f59e0b'  // Amber
];

const BANKS = [
  { id: 'nubank', name: 'Nubank', color: '#820AD1' },
  { id: 'itau', name: 'Itaú', color: '#EC7000' },
  { id: 'bradesco', name: 'Bradesco', color: '#CC092F' },
  { id: 'bb', name: 'Banco do Brasil', color: '#0038A8' },
  { id: 'santander', name: 'Santander', color: '#EC0000' },
  { id: 'inter', name: 'Inter', color: '#FF7A00' },
  { id: 'btg', name: 'BTG Pactual', color: '#002043' },
  { id: 'xp', name: 'XP', color: '#000000' },
  { id: 'c6', name: 'C6 Bank', color: '#242424' },
  { id: 'caixa', name: 'Caixa', color: '#005CA9' },
  { id: 'neon', name: 'Neon', color: '#00E5FF' },
  { id: 'safra', name: 'Safra', color: '#D4AF37' },
  { id: 'sicoob', name: 'Sicoob', color: '#003641' },
  { id: 'sicredi', name: 'Sicredi', color: '#006633' },
  { id: 'stone', name: 'Stone', color: '#00A868' },
  { id: 'pagbank', name: 'PagBank', color: '#00D66C' },
  { id: 'mercadopago', name: 'Mercado Pago', color: '#00A9E0' },
  { id: 'picpay', name: 'PicPay', color: '#21C25E' },
  { id: 'cora', name: 'Cora', color: '#FE3E6D' },
  { id: 'bmg', name: 'BMG', color: '#FF6600' },
  { id: 'brb', name: 'BRB', color: '#005691' },
  { id: 'banrisul', name: 'Banrisul', color: '#00529C' },
  { id: 'efi', name: 'Efí', color: '#F37021' },
  { id: 'generic', name: 'Outro', color: '#64748b' },
];

const BANK_SVG_URLS: Record<string, string> = {
  nubank: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Nu%20Pagamentos%20S.A/nubank-logo-2021.svg',
  itau: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Ita%C3%BA%20Unibanco%20S.A/itau.svg',
  bradesco: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Bradesco%20S.A/bradesco.svg',
  bb: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banco%20do%20Brasil%20S.A/banco-do-brasil-com-fundo.svg',
  santander: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banco%20Santander%20Brasil%20S.A/santander-fundo-vermelho.svg',
  inter: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banco%20Inter%20S.A/inter.svg',
  btg: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banco%20BTG%20Pacutal/btg-pactual.svg',
  xp: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/XP%20Investimentos/xp-investimentos-logo.svg',
  c6: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banco%20C6%20S.A/c6%20bank.svg',
  caixa: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Caixa%20Econ%C3%B4mica%20Federal/caixa-economica-federal-1.svg',
  neon: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Neon/header-logo-neon.svg',
  safra: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banco%20Safra%20S.A/logo-safra.svg',
  sicoob: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Sicoob/sicoob-vector-logo.svg',
  sicredi: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Sicredi/logo-svg2.svg',
  stone: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Stone%20Pagamentos%20S.A/stone.svg',
  pagbank: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/PagSeguro%20Internet%20S.A/logo-pagbank.svg',
  mercadopago: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Mercado%20Pago/mercado-pago.svg',
  picpay: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/PicPay/Logo-PicPay.svg',
  cora: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Cora%20Sociedade%20Credito%20Direto%20S.A/icone-cora-com-fundo-pequeno.svg',
  bmg: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banco%20BMG/banco-bmg-logo.svg',
  brb: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/BRB%20-%20Banco%20de%20Brasilia/brb-logo.svg',
  banrisul: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Banrisul/banrisul-logo-2023.svg',
  efi: 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Ef%C3%AD%20-%20Gerencianet/logo-efi-bank-laranja.svg',
};

// --- LOGO COMPONENTS ---

export const BankLogo = ({ bankId, className }: { bankId: string, className?: string }) => {
    const [imgError, setImgError] = React.useState(false);
    const svgUrl = BANK_SVG_URLS[bankId];
    const bankInfo = BANKS.find(b => b.id === bankId) || BANKS.find(b => b.id === 'generic');

    if (svgUrl && !imgError) {
        return (
            <div 
                className={`flex items-center justify-center overflow-hidden rounded-lg p-1 shrink-0 bg-white/10 ${className}`} 
                style={{ aspectRatio: '1/1' }}
            >
                <img 
                    src={svgUrl} 
                    alt={bankInfo?.name || 'Bank Logo'} 
                    className="w-full h-full object-contain filter drop-shadow-sm" 
                    onError={() => setImgError(true)} 
                />
            </div>
        );
    }

    return (
        <div 
            className={`flex items-center justify-center font-bold text-white rounded-lg p-1 text-[10px] shrink-0 ${className}`} 
            style={{ aspectRatio: '1/1', backgroundColor: bankInfo?.color || '#64748b' }}
        >
            {bankInfo?.name && bankInfo.name !== 'Outro' ? bankInfo.name.substring(0, 3).toUpperCase() : <CardIcon size={16} />}
        </div>
    );
}

export const BrandLogo = ({ brand, className }: { brand: string, className?: string }) => {
    const normalized = (brand || '').toLowerCase();
    
    // Visa
    if (normalized.includes('visa')) {
        return (
            <svg viewBox="0 0 24 8" className={className} style={{ width: 'auto', height: '100%' }}>
                {/* Clean, standard Visa wordmark path */}
                <path fill="currentColor" d="M10.1 0L7.4 8h-2L7.3 0h2.8zm5.7 7.8c-.5-.2-1.3-.4-2.3-.4-2.5 0-4.3 1.3-4.3 3.1 0 1.4 1.2 2.1 2.2 2.6.9.5 1.3.8 1.3 1.2 0 .6-.8 1-1.5 1-1 0-1.6-.2-2.5-.5l-.3 1.7c.9.4 2.6.8 4.4.8 2.6 0 4.2-1.3 4.2-3.2 0-1.1-.6-1.9-2-2.6-.8-.4-1.3-.7-1.3-1.1 0-.4.4-.8 1.3-.8.7 0 1.3.1 2 .4l.3-1.7-.5-.5zm3.6.2l1.6-4.6h.1l1 4.6h-2.7zm3.3-8l-2.6 13.5h-2.9l-1.6-8.9c-.1-.2-.2-.4-.5-.6H13l-.1.6c.9.2 2 .5 2.6 1.4l2.4 11h3l4.5-13.5h-4zM2.8 0H0l1.7 10.4c.1.5.5.9 1 .9h3.7l5.5-13.5h-3L6.1 7.2 2.8 0z" transform="scale(0.8)"/>
            </svg>
        );
    }
    
    // Mastercard
    if (normalized.includes('mastercard')) {
        return (
            <svg viewBox="0 0 24 18" className={className} style={{ width: 'auto', height: '100%' }}>
                <circle cx="7" cy="9" r="7" fill="#EB001B" />
                <circle cx="17" cy="9" r="7" fill="#F79E1B" fillOpacity="0.85" />
            </svg>
        );
    }

    // Elo
    if (normalized.includes('elo')) {
        return (
             <svg viewBox="0 0 40 40" className={className} style={{ width: 'auto', height: '100%' }}>
                 <circle cx="10" cy="10" r="8" fill="#ef4444" />
                 <circle cx="28" cy="10" r="8" fill="#3b82f6" />
                 <circle cx="19" cy="28" r="8" fill="#22c55e" />
             </svg>
        );
    }

    // Amex
    if (normalized.includes('amex') || normalized.includes('american')) {
         return (
             <svg viewBox="0 0 40 24" className={className} style={{ width: 'auto', height: '100%' }}>
                <rect width="40" height="24" rx="2" fill="#2563EB" />
                <path fill="white" d="M4.5 17h2.2l.5-1.2h3.2l.5 1.2h2.2L9.5 7H6.8L4.5 17zm4.2-3h-2l1-2.4 1 2.4zM16.5 7h-2.5v10h2.5V13h1.8v4h2.4V7h-2.4v4h-1.8V7zm7.5 0h-2.5v10H24v-2h-2.5v-2H24v-2h-2.5v-2H24V7zm3 0l1.8 3 1.8-3h2.8l-3.2 5 3.2 5h-2.8l-1.8-3-1.8 3h-2.8l3.2-5-3.2-5H27z" />
             </svg>
         );
    }

    // Hipercard
    if (normalized.includes('hiper')) {
         return (
            <div className={`bg-[#A51C1F] text-white font-bold text-[10px] px-2 py-0.5 rounded-sm flex items-center justify-center border border-white/20 italic ${className}`}>
                Hipercard
            </div>
         );
    }
    
    // Fallback Text
    return <span className={`font-bold italic text-white/60 tracking-widest uppercase text-sm ${className}`}>{brand}</span>;
}

export const CreditCardManager: React.FC<CreditCardManagerProps> = ({ cards, transactions, onAddCard, onUpdateCard, onDeleteCard }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const initialCardState = {
    name: '',
    brand: 'Mastercard',
    icon: 'generic', // Default to generic bank icon
    limit: 0,
    closingDay: 1,
    dueDay: 10,
    color: '#3b82f6'
  };

  const [cardForm, setCardForm] = useState<Partial<CreditCard>>(initialCardState);

  const startEditing = (card: CreditCard) => {
    setCardForm({ ...card });
    setEditingId(card.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setCardForm(initialCardState);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(cardForm.name && cardForm.limit) {
        if (editingId) {
            // Update
            onUpdateCard({
                ...cardForm,
                id: editingId,
                name: cardForm.name,
                limit: Number(cardForm.limit),
                closingDay: Number(cardForm.closingDay),
                dueDay: Number(cardForm.dueDay),
                color: cardForm.color || '#3b82f6',
                brand: cardForm.brand,
                icon: cardForm.icon || 'generic'
            } as CreditCard);
        } else {
            // Create
            onAddCard({
                id: generateId(),
                name: cardForm.name,
                limit: Number(cardForm.limit),
                closingDay: Number(cardForm.closingDay),
                dueDay: Number(cardForm.dueDay),
                color: cardForm.color || '#3b82f6',
                brand: cardForm.brand || 'Outros',
                icon: cardForm.icon || 'generic'
            } as CreditCard);
        }
      
      cancelForm();
    }
  };

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) {
        onDeleteCard(id);
        setDeleteConfirmId(null);
    } else {
        setDeleteConfirmId(id);
    }
  };

  const getCardStats = (cardId: string, limit: number) => {
    const used = transactions
      .filter(t => t.creditCardId === cardId && !t.isPaid)
      .reduce((acc, t) => acc + t.amount, 0);
    
    const percentage = Math.min((used / limit) * 100, 100);
    return { used, percentage };
  };

  // Helper to render the Card Preview
  const renderCardPreview = (cardData: Partial<CreditCard>) => {
      const bank = BANKS.find(b => b.id === cardData.icon) || BANKS.find(b => b.id === 'generic')!;
      
      const limit = Number(cardData.limit || 0);
      const bgStyle = cardData.color ? { backgroundColor: cardData.color } : {};

      return (
        <div className="rounded-xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between h-[220px] w-full max-w-sm mx-auto border border-white/20"
             style={{
                 background: `linear-gradient(135deg, ${cardData.color || '#3b82f6'} 0%, #0f172a 100%)`
             }}
        >
            {/* Bank Logo */}
            <div className="absolute top-6 left-6 w-12 h-12 rounded-xl flex items-center justify-center z-10 shadow-lg bg-gray-50 dark:bg-zinc-800\/50 dark:bg-zinc-800/50 backdrop-blur-md border border-gray-200 dark:border-zinc-700">
                <BankLogo bankId={cardData.icon || 'generic'} className="w-8 h-8" />
            </div>

            {/* Brand Logo (Payment Network) */}
            <div className="absolute top-6 right-6 h-8 flex items-center justify-end z-10 text-white">
                <BrandLogo brand={cardData.brand || 'Card'} className="h-full" />
            </div>
            
            <div className="mt-16 mb-4 z-10">
                <h3 className="font-bold text-xl tracking-wide uppercase truncate pr-2 text-white drop-shadow-sm">
                    {cardData.name || 'Nome do Cartão'}
                </h3>
                <p className="text-sm text-white/80 mt-1 font-medium">
                    Limite: <span className="text-white font-bold">R$ {(limit || 0).toLocaleString('pt-BR')}</span>
                </p>
            </div>

            <div className="relative z-10 flex justify-between text-[11px] text-white/80 font-mono font-bold tracking-tight bg-black/20 p-2 rounded-lg border border-white/10">
                <span>FECHAMENTO: DIA {cardData.closingDay || '01'}</span>
                <span>VENCIMENTO: DIA {cardData.dueDay || '10'}</span>
            </div>
        </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Meus Cartões</h2>
        {!showForm && (
            <button
            onClick={() => { setCardForm(initialCardState); setShowForm(true); }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
            >
            <Plus size={16} /> Novo Cartão
            </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 dark:text-zinc-50 text-lg">{editingId ? 'Editar Cartão' : 'Novo Cartão'}</h3>
            <button onClick={cancelForm} className="text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-300"><X size={20}/></button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Left Column: Form */}
             <form onSubmit={handleSubmit} className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Nome do Cartão (Apelido)</label>
                    <input 
                        type="text" 
                        required
                        value={cardForm.name}
                        onChange={e => setCardForm({...cardForm, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg text-sm text-gray-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-gray-500 outline-none"
                        placeholder="Ex: Nubank Principal, Itaú Black"
                    />
                </div>
                
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Bandeira (Visa/Master...)</label>
                    <select 
                        value={cardForm.brand}
                        onChange={e => setCardForm({...cardForm, brand: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg text-sm text-gray-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-gray-500 outline-none"
                    >
                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Limite</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400 text-xs font-bold">R$</span>
                        <input 
                            type="number" 
                            required
                            value={cardForm.limit}
                            onChange={e => setCardForm({...cardForm, limit: Number(e.target.value)})}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg text-sm text-gray-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-gray-500 outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Fechamento (Dia)</label>
                    <input 
                        type="number" min="1" max="31"
                        required
                        value={cardForm.closingDay}
                        onChange={e => setCardForm({...cardForm, closingDay: Number(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg text-sm text-gray-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-gray-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Vencimento (Dia)</label>
                    <input 
                        type="number" min="1" max="31"
                        required
                        value={cardForm.dueDay}
                        onChange={e => setCardForm({...cardForm, dueDay: Number(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg text-sm text-gray-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-gray-500 outline-none"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Instituição Financeira (Banco)</label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-zinc-800\/50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg">
                        {BANKS.map((bank) => (
                            <button
                                key={bank.id}
                                type="button"
                                onClick={() => setCardForm({...cardForm, icon: bank.id})}
                                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all border ${
                                    cardForm.icon === bank.id 
                                    ? 'bg-white dark:bg-zinc-900 border-gray-500 dark:border-zinc-500 shadow-md ring-1 ring-gray-500' 
                                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:border-zinc-600 dark:border-zinc-600 hover:shadow-sm'
                                }`}
                                title={bank.name}
                            >
                                <BankLogo bankId={bank.id} className="w-8 h-8 rounded-md shadow-sm" />
                                <span className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate w-full text-center">{bank.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Cor do Cartão</label>
                    <div className="flex flex-wrap gap-2">
                        {CARD_COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setCardForm({...cardForm, color})}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${
                                    cardForm.color === color ? 'border-emerald-600 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>

                <button type="submit" className="md:col-span-2 bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 text-sm font-bold w-full mt-2 shadow-sm transition-colors">
                    {editingId ? 'Atualizar Cartão' : 'Salvar Cartão'}
                </button>
             </form>

             {/* Right Column: Preview */}
             <div className="flex flex-col items-center justify-start pt-2">
                 <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest mb-4">Pré-visualização</span>
                 {renderCardPreview(cardForm)}
                 <p className="text-center text-xs text-gray-500 dark:text-zinc-400 mt-4 max-w-xs">
                    O cartão exibe o logo do banco e a bandeira selecionada.
                 </p>
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map(card => {
          const { used, percentage } = getCardStats(card.id, card.limit);
          const available = card.limit - used;
          const isDeleting = deleteConfirmId === card.id;
          const bank = BANKS.find(b => b.id === card.icon) || BANKS.find(b => b.id === 'generic')!;

          return (
            <div key={card.id} 
                className="rounded-xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[220px] group border border-white/20"
                style={{
                    background: `linear-gradient(135deg, ${card.color || '#3b82f6'} 0%, #0f172a 100%)`
                }}
            >
              
              {/* Bank Logo */}
              <div className="absolute top-6 left-6 w-12 h-12 rounded-xl flex items-center justify-center z-10 shadow-lg bg-gray-50 dark:bg-zinc-800\/50 dark:bg-zinc-800/50 backdrop-blur-md border border-gray-200 dark:border-zinc-700">
                  <BankLogo bankId={card.icon || 'generic'} className="w-8 h-8" />
              </div>

              {/* Brand Logo */}
              <div className="absolute top-6 right-6 h-8 flex items-center justify-end z-10 text-white">
                  <BrandLogo brand={card.brand || 'Card'} className="h-full" />
              </div>

              {/* Actions Overlay - High Contrast Buttons */}
              <div className="absolute top-4 right-16 flex gap-2 z-20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                 {isDeleting ? (
                    <div className="flex gap-2 bg-white dark:bg-zinc-900/95 p-1.5 rounded-lg shadow-lg animate-in fade-in zoom-in-95">
                        <button 
                            onClick={() => handleDelete(card.id)} 
                            className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors shadow-sm"
                        >
                            Apagar
                        </button>
                        <button 
                            onClick={() => setDeleteConfirmId(null)} 
                            className="p-1 bg-gray-200 text-gray-700 dark:text-zinc-300 rounded hover:bg-gray-300 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                 ) : (
                    <div className="flex gap-2">
                        <button 
                        onClick={() => startEditing(card)} 
                        className="p-2 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 rounded-full hover:bg-gray-50 dark:bg-zinc-800\/50 dark:bg-zinc-800/50 shadow-md transition-all border border-transparent hover:scale-105"
                        title="Editar Cartão"
                        >
                        <Pencil size={14} />
                        </button>
                        <button 
                        onClick={() => handleDelete(card.id)} 
                        className="p-2 bg-white dark:bg-zinc-900 text-rose-600 rounded-full hover:bg-rose-50 shadow-md transition-all border border-transparent hover:scale-105"
                        title="Excluir Cartão"
                        >
                        <Trash2 size={14} />
                        </button>
                    </div>
                 )}
              </div>
              
              <div className="mt-16 mb-6 z-10">
                <h3 className="font-bold text-xl tracking-wide uppercase truncate pr-2 text-white drop-shadow-sm">{card.name}</h3>
                <p className="text-sm text-white/80 mt-1 font-medium">Limite Total: <span className="text-white font-bold">R$ {(card.limit || 0).toLocaleString('pt-BR')}</span></p>
              </div>

              <div className="relative z-10 space-y-3 mt-auto bg-black/20 p-4 rounded-lg border border-white/10 backdrop-blur-sm">
                 <div className="flex justify-between text-xs font-medium">
                    <span className="text-white/80">Usado: <span className="text-white font-bold">R$ {(used || 0).toLocaleString('pt-BR')}</span></span>
                    <span className={available < 0 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                      Disp: R$ {(available || 0).toLocaleString('pt-BR')}
                    </span>
                 </div>
                 
                 {/* Progress Bar with white bg for contrast */}
                 <div className="h-2 w-full bg-gray-200/60 rounded-full overflow-hidden border border-gray-100">
                    <div 
                      className={`h-full transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.3)] ${percentage > 90 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 'bg-white dark:bg-zinc-900'}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                 </div>
                 
                 <div className="flex justify-between text-[11px] text-white/60 font-mono font-bold tracking-tight">
                    <span>FECHAMENTO: DIA {card.closingDay}</span>
                    <span>VENCIMENTO: DIA {card.dueDay}</span>
                 </div>
              </div>
            </div>
          );
        })}
        
        {cards.length === 0 && !showForm && (
            <div className="col-span-full text-center py-12 bg-white dark:bg-zinc-900 border border-dashed border-gray-300 dark:border-zinc-600 dark:border-zinc-600 rounded-xl text-gray-500 dark:text-zinc-400">
                <CardIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p>Nenhum cartão cadastrado. Adicione seu primeiro cartão!</p>
            </div>
        )}
      </div>
    </div>
  );
};