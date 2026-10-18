import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra text included in the fuzzy search but not shown as the main label. */
  keywords?: string;
  disabled?: boolean;
}

/**
 * Searchable single-select dropdown (type to filter). Options are passed as data;
 * styling mirrors the fancy Select so the two read as one family.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found',
  className,
  id,
  disabled,
  clearable = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Show an inline clear (×) button when a value is selected. */
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'group flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-base shadow-sm ring-offset-background transition-colors md:text-sm',
            'hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('line-clamp-1 text-left', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="flex items-center gap-1">
            {clearable && selected && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 transition-opacity hover:opacity-100"
                role="button"
                aria-label="Clear"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onValueChange('');
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          filter={(_itemValue, search, keywords) => {
            // itemValue is the option id (unique); match the search against the label/keywords.
            const haystack = (keywords?.join(' ') ?? '').toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((opt) => (
              <CommandItem
                key={opt.value || '__all__'}
                value={opt.value || '__all__'}
                keywords={[opt.label, opt.keywords ?? '']}
                disabled={opt.disabled}
                onSelect={() => {
                  onValueChange(opt.value);
                  setOpen(false);
                }}
              >
                <Check className={cn('h-4 w-4 text-primary', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                <span className="line-clamp-1">{opt.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
