import React, { useState, useEffect } from 'react';
import { Category, SubCategory, CreditCard, UserSettings, Transaction, DescriptionMap } from '../types';
import { CreditCardManager } from './CreditCardManager';
import { GeneralSettings } from './settings/GeneralSettings';
import { CategorySettings } from './settings/CategorySettings';
import { MappingSettings } from './settings/MappingSettings';
import { DataSettings } from './settings/DataSettings';
import { CorporateEventsSettings } from './settings/CorporateEventsSettings';
import { Settings as SettingsIcon, LayoutGrid, CreditCard as CreditCardIcon, Replace, Database, TrendingUp, ChevronDown, Check } from 'lucide-react';
import { auth } from '../services/firebase';
import { StorageService, AssetHistory } from '../services/storageService';

interface SettingsProps {
  categories: Category[];
  setCategories: (c: Category[]) => void;
  subCategories: SubCategory[];
  setSubCategories: (s: SubCategory[]) => void;
  creditCards: CreditCard[];
  setCreditCards: (c: CreditCard[]) => void;
  settings: UserSettings;
  setSettings: (s: UserSettings) => void;
  onSaveCategories: (c: Category[]) => void;
  onSaveSubCategories: (s: SubCategory[]) => void;
  onSaveCards: (c: CreditCard[]) => void;
  onSaveSettings: (s: UserSettings) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteSubCategory: (id: string) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCategory: (c: Category) => void;
  onUpdateSubCategory: (s: SubCategory) => void;
  transactions: Transaction[];
  assetHistory?: Record<string, AssetHistory>;
}

export const Settings: React.FC<SettingsProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'cards' | 'mappings' | 'data' | 'assets'>('general');
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [mappings, setMappings] = useState<DescriptionMap>({});

  useEffect(() => {
    let unsubMappings = () => {};

    const unsubAuth = auth.onAuthStateChanged(user => {
      if (user) {
        setUserId(user.uid);
        unsubMappings();
        unsubMappings = StorageService.subscribeToMappings(setMappings);
      } else {
        setMappings({});
      }
    });

    return () => {
      unsubAuth();
      unsubMappings();
    };
  }, []);

  const handleAddCard = (card: CreditCard) => {
    const updated = [...props.creditCards, card];
    props.setCreditCards(updated);
    props.onSaveCards(updated);
  };

  const handleUpdateCard = (card: CreditCard) => {
    const updated = props.creditCards.map(c => c.id === card.id ? card : c);
    props.setCreditCards(updated);
    props.onSaveCards(updated);
  };

  const handleDeleteCard = (id: string) => {
    props.onDeleteCard(id);
    const updated = props.creditCards.filter(c => c.id !== id);
    props.setCreditCards(updated);
  };

  const tabs = [
    { id: 'general', label: 'Geral', icon: SettingsIcon },
    { id: 'categories', label: 'Categorias', icon: LayoutGrid, count: props.categories.length },
    { id: 'cards', label: 'Cartões', icon: CreditCardIcon, count: props.creditCards.length },
    { id: 'mappings', label: 'Mapeamentos', icon: Replace, count: Object.keys(mappings).length },
    { id: 'data', label: 'Dados & Backup', icon: Database },
    { id: 'assets', label: 'Eventos Corporativos', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
            <SettingsIcon size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Configurações
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Personalize categorias, limites orçamentários, cartões e regras do sistema.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Selector (< md) - Sem scroll horizontal */}
      <div className="relative md:hidden w-full">
        {(() => {
          const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];
          const CurrentIcon = currentTab.icon;
          return (
            <>
              <button
                type="button"
                onClick={() => setIsMobileTabMenuOpen(!isMobileTabMenuOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs text-xs font-bold text-zinc-900 dark:text-zinc-100"
              >
                <div className="flex items-center gap-2.5">
                  <CurrentIcon size={16} className="text-blue-600 dark:text-blue-400" />
                  <span>{currentTab.label}</span>
                  {typeof currentTab.count === 'number' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                      {currentTab.count}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-zinc-400">
                  <span className="text-[10px] font-medium text-zinc-400">Alternar</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isMobileTabMenuOpen ? 'rotate-180 text-blue-600' : ''}`}
                  />
                </div>
              </button>

              {isMobileTabMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsMobileTabMenuOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2">
                    {tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(tab.id as any);
                            setIsMobileTabMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              size={16}
                              className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}
                            />
                            <span>{tab.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof tab.count === 'number' && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  isActive
                                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                }`}
                              >
                                {tab.count}
                              </span>
                            )}
                            {isActive && <Check size={14} className="text-blue-600 dark:text-blue-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>

      {/* Modern Segmented Tab Navigation - Desktop (>= md) */}
      <div className="hidden md:flex bg-zinc-100/80 dark:bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 gap-1 overflow-x-auto hide-scrollbar w-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                    : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 md:p-8 shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 min-h-[460px]">
        {activeTab === 'general' && (
          <GeneralSettings
            settings={props.settings}
            setSettings={props.setSettings}
            onSaveSettings={props.onSaveSettings}
            userId={userId}
          />
        )}

        {activeTab === 'categories' && (
          <CategorySettings
            categories={props.categories}
            setCategories={props.setCategories}
            subCategories={props.subCategories}
            setSubCategories={props.setSubCategories}
            onSaveCategories={props.onSaveCategories}
            onSaveSubCategories={props.onSaveSubCategories}
            onDeleteCategory={props.onDeleteCategory}
            onDeleteSubCategory={props.onDeleteSubCategory}
            onUpdateCategory={props.onUpdateCategory}
            onUpdateSubCategory={props.onUpdateSubCategory}
          />
        )}

        {activeTab === 'cards' && (
          <div className="animate-in fade-in slide-in-from-left-2">
            <CreditCardManager
              cards={props.creditCards}
              transactions={props.transactions}
              onAddCard={handleAddCard}
              onUpdateCard={handleUpdateCard}
              onDeleteCard={handleDeleteCard}
            />
          </div>
        )}

        {activeTab === 'mappings' && (
          <MappingSettings
            categories={props.categories}
            subCategories={props.subCategories}
            transactions={props.transactions}
            mappings={mappings}
            setMappings={setMappings}
          />
        )}

        {activeTab === 'data' && (
          <DataSettings
            categories={props.categories}
            subCategories={props.subCategories}
            creditCards={props.creditCards}
            settings={props.settings}
            setSettings={props.setSettings}
            onSaveSettings={props.onSaveSettings}
            transactions={props.transactions}
          />
        )}

        {activeTab === 'assets' && (
          <CorporateEventsSettings
            transactions={props.transactions}
            assetHistory={props.assetHistory}
          />
        )}
      </div>
    </div>
  );
};
