import React, { useState } from 'react';
import { Category, SubCategory, TransactionType } from '../../types';
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, Layers, Plus, Check, Pencil, Trash2, AlertCircle, Circle,
  Utensils, Car, Home, Gamepad, Activity, User, Dog, Banknote, ShoppingBag, Coffee, Smartphone, Hammer,
  Plane, Music, Gift, Wifi, Zap, Book, Briefcase, Shirt, Landmark, CreditCard, Wallet, DollarSign,
  Euro, Bitcoin, Gem, Rocket, Star, Heart, Shield, Lock, Key, Globe, MapPin, Navigation, Flag,
  Crown, Trophy, Award, ShoppingCart, Truck, Package, Ghost, Smile, ThumbsUp
} from 'lucide-react';

export const AVAILABLE_ICONS = [
  { name: 'utensils', Comp: Utensils },
  { name: 'car', Comp: Car },
  { name: 'home', Comp: Home },
  { name: 'gamepad', Comp: Gamepad },
  { name: 'activity', Comp: Activity },
  { name: 'user', Comp: User },
  { name: 'dog', Comp: Dog },
  { name: 'banknote', Comp: Banknote },
  { name: 'trending-up', Comp: TrendingUp },
  { name: 'shopping-bag', Comp: ShoppingBag },
  { name: 'coffee', Comp: Coffee },
  { name: 'smartphone', Comp: Smartphone },
  { name: 'hammer', Comp: Hammer },
  { name: 'plane', Comp: Plane },
  { name: 'music', Comp: Music },
  { name: 'gift', Comp: Gift },
  { name: 'wifi', Comp: Wifi },
  { name: 'zap', Comp: Zap },
  { name: 'book', Comp: Book },
  { name: 'briefcase', Comp: Briefcase },
  { name: 'shirt', Comp: Shirt },
  { name: 'circle', Comp: Circle },
  { name: 'landmark', Comp: Landmark },
  { name: 'credit-card', Comp: CreditCard },
  { name: 'wallet', Comp: Wallet },
  { name: 'dollar-sign', Comp: DollarSign },
  { name: 'euro', Comp: Euro },
  { name: 'bitcoin', Comp: Bitcoin },
  { name: 'gem', Comp: Gem },
  { name: 'rocket', Comp: Rocket },
  { name: 'star', Comp: Star },
  { name: 'heart', Comp: Heart },
  { name: 'shield', Comp: Shield },
  { name: 'lock', Comp: Lock },
  { name: 'key', Comp: Key },
  { name: 'globe', Comp: Globe },
  { name: 'map-pin', Comp: MapPin },
  { name: 'navigation', Comp: Navigation },
  { name: 'flag', Comp: Flag },
  { name: 'crown', Comp: Crown },
  { name: 'trophy', Comp: Trophy },
  { name: 'award', Comp: Award },
  { name: 'shopping-cart', Comp: ShoppingCart },
  { name: 'truck', Comp: Truck },
  { name: 'package', Comp: Package },
  { name: 'ghost', Comp: Ghost },
  { name: 'smile', Comp: Smile },
  { name: 'thumbs-up', Comp: ThumbsUp },
];

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

interface CategorySettingsProps {
  categories: Category[];
  setCategories: (c: Category[]) => void;
  subCategories: SubCategory[];
  setSubCategories: (s: SubCategory[]) => void;
  onSaveCategories: (c: Category[]) => void;
  onSaveSubCategories: (s: SubCategory[]) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteSubCategory: (id: string) => void;
  onUpdateCategory: (c: Category) => void;
  onUpdateSubCategory: (s: SubCategory) => void;
}

