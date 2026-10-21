import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon, SearchIcon, CheckIcon } from './icons';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
  badge?: {
    text?: string;
    className?: string;
  };
}

interface MultiSelectDropdownProps {
  label: string;
  placeholder?: string;
  options: (string | MultiSelectOption)[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  searchable?: boolean;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  placeholder = 'Todos',
  options,
  selectedValues,
  onChange,
  className = '',
  searchable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options to MultiSelectOption[]
  const normalizedOptions: MultiSelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filtered options based on search input
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedOptions.filter((opt) => {
      const optText = opt.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return optText.includes(term);
    });
  }, [normalizedOptions, searchTerm]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleSelectAll = () => {
    // If search is active, select all currently filtered options
    const targetValues = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...selectedValues, ...targetValues]));
    onChange(combined);
  };

  const handleClear = () => {
    if (searchTerm.trim()) {
      // Clear only filtered
      const targetValues = new Set(filteredOptions.map((o) => o.value));
      onChange(selectedValues.filter((v) => !targetValues.has(v)));
    } else {
      onChange([]);
    }
  };

  const isAllSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((opt) => selectedValues.includes(opt.value));

  // Determine button display text
  const getButtonText = () => {
    if (selectedValues.length === 0) {
      return <span className="text-slate-500 font-normal truncate">{placeholder}</span>;
    }
    if (selectedValues.length === 1) {
      const match = normalizedOptions.find((o) => o.value === selectedValues[0]);
      return (
        <span className="text-slate-800 font-semibold truncate">
          {match ? match.label : selectedValues[0]}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 truncate">
        <span className="bg-tcepr-600 text-white font-bold px-1.5 py-0.5 rounded-md text-[10px] leading-none shrink-0 shadow-2xs">
          {selectedValues.length}
        </span>
        <span className="text-slate-800 font-semibold truncate text-xs">
          selecionados
        </span>
      </span>
    );
  };

  return (
    <div className={`space-y-1 relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 tracking-wide uppercase">
          {label}
        </label>
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors font-semibold cursor-pointer"
            title="Limpar seleção deste parâmetro"
          >
            Limpar
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 border rounded-xl bg-white text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-2xs text-left ${
          selectedValues.length > 0
            ? 'border-tcepr-400 ring-1 ring-tcepr-200 bg-tcepr-50/20'
            : 'border-slate-200 hover:border-slate-300'
        } ${isOpen ? 'ring-2 ring-tcepr-500 border-tcepr-500' : ''}`}
      >
        <div className="flex-1 min-w-0">{getButtonText()}</div>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {isOpen ? (
            <ChevronUpIcon className="h-3.5 w-3.5 text-tcepr-600" />
          ) : (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col min-w-[220px] max-w-sm sm:max-w-none animate-in fade-in zoom-in-95 duration-100">
          {/* Search bar inside dropdown (if searchable and > 4 options) */}
          {(searchable || normalizedOptions.length > 5) && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Buscar ${label.toLowerCase()}...`}
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-tcepr-500"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions Header */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-tcepr-700 hover:text-tcepr-900 hover:underline cursor-pointer"
            >
              {isAllSelected ? 'Todos marcados' : 'Marcar todos'}
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
            >
              Desmarcar todos
            </button>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/60 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                Nenhuma opção encontrada
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleOption(opt.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-xs transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-tcepr-50/70 text-tcepr-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700 font-normal'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Custom Checkbox */}
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-tcepr-600 border-tcepr-600 text-white shadow-2xs'
                            : 'border-slate-300 group-hover:border-slate-400 bg-white'
                        }`}
                      >
                        {isSelected && <CheckIcon className="h-3 w-3 stroke-[3]" />}
                      </div>

                      <span className="truncate flex-1">{opt.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            opt.badge.className || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt.badge.text}
                        </span>
                      )}
                      {typeof opt.count === 'number' && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {opt.count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with selected count info */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>
              {selectedValues.length} de {normalizedOptions.length} selecionado(s)
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-0.5 bg-white border border-slate-200 rounded font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-[10px]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
