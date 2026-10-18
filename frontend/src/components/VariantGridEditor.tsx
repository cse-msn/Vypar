import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// Ratio-set size groups. Edit here to add more.
const SIZE_GROUPS: Record<string, string[]> = {
  '12-14-16': ['12', '14', '16'],
  '12-15-18': ['12', '15', '18'],
  '12-15-18-21-24': ['12', '15', '18', '21', '24'],
  '20-22-24-26': ['20', '22', '24', '26'],
  '20-24-28-32-36': ['20', '24', '28', '32', '36'],
  'S-M-L-XL': ['S', 'M', 'L', 'XL'],
  'Free size': ['Free'],
};

export interface GridVariant {
  color: string;
  size: string;
  quantity: number;
  sellingPrice?: number;
  costPrice?: number;
}
export interface GridPayload {
  variants: GridVariant[];
  salePrice: number;
  costPrice: number;
}

interface Row {
  color: string;
  cells: Record<string, string>; // size → qty (string so blank = not a variant)
}

export function VariantGridEditor({ onChange }: { onChange: (p: GridPayload) => void }) {
  const [group, setGroup] = useState<string>('20-24-28-32-36');
  const [rows, setRows] = useState<Row[]>([{ color: '', cells: {} }]);
  const [salePrice, setSalePrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const sizes = SIZE_GROUPS[group];

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const variants: GridVariant[] = [];
    for (const r of rows) {
      const color = r.color.trim();
      if (!color) continue;
      for (const size of sizes) {
        const raw = r.cells[size];
        if (raw === undefined || raw === '') continue; // empty cell → not a variant
        variants.push({ color, size, quantity: Math.max(0, Number(raw) || 0), sellingPrice: salePrice || undefined, costPrice: costPrice || undefined });
      }
    }
    onChangeRef.current({ variants, salePrice, costPrice });
  }, [rows, sizes, salePrice, costPrice]);

  const setCell = (ri: number, size: string, val: string) =>
    setRows((prev) => prev.map((r, i) => (i === ri ? { ...r, cells: { ...r.cells, [size]: val.replace(/[^\d]/g, '') } } : r)));
  const setColor = (ri: number, color: string) => setRows((prev) => prev.map((r, i) => (i === ri ? { ...r, color } : r)));
  const addRow = () => setRows((prev) => [...prev, { color: '', cells: {} }]);
  const removeRow = (ri: number) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== ri) : prev));

  const rowTotal = (r: Row) => sizes.reduce((s, sz) => s + (Number(r.cells[sz]) || 0), 0);
  const colTotal = (sz: string) => rows.reduce((s, r) => s + (Number(r.cells[sz]) || 0), 0);
  const grand = rows.reduce((s, r) => s + rowTotal(r), 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Size group</Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(SIZE_GROUPS).map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sale price (all)</Label>
          <Input inputMode="decimal" value={salePrice || ''} onChange={(e) => setSalePrice(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label>Cost price (all)</Label>
          <Input inputMode="decimal" value={costPrice || ''} onChange={(e) => setCostPrice(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left text-xs font-semibold">Colour</th>
              {sizes.map((sz) => (
                <th key={sz} className="p-2 text-center text-xs font-semibold">{sz}</th>
              ))}
              <th className="p-2 text-center text-xs font-semibold">Total</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t">
                <td className="p-1.5">
                  <Input className="h-9 w-28" placeholder="e.g. Red" value={r.color} onChange={(e) => setColor(ri, e.target.value)} />
                </td>
                {sizes.map((sz) => {
                  const empty = !r.cells[sz];
                  return (
                    <td key={sz} className="p-1.5 text-center">
                      <input
                        inputMode="numeric"
                        value={r.cells[sz] ?? ''}
                        onChange={(e) => setCell(ri, sz, e.target.value)}
                        className={`mx-auto h-9 w-16 rounded-md border px-2 text-center text-sm outline-none focus:ring-2 focus:ring-ring ${empty ? 'border-destructive/40 bg-destructive/5' : 'border-input'}`}
                      />
                    </td>
                  );
                })}
                <td className="p-1.5 text-center font-semibold">{rowTotal(r)}</td>
                <td className="p-1.5">
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove colour" onClick={() => removeRow(ri)} disabled={rows.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="p-2 text-xs font-semibold">Totals</td>
              {sizes.map((sz) => (
                <td key={sz} className="p-2 text-center text-xs font-semibold">{colTotal(sz)}</td>
              ))}
              <td className="p-2 text-center text-sm font-bold text-primary">{grand}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="h-4 w-4" /> Add colour
      </Button>
      <p className="text-xs text-muted-foreground">
        Each filled cell becomes a variant (Design + Colour + Size). Leave a cell blank to skip it.
      </p>
    </div>
  );
}
