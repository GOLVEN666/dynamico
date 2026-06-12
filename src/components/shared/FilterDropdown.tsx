import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Label for the "no filter" option. */
  allLabel?: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
}: FilterDropdownProps) {
  const items: FilterOption[] = [{ value: '', label: allLabel }, ...options];
  const selected = items.find((o) => o.value === value);
  const isFiltered = value !== '';

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-card transition-colors',
            isFiltered
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
          )}
        >
          <span className="text-gray-500">{label}:</span>
          {selected?.label ?? allLabel}
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      }
    >
      {items.map((option) => (
        <DropdownItem key={option.value} onClick={() => onChange(option.value)}>
          <span className="flex-1">{option.label}</span>
          {option.value === value && <Check className="h-4 w-4 text-brand-600" />}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
