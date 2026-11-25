import React, { useEffect, useState } from 'react';
import {
  Bike,
  Briefcase,
  Building2,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  HeartPulse,
  Laptop,
  LayoutGrid,
  PawPrint,
  Shirt,
  Smartphone,
  Sofa,
  Tag,
  Wrench,
  Zap,
} from 'lucide-react';
import { MARKETPLACE_CATEGORIES } from '../data/venezuela';
import { BottomSheet } from './BottomSheet';

interface CategoryPickerSheetProps {
  open: boolean;
  onClose: () => void;
  selectedCategory: string;
  selectedSubcategory: string;
  customCategories: string[];
  onSelect: (category: string, subcategory?: string) => void;
}

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'Vehículos y Motos': Car,
  'Teléfonos y Tablets': Smartphone,
  'Computación y Gaming': Laptop,
  'Energía y Respaldo': Zap,
  'Hogar y Electrodomésticos': Sofa,
  'Moda y Calzado': Shirt,
  'Salud y Belleza': HeartPulse,
  Inmuebles: Building2,
  'Herramientas e Industria': Wrench,
  'Deportes y Aire Libre': Bike,
  Mascotas: PawPrint,
  'Servicios y Oficios': Briefcase,
};

export function CategoryPickerSheet({
  open,
  onClose,
  selectedCategory,
  selectedSubcategory,
  customCategories,
  onSelect,
}: CategoryPickerSheetProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setExpandedCategory(
        selectedCategory !== 'Todas' ? selectedCategory : null
      );
    }
  }, [open, selectedCategory]);

  const baseNames = new Set(MARKETPLACE_CATEGORIES.map((c) => c.name));
  const extraCategories = customCategories.filter((c) => c && !baseNames.has(c as never));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Categorías"
      subtitle="Selecciona qué deseas explorar"
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            onSelect('Todas', 'Todas');
            onClose();
          }}
          className={`w-full h-12 px-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-semibold transition-colors ${
            selectedCategory === 'Todas'
              ? 'bg-[#362B3D] text-white'
              : 'bg-zinc-100 hover:bg-zinc-200/75 text-[#141118]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5">
            <LayoutGrid className="w-4 h-4" />
            Todas las categorías
          </span>
          {selectedCategory === 'Todas' && <Check className="w-4 h-4" />}
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MARKETPLACE_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICON_MAP[cat.name] || Tag;
            const isSelected = selectedCategory === cat.name;
            const isExpanded = expandedCategory === cat.name;

            return (
              <div
                key={cat.id}
                className={`rounded-2xl border transition-colors overflow-hidden ${
                  isSelected
                    ? 'border-[#362B3D] bg-[#F6F1FC]/75'
                    : 'border-zinc-200/80 bg-white'
                }`}
              >
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(cat.name, 'Todas');
                      onClose();
                    }}
                    className="flex-1 min-w-0 px-3.5 py-3 flex items-center gap-3 text-left hover:bg-zinc-50/70 transition-colors"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#362B3D] text-white'
                          : 'bg-zinc-100 text-[#362B3D]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#141118] truncate">
                        {cat.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {isSelected && selectedSubcategory !== 'Todas'
                          ? selectedSubcategory
                          : `${cat.subcategories.length} subcategorías`}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategory((prev) => (prev === cat.name ? null : cat.name))
                    }
                    aria-label={`Ver subcategorías de ${cat.name}`}
                    className="w-10 h-10 mr-1 rounded-xl hover:bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(cat.name, 'Todas');
                        onClose();
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                        isSelected && selectedSubcategory === 'Todas'
                          ? 'bg-[#362B3D] text-white'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70'
                      }`}
                    >
                      Todo en {cat.name}
                    </button>
                    {cat.subcategories.map((sub) => {
                      const subActive = isSelected && selectedSubcategory === sub.name;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            onSelect(cat.name, sub.name);
                            onClose();
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                            subActive
                              ? 'bg-[#362B3D] text-white'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {extraCategories.map((catName) => {
            const isSelected = selectedCategory === catName;
            return (
              <button
                key={catName}
                type="button"
                onClick={() => {
                  onSelect(catName, 'Todas');
                  onClose();
                }}
                className={`px-3.5 py-3 rounded-2xl border flex items-center gap-3 text-left transition-colors ${
                  isSelected
                    ? 'border-[#362B3D] bg-[#F6F1FC]/75'
                    : 'border-zinc-200/80 bg-white hover:bg-zinc-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-[#362B3D] text-white' : 'bg-zinc-100 text-[#362B3D]'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#141118] truncate">{catName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
