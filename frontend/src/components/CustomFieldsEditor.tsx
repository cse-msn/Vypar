import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { CustomField } from '@/types';

/** Free label→value attributes (Material, Work, Brand, Occasion…). */
export function CustomFieldsEditor({
  value,
  onChange,
}: {
  value: CustomField[];
  onChange: (v: CustomField[]) => void;
}) {
  const add = () => onChange([...value, { label: '', value: '' }]);
  const update = (i: number, patch: Partial<CustomField>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {value.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder="Label (e.g. Material)" value={f.label} onChange={(e) => update(i, { label: e.target.value })} />
          <Input placeholder="Value (e.g. Cotton)" value={f.value} onChange={(e) => update(i, { value: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove field" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" /> Add field
      </Button>
    </div>
  );
}
