import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Debounced search box — onChange fires 300ms after typing stops. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className }: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const debounced = useDebounce(local);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    setLocal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-9 w-full rounded-lg border border-gray-300 bg-white pr-8 pl-9 text-sm text-gray-900 shadow-card transition-colors',
          'placeholder:text-gray-400',
          'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none',
        )}
      />
      {local && (
        <button
          type="button"
          onClick={() => setLocal('')}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
