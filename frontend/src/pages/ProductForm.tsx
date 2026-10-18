import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Save, ArrowLeft, Grid3x3, List } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useProduct } from '@/hooks/products';
import { PageHeader } from '@/components/PageHeader';
import { MediaManager } from '@/components/MediaManager';
import { CustomFieldsEditor } from '@/components/CustomFieldsEditor';
import { VariantGridEditor, type GridPayload } from '@/components/VariantGridEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner, LoadingScreen } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { CustomField } from '@/types';

const variantSchema = z.object({
  _id: z.string().optional(),
  color: z.string().min(1, 'Colour required'),
  size: z.string().min(1, 'Size required'),
  sku: z.string().optional(),
  quantity: z.string().optional(),
  sellingPrice: z.string().optional(),
  costPrice: z.string().optional(),
  lowStockThreshold: z.string().optional(),
});

const schema = z.object({
  designNumber: z.string().min(1, 'Design number is required'),
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional(),
  fabric: z.string().optional(),
  brand: z.string().optional(),
  hsnCode: z.string().optional(),
  unit: z.string().optional(),
  taxRate: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.string().optional(),
  sellingPrice: z.string().optional(),
  variants: z.array(variantSchema).default([]),
});

type FormValues = z.infer<typeof schema>;

const toNum = (s?: string) => {
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
};

