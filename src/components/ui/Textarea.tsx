import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-card transition-colors',
        'placeholder:text-gray-400',
        'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
        className,
      )}
      {...props}
    />
  );
}