export const CategorySettings: React.FC<CategorySettingsProps> = ({
  categories,
  setCategories,
  subCategories,
  setSubCategories,
  onSaveCategories,
  onSaveSubCategories,
  onDeleteCategory,
  onDeleteSubCategory,
  onUpdateCategory,
  onUpdateSubCategory,
}) => {
  // Category forms state
  const [expCatName, setExpCatName] = useState('');
  const [expCatIcon, setExpCatIcon] = useState('utensils');
  const [expIsAdditionalCard, setExpIsAdditionalCard] = useState(false);
  const [incCatName, setIncCatName] = useState('');
  const [incCatIcon, setIncCatIcon] = useState('banknote');
  const [invCatName, setInvCatName] = useState('');
  const [invCatIcon, setInvCatIcon] = useState('trending-up');

  // Subcategory form state
  const [selectedCatForSub, setSelectedCatForSub] = useState('');
  const [newSubName, setNewSubName] = useState('');

  // Editing state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Handlers
  const handleAddCategory = (type: TransactionType) => {
    let name = '';
    let icon = '';

    if (type === TransactionType.EXPENSE) {
      name = expCatName;
      icon = expCatIcon;
    } else if (type === TransactionType.INCOME) {
      name = incCatName;
      icon = incCatIcon;
    } else {
      name = invCatName;
      icon = invCatIcon;
    }

    if (!name.trim()) return;

    if (editingCategory && editingCategory.type === type) {
      const updatedCategory: Category = {
        ...editingCategory,
        name: name.trim(),
        icon,
        isAdditionalCard: type === TransactionType.EXPENSE ? expIsAdditionalCard : undefined,
      };
      onUpdateCategory(updatedCategory);
      setCategories(categories.map(c => c.id === updatedCategory.id ? updatedCategory : c));
      setEditingCategory(null);
    } else {
      const newCategory: Category = {
        id: generateId(),
        name: name.trim(),
        icon,
        color: type === TransactionType.INCOME ? '#10b981' : type === TransactionType.INVESTMENT ? '#3b82f6' : '#64748b',
        type,
        isAdditionalCard: type === TransactionType.EXPENSE ? expIsAdditionalCard : undefined,
      };
      const updated = [...categories, newCategory];
      setCategories(updated);
      onSaveCategories(updated);
    }

    // Reset inputs
    if (type === TransactionType.EXPENSE) { setExpCatName(''); setExpIsAdditionalCard(false); }
    if (type === TransactionType.INCOME) setIncCatName('');
    if (type === TransactionType.INVESTMENT) setInvCatName('');
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    if (cat.type === TransactionType.EXPENSE) {
      setExpCatName(cat.name);
      setExpCatIcon(cat.icon || 'utensils');
      setExpIsAdditionalCard(cat.isAdditionalCard || false);
    } else if (cat.type === TransactionType.INCOME) {
      setIncCatName(cat.name);
      setIncCatIcon(cat.icon || 'banknote');
    } else {
      setInvCatName(cat.name);
      setInvCatIcon(cat.icon || 'trending-up');
    }
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setExpCatName('');
    setIncCatName('');
    setInvCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    onDeleteCategory(id);
    setCategories(categories.filter(c => c.id !== id));
    setDeleteConfirmId(null);
    if (editingCategory?.id === id) cancelEditCategory();
  };

  const handleAddSubCategory = () => {
    if (!newSubName.trim() || !selectedCatForSub) return;

    if (editingSubCategory) {
      const updatedSub: SubCategory = {
        ...editingSubCategory,
        name: newSubName.trim(),
        categoryId: selectedCatForSub,
      };
      onUpdateSubCategory(updatedSub);
      setSubCategories(subCategories.map(s => s.id === updatedSub.id ? updatedSub : s));
      setEditingSubCategory(null);
    } else {
      const newSub: SubCategory = {
        id: generateId(),
        name: newSubName.trim(),
        categoryId: selectedCatForSub,
      };
      const updated = [...subCategories, newSub];
      setSubCategories(updated);
      onSaveSubCategories(updated);
    }
    setNewSubName('');
  };

  const handleEditSubCategory = (sub: SubCategory) => {
    setEditingSubCategory(sub);
    setNewSubName(sub.name);
    setSelectedCatForSub(sub.categoryId);
  };

  const cancelEditSubCategory = () => {
    setEditingSubCategory(null);
    setNewSubName('');
  };

  const handleDeleteSubCategory = (id: string) => {
    onDeleteSubCategory(id);
    setSubCategories(subCategories.filter(s => s.id !== id));
    if (editingSubCategory?.id === id) cancelEditSubCategory();
  };

  const IconPicker = ({ currentIcon, setIcon, colorClass }: { currentIcon: string; setIcon: (s: string) => void; colorClass: string }) => (
    <div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5 font-medium">Ícone:</span>
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl custom-scrollbar">
        {AVAILABLE_ICONS.map(({ name, Comp }) => (
          <button
            key={name}
            onClick={() => setIcon(name)}
            type="button"
            className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
              currentIcon === name
                ? `${colorClass} text-white shadow-sm scale-105 ring-2 ring-offset-1`
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
            title={name}
          >
            <Comp size={16} />
          </button>
        ))}
      </div>
    </div>
  );

  const renderCategoryList = (type: TransactionType) => {
    const filtered = categories.filter(c => c.type === type);

    if (filtered.length === 0) {
      return <p className="text-xs text-zinc-400 dark:text-zinc-500 italic p-3 text-center">Nenhuma categoria cadastrada.</p>;
    }

    return (
      <div className="space-y-1.5">
        {filtered.map(cat => {
          const IconComp = AVAILABLE_ICONS.find(i => i.name === cat.icon)?.Comp || Circle;
          const isEditing = editingCategory?.id === cat.id;

          return (
            <div
              key={cat.id}
              className={`flex justify-between items-center px-3 py-2.5 rounded-xl border transition-all ${
                isEditing
                  ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 shadow-xs'
                  : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-800/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${
                  cat.type === TransactionType.INCOME
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : cat.type === TransactionType.INVESTMENT
                    ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                }`}>
                  <IconComp size={15} />
                </div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {cat.name} {isEditing && <span className="text-[10px] text-blue-600 font-normal ml-1">(Editando...)</span>}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {deleteConfirmId === cat.id ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-1">
                    <span className="text-[10px] text-rose-600 font-bold uppercase">Excluir?</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1 rounded-md"
                      title="Confirmar"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1 rounded-md"
                      title="Cancelar"
                    >
                      <AlertCircle size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleEditCategory(cat)}
                      className="text-zinc-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(cat.id)}
                      className="text-zinc-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-2">
      {/* 3 Columns for Category Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DESPESAS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-rose-200/60 dark:border-rose-900/40">
            <ArrowDownCircle size={18} className="text-rose-500" />
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400">Despesas ({categories.filter(c => c.type === TransactionType.EXPENSE).length})</h3>
          </div>

          <div className="bg-rose-50/40 dark:bg-rose-950/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                {editingCategory && editingCategory.type === TransactionType.EXPENSE ? 'Editar Categoria' : 'Nova Categoria'}
              </h4>
              {editingCategory && editingCategory.type === TransactionType.EXPENSE && (
                <button onClick={cancelEditCategory} className="text-xs text-rose-500 hover:underline">Cancelar</button>
              )}
            </div>
            <input
              type="text"
              value={expCatName}
              onChange={(e) => setExpCatName(e.target.value)}
              placeholder="Nome da categoria..."
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 outline-none text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900"
            />
            <IconPicker currentIcon={expCatIcon} setIcon={setExpCatIcon} colorClass="bg-rose-600 ring-rose-300" />
            <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={expIsAdditionalCard} onChange={e => setExpIsAdditionalCard(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-700 text-rose-600 focus:ring-rose-500" />
              Cartão Adicional (Fatura separada)
            </label>
            <button
              onClick={() => handleAddCategory(TransactionType.EXPENSE)}
              className="w-full bg-rose-600 text-white py-2 rounded-xl hover:bg-rose-700 flex items-center justify-center gap-2 font-bold text-xs shadow-xs transition-colors"
            >
              {editingCategory && editingCategory.type === TransactionType.EXPENSE ? <Check size={14} /> : <Plus size={14} />}
              {editingCategory && editingCategory.type === TransactionType.EXPENSE ? 'Atualizar Categoria' : 'Adicionar Despesa'}
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {renderCategoryList(TransactionType.EXPENSE)}
          </div>
        </div>

        {/* RECEITAS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-emerald-200/60 dark:border-emerald-900/40">
            <ArrowUpCircle size={18} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Receitas ({categories.filter(c => c.type === TransactionType.INCOME).length})</h3>
          </div>

          <div className="bg-emerald-50/40 dark:bg-emerald-950/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                {editingCategory && editingCategory.type === TransactionType.INCOME ? 'Editar Categoria' : 'Nova Categoria'}
              </h4>
              {editingCategory && editingCategory.type === TransactionType.INCOME && (
                <button onClick={cancelEditCategory} className="text-xs text-emerald-500 hover:underline">Cancelar</button>
              )}
            </div>
            <input
              type="text"
              value={incCatName}
              onChange={(e) => setIncCatName(e.target.value)}
              placeholder="Nome da categoria..."
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900"
            />
            <IconPicker currentIcon={incCatIcon} setIcon={setIncCatIcon} colorClass="bg-emerald-600 ring-emerald-300" />
            <button
              onClick={() => handleAddCategory(TransactionType.INCOME)}
              className="w-full bg-emerald-600 text-white py-2 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 font-bold text-xs shadow-xs transition-colors"
            >
              {editingCategory && editingCategory.type === TransactionType.INCOME ? <Check size={14} /> : <Plus size={14} />}
              {editingCategory && editingCategory.type === TransactionType.INCOME ? 'Atualizar Categoria' : 'Adicionar Receita'}
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {renderCategoryList(TransactionType.INCOME)}
          </div>
        </div>

        {/* INVESTIMENTOS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-blue-200/60 dark:border-blue-900/40">
            <TrendingUp size={18} className="text-blue-500" />
            <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400">Investimentos ({categories.filter(c => c.type === TransactionType.INVESTMENT).length})</h3>
          </div>

          <div className="bg-blue-50/40 dark:bg-blue-950/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                {editingCategory && editingCategory.type === TransactionType.INVESTMENT ? 'Editar Categoria' : 'Nova Categoria'}
              </h4>
              {editingCategory && editingCategory.type === TransactionType.INVESTMENT && (
                <button onClick={cancelEditCategory} className="text-xs text-blue-500 hover:underline">Cancelar</button>
              )}
            </div>
            <input
              type="text"
              value={invCatName}
              onChange={(e) => setInvCatName(e.target.value)}
              placeholder="Nome da categoria..."
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900"
            />
            <IconPicker currentIcon={invCatIcon} setIcon={setInvCatIcon} colorClass="bg-blue-600 ring-blue-300" />
            <button
              onClick={() => handleAddCategory(TransactionType.INVESTMENT)}
              className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 font-bold text-xs shadow-xs transition-colors"
            >
              {editingCategory && editingCategory.type === TransactionType.INVESTMENT ? <Check size={14} /> : <Plus size={14} />}
              {editingCategory && editingCategory.type === TransactionType.INVESTMENT ? 'Atualizar Categoria' : 'Adicionar Investimento'}
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {renderCategoryList(TransactionType.INVESTMENT)}
          </div>
        </div>
      </div>

      {/* Subcategories Section */}
      <div className="pt-6 border-t border-zinc-200/80 dark:border-zinc-700/80">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Gerenciar Subcategorias</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Associe ramificações às suas categorias de Despesas e Investimentos.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                {editingSubCategory ? 'Editar Subcategoria' : 'Categoria Principal'}
              </label>
              {editingSubCategory && (
                <button onClick={cancelEditSubCategory} className="text-xs text-zinc-500 hover:underline">Cancelar</button>
              )}
            </div>

            <select
              value={selectedCatForSub}
              onChange={(e) => setSelectedCatForSub(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-50"
            >
              <option value="">Selecione uma Categoria...</option>
              {categories.filter(c => c.type === TransactionType.EXPENSE || c.type === TransactionType.INVESTMENT).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type === TransactionType.EXPENSE ? 'Despesa' : 'Investimento'})</option>
              ))}
            </select>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Nome da subcategoria..."
                disabled={!selectedCatForSub}
                className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900"
              />
              <button
                onClick={handleAddSubCategory}
                disabled={!selectedCatForSub || !newSubName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
              >
                {editingSubCategory ? <Check size={14} /> : <Plus size={14} />}
                <span>{editingSubCategory ? 'Salvar' : 'Adicionar'}</span>
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-3">
              Subcategorias Cadastradas {selectedCatForSub && `(${subCategories.filter(s => s.categoryId === selectedCatForSub).length})`}
            </span>
            <div className="max-h-[220px] overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
              {selectedCatForSub ? (
                subCategories.filter(s => s.categoryId === selectedCatForSub).length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6 italic">Nenhuma subcategoria para esta categoria.</p>
                ) : (
                  subCategories.filter(s => s.categoryId === selectedCatForSub).map(sub => {
                    const isEditingSub = editingSubCategory?.id === sub.id;
                    return (
                      <div
                        key={sub.id}
                        className={`flex justify-between items-center px-3 py-2 rounded-xl border transition-all ${
                          isEditingSub
                            ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{sub.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditSubCategory(sub)}
                            className="text-zinc-400 hover:text-blue-600 transition-colors p-1 rounded-md"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubCategory(sub.id)}
                            className="text-zinc-400 hover:text-rose-600 transition-colors p-1 rounded-md"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-xs">
                  Selecione uma categoria à esquerda para ver ou adicionar subcategorias.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