const emptyVariant = { color: '', size: '', sku: '', quantity: '0', sellingPrice: '', costPrice: '', lowStockThreshold: '' };

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: product, isLoading } = useProduct(id);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [entryMode, setEntryMode] = useState<'grid' | 'rows'>('grid'); // create only
  const [grid, setGrid] = useState<GridPayload>({ variants: [], salePrice: 0, costPrice: 0 });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { designNumber: '', name: '', unit: 'Pcs', costPrice: '', sellingPrice: '', variants: [{ ...emptyVariant }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  useEffect(() => {
    if (product) {
      reset({
        designNumber: product.designNumber,
        name: product.name,
        category: product.category ?? '',
        fabric: product.fabric ?? '',
        brand: product.brand ?? '',
        hsnCode: product.hsnCode ?? '',
        unit: product.unit ?? 'Pcs',
        taxRate: product.taxRate != null ? String(product.taxRate) : '',
        description: product.description ?? '',
        costPrice: product.costPrice ? String(product.costPrice) : '',
        sellingPrice: product.sellingPrice ? String(product.sellingPrice) : '',
        variants: product.variants.map((v) => ({
          _id: v._id,
          color: v.color,
          size: v.size,
          sku: v.sku,
          quantity: String(v.quantity),
          sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : '',
          costPrice: v.costPrice != null ? String(v.costPrice) : '',
          lowStockThreshold: v.lowStockThreshold != null ? String(v.lowStockThreshold) : '',
        })),
      });
      setCustomFields(product.customFields ?? []);
      setImages(product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []);
      setVideos(product.videos ?? []);
      setEntryMode('rows');
    }
  }, [product, reset]);

  const useGrid = !isEdit && entryMode === 'grid';

  const onSubmit = async (values: FormValues) => {
    const base = {
      designNumber: values.designNumber.trim(),
      name: values.name.trim(),
      category: values.category || undefined,
      fabric: values.fabric || undefined,
      brand: values.brand || undefined,
      hsnCode: values.hsnCode || undefined,
      unit: values.unit?.trim() || 'Pcs',
      taxRate: toNum(values.taxRate) ?? 0,
      description: values.description || undefined,
      imageUrl: images[0] || '',
      images,
      videos,
      customFields: customFields.filter((f) => f.label.trim()).map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
      costPrice: toNum(values.costPrice) ?? grid.costPrice ?? 0,
      sellingPrice: toNum(values.sellingPrice) ?? grid.salePrice ?? 0,
    };

    try {
      if (!isEdit) {
        const variants = useGrid
          ? grid.variants
          : values.variants.map((v) => ({
              color: v.color.trim(),
              size: v.size.trim(),
              sku: v.sku?.trim() || undefined,
              quantity: toNum(v.quantity) ?? 0,
              sellingPrice: toNum(v.sellingPrice),
              costPrice: toNum(v.costPrice),
              lowStockThreshold: toNum(v.lowStockThreshold),
            }));
        if (!variants.length) {
          toast.error('Add at least one colour/size variant');
          return;
        }
        await api.post('/products', { ...base, variants });
      } else {
        await api.patch(`/products/${id}`, base);
        const originalIds = new Set((product?.variants ?? []).map((v) => v._id));
        const currentIds = new Set(values.variants.filter((v) => v._id).map((v) => v._id as string));
        for (const v of values.variants) {
          const body = {
            color: v.color.trim(),
            size: v.size.trim(),
            sku: v.sku?.trim() || undefined,
            quantity: toNum(v.quantity) ?? 0,
            sellingPrice: toNum(v.sellingPrice),
            costPrice: toNum(v.costPrice),
            lowStockThreshold: toNum(v.lowStockThreshold),
          };
          if (v._id) await api.patch(`/products/${id}/variants/${v._id}`, body);
          else await api.post(`/products/${id}/variants`, body);
        }
        for (const oid of originalIds) if (!currentIds.has(oid)) await api.delete(`/products/${id}/variants/${oid}`);
      }
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.reports });
      toast.success(isEdit ? 'Product updated' : 'Product created');
      navigate('/products');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  if (isEdit && isLoading) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit product' : 'New product'}
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="designNumber">Design number *</Label>
              <Input id="designNumber" placeholder="e.g. 132" {...register('designNumber')} />
              {errors.designNumber && <p className="mt-1 text-xs text-destructive">{errors.designNumber.message}</p>}
            </div>
            <div>
              <Label htmlFor="name">Product name *</Label>
              <Input id="name" placeholder="e.g. Zig-Zag Lahenga" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div><Label>Category</Label><Input placeholder="Lehenga, Kurti…" {...register('category')} /></div>
            <div><Label>Brand</Label><Input {...register('brand')} /></div>
            <div><Label>Fabric</Label><Input {...register('fabric')} /></div>
            <div><Label>HSN code</Label><Input placeholder="e.g. 6209" {...register('hsnCode')} /></div>
            <div><Label>Unit</Label><Input placeholder="Pcs" {...register('unit')} /></div>
            <div><Label>Tax rate (GST %)</Label><Input type="number" inputMode="decimal" step="0.01" placeholder="e.g. 12" {...register('taxRate')} /></div>
            <div><Label>Default cost price</Label><Input type="number" inputMode="decimal" step="0.01" {...register('costPrice')} /></div>
            <div><Label>Default selling price</Label><Input type="number" inputMode="decimal" step="0.01" {...register('sellingPrice')} /></div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea {...register('description')} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Photos &amp; videos</CardTitle></CardHeader>
          <CardContent>
            <MediaManager images={images} videos={videos} onChange={(m) => { setImages(m.images); setVideos(m.videos); }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Custom fields</CardTitle></CardHeader>
          <CardContent>
            <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Variants (colour / size / stock)</CardTitle>
            {!isEdit && (
              <div className="inline-flex rounded-lg border p-0.5">
                <button type="button" onClick={() => setEntryMode('grid')} className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium', entryMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                  <Grid3x3 className="h-3.5 w-3.5" /> Grid
                </button>
                <button type="button" onClick={() => setEntryMode('rows')} className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium', entryMode === 'rows' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                  <List className="h-3.5 w-3.5" /> Rows
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {useGrid ? (
              <VariantGridEditor onChange={setGrid} />
            ) : (
              <>
                {fields.map((field, i) => (
                  <div key={field.id} className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-7 sm:items-end">
                    <div><Label className="text-xs">Colour *</Label><Input placeholder="Red" {...register(`variants.${i}.color`)} /></div>
                    <div><Label className="text-xs">Size *</Label><Input placeholder="40" {...register(`variants.${i}.size`)} /></div>
                    <div><Label className="text-xs">Qty</Label><Input type="number" inputMode="numeric" {...register(`variants.${i}.quantity`)} /></div>
                    <div><Label className="text-xs">Sell ₹</Label><Input type="number" inputMode="decimal" placeholder="dflt" {...register(`variants.${i}.sellingPrice`)} /></div>
                    <div><Label className="text-xs">Cost ₹</Label><Input type="number" inputMode="decimal" placeholder="dflt" {...register(`variants.${i}.costPrice`)} /></div>
                    <div><Label className="text-xs">Low at</Label><Input type="number" inputMode="numeric" placeholder="3" {...register(`variants.${i}.lowStockThreshold`)} /></div>
                    <div className="flex items-center">
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => fields.length > 1 && remove(i)} disabled={fields.length <= 1} aria-label="Remove variant">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {errors.variants?.[i] && (
                      <p className="col-span-full text-xs text-destructive">
                        {errors.variants[i]?.color?.message || errors.variants[i]?.size?.message}
                      </p>
                    )}
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => append({ ...emptyVariant })}>
                  <Plus className="h-4 w-4" /> Add variant
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
