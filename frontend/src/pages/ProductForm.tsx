import { useEffect, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Save, ArrowLeft, Grid3x3, List } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useProduct } from '@/hooks/products';
import { useSuppliers } from '@/hooks/suppliers';
import { useSizeGroups } from '@/hooks/sizeGroups';
import { useColors } from '@/hooks/colors';
import { useCollections } from '@/hooks/collections';
import { PageHeader } from '@/components/PageHeader';
import { MediaManager } from '@/components/MediaManager';
import { CustomFieldsEditor } from '@/components/CustomFieldsEditor';
import { VariantGridEditor, type GridPayload } from '@/components/VariantGridEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner, LoadingScreen } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { CustomField } from '@/types';

// Product category options shown in the "Category" dropdown.
const CATEGORIES = [
  'Girls ( 6 month to 15 year )',
  'Boys ( 6 month to 15 year )',
  'Kids ( Boys & Girls - Common - Unisex )',
  'Men',
  'Women',
  'Men & Women ( Common - Unisex )',
  'Jewellery & Accessories',
  'Raw Material',
] as const;

// Default B2B / B2C prices derived from the purchase (cost) price — editable afterwards.
const B2B_FROM_PURCHASE = 1.6; // 160%
const B2C_FROM_PURCHASE = 2.1; // 210%

// Apparel categories that get a sub-category dropdown (everything except
// Jewellery & Accessories and Raw Material).
const APPAREL_CATEGORIES: readonly string[] = [
  'Girls ( 6 month to 15 year )',
  'Boys ( 6 month to 15 year )',
  'Kids ( Boys & Girls - Common - Unisex )',
  'Men',
  'Women',
  'Men & Women ( Common - Unisex )',
];

// Sub-category options shown for apparel categories.
const SUB_CATEGORIES = [
  'Chaniya Choli',
  'Kediya',
  'Jacket',
  'Dhoti',
  'Kurta',
  'Blouse',
  'Dupatta',
  'Skirts',
] as const;

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
  subCategory: z.string().optional(),
  sizeGroup: z.string().optional(),
  dupatta: z.string().optional(),
  dupattaHeight: z.string().optional(),
  backOpening: z.string().optional(),
  blouseSize: z.string().optional(),
  gher: z.string().optional(),
  cap: z.string().optional(),
  belt: z.string().optional(),
  sleeves: z.string().optional(),
  backClosure: z.string().optional(),
  bottomType: z.string().optional(),
  b2bPrice: z.string().min(1, 'B2B price is required'),
  b2cPrice: z.string().min(1, 'B2C price is required'),
  fabric: z.string().optional(),
  brand: z.string().optional(),
  hsnCode: z.string().optional(),
  unit: z.string().optional(),
  taxRate: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.string().optional(),
  sellingPrice: z.string().optional(),
  // Shopify-style merchandising / shipping / SEO
  compareAtPrice: z.string().optional(),
  status: z.string().optional(),
  productType: z.string().optional(),
  tags: z.string().optional(),
  weight: z.string().optional(),
  weightUnit: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  dimensionUnit: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  handle: z.string().optional(),
  variants: z.array(variantSchema).default([]),
});

type FormValues = z.infer<typeof schema>;

const toNum = (s?: string) => {
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
};

const emptyVariant = { color: '', size: '', sku: '', quantity: '0', sellingPrice: '', costPrice: '', lowStockThreshold: '' };

// Numeric-only guard for plain text inputs (type="text" so there are no spinner
// arrows). Allow digits and a single decimal point; let editing/navigation keys
// and clipboard/select shortcuts through; block everything else (letters, symbols).
function blockNonNumericKeys(e: KeyboardEvent<HTMLInputElement>) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
  // Allow a single decimal point.
  if (e.key === '.') {
    if (e.currentTarget.value.includes('.')) e.preventDefault();
    return;
  }
  if (!/^\d$/.test(e.key)) e.preventDefault();
}
// Strip any non-numeric characters from a pasted value (allow digits + one dot).
function sanitizeNumericPaste(e: ClipboardEvent<HTMLInputElement>) {
  const text = e.clipboardData.getData('text');
  if (/[^\d.]/.test(text)) e.preventDefault();
}

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: product, isLoading } = useProduct(id);
  const { data: suppliersData } = useSuppliers({ limit: 200 });
  const supplierNames = (suppliersData?.data ?? []).map((s) => s.name).filter(Boolean);
  // Blouse-size options come from the sizes defined across all configured size groups.
  const { data: sizeGroups } = useSizeGroups();
  const blouseSizeOptions = Array.from(new Set((sizeGroups ?? []).flatMap((g) => g.sizes)));
  const sizeGroupOptions = (sizeGroups ?? []).map((g) => g.name);
  const { data: colors } = useColors();
  const colorNames = (colors ?? []).map((c) => c.name);
  const { data: collections } = useCollections();

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [collectionsSel, setCollectionsSel] = useState<string[]>([]);
  const [requiresShipping, setRequiresShipping] = useState(true);
  const [allowBackorder, setAllowBackorder] = useState(false);
  // Once the user edits a price by hand, stop auto-deriving it from the purchase price.
  const [b2bTouched, setB2bTouched] = useState(false);
  const [b2cTouched, setB2cTouched] = useState(false);
  const [entryMode, setEntryMode] = useState<'grid' | 'rows'>('grid'); // create only
  const [grid, setGrid] = useState<GridPayload>({ variants: [], salePrice: 0, costPrice: 0, sizeGroup: '' });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { designNumber: '', name: '', unit: 'Pcs', costPrice: '', sellingPrice: '', b2bPrice: '', b2cPrice: '', status: 'active', weightUnit: 'kg', dimensionUnit: 'cm', variants: [{ ...emptyVariant }] },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'variants' });

  useEffect(() => {
    if (product) {
      reset({
        designNumber: product.designNumber,
        name: product.name,
        category: product.category ?? '',
        subCategory: product.subCategory ?? '',
        sizeGroup: product.sizeGroup ?? '',
        dupatta: product.dupatta ?? '',
        dupattaHeight: product.dupattaHeight != null ? String(product.dupattaHeight) : '',
        backOpening: product.backOpening ?? '',
        blouseSize: product.blouseSize ?? '',
        gher: product.gher != null ? String(product.gher) : '',
        cap: product.cap ?? '',
        belt: product.belt ?? '',
        sleeves: product.sleeves ?? '',
        backClosure: product.backClosure ?? '',
        bottomType: product.bottomType ?? '',
        b2bPrice: product.b2bPrice != null ? String(product.b2bPrice) : '',
        b2cPrice: product.b2cPrice != null ? String(product.b2cPrice) : '',
        fabric: product.fabric ?? '',
        brand: product.brand ?? '',
        hsnCode: product.hsnCode ?? '',
        unit: product.unit ?? 'Pcs',
        taxRate: product.taxRate != null ? String(product.taxRate) : '',
        description: product.description ?? '',
        costPrice: product.costPrice ? String(product.costPrice) : '',
        sellingPrice: product.sellingPrice ? String(product.sellingPrice) : '',
        compareAtPrice: product.compareAtPrice != null ? String(product.compareAtPrice) : '',
        status: product.status ?? 'active',
        productType: product.productType ?? '',
        tags: (product.tags ?? []).join(', '),
        weight: product.weight != null ? String(product.weight) : '',
        weightUnit: product.weightUnit ?? 'kg',
        length: product.length != null ? String(product.length) : '',
        width: product.width != null ? String(product.width) : '',
        height: product.height != null ? String(product.height) : '',
        dimensionUnit: product.dimensionUnit ?? 'cm',
        countryOfOrigin: product.countryOfOrigin ?? '',
        seoTitle: product.seoTitle ?? '',
        seoDescription: product.seoDescription ?? '',
        handle: product.handle ?? '',
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
      setCollectionsSel((product.collections ?? []).map((c) => (typeof c === 'string' ? c : c._id)));
      setRequiresShipping(product.requiresShipping ?? true);
      setAllowBackorder(product.allowBackorder ?? false);
      // Existing product already has its own B2B/B2C — don't auto-overwrite them from purchase price.
      if (product.b2bPrice != null) setB2bTouched(true);
      if (product.b2cPrice != null) setB2cTouched(true);
      setEntryMode('rows');
    }
  }, [product, reset]);

  const useGrid = !isEdit && entryMode === 'grid';

  // In grid mode the variant matrix is built by VariantGridEditor, so clear the form's
  // field-array (otherwise its hidden empty row fails colour/size validation and silently
  // blocks submit). Rows mode needs at least one row.
  useEffect(() => {
    if (useGrid) {
      if (fields.length) replace([]);
    } else if (!isEdit && !fields.length) {
      replace([{ ...emptyVariant }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGrid]);

  // Show the sub-category dropdown only for apparel categories.
  const selectedCategory = watch('category');
  const showSubCategory = !!selectedCategory && APPAREL_CATEGORIES.includes(selectedCategory);

  // Surface validation failures (otherwise a hidden invalid field makes "Create" do nothing).
  const firstError = (o: unknown): string | undefined => {
    if (!o || typeof o !== 'object') return undefined;
    const rec = o as Record<string, unknown>;
    if (typeof rec.message === 'string' && rec.message) return rec.message;
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'ref') continue;
      const m = firstError(v);
      if (m) return m;
    }
    return undefined;
  };
  const onInvalid = (errs: typeof errors) =>
    toast.error(firstError(errs) ?? 'Please fill the required fields');

  const onSubmit = async (values: FormValues) => {
    const isApparel = !!values.category && APPAREL_CATEGORIES.includes(values.category);
    const base = {
      designNumber: values.designNumber.trim(),
      name: values.name.trim(),
      category: values.category || undefined,
      // Sub-category and the apparel attributes below only apply to apparel categories.
      subCategory: (isApparel && values.subCategory) || undefined,
      dupatta: (isApparel && values.dupatta) || undefined,
      dupattaHeight: isApparel ? toNum(values.dupattaHeight) : undefined,
      backOpening: (isApparel && values.backOpening) || undefined,
      blouseSize: (isApparel && values.blouseSize) || undefined,
      gher: isApparel ? toNum(values.gher) : undefined,
      cap: (isApparel && values.cap) || undefined,
      belt: (isApparel && values.belt) || undefined,
      sleeves: (isApparel && values.sleeves) || undefined,
      backClosure: (isApparel && values.backClosure) || undefined,
      bottomType: (isApparel && values.bottomType) || undefined,
      b2bPrice: toNum(values.b2bPrice),
      b2cPrice: toNum(values.b2cPrice),
      // In grid-create mode the grid's selected group is the size group; otherwise the dropdown.
      sizeGroup: (useGrid ? grid.sizeGroup : values.sizeGroup) || undefined,
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
      // Retail (selling) price mirrors B2C — the "Selling price" field was removed, so B2C is
      // the customer price used on cards, billing defaults and reports.
      sellingPrice: toNum(values.b2cPrice) ?? toNum(values.sellingPrice) ?? grid.salePrice ?? 0,
      // Merchandising / shipping / SEO
      compareAtPrice: toNum(values.compareAtPrice),
      status: values.status || 'active',
      productType: values.productType || undefined,
      tags: (values.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      collections: collectionsSel,
      allowBackorder,
      requiresShipping,
      weight: toNum(values.weight),
      weightUnit: values.weightUnit || 'kg',
      length: toNum(values.length),
      width: toNum(values.width),
      height: toNum(values.height),
      dimensionUnit: values.dimensionUnit || 'cm',
      countryOfOrigin: values.countryOfOrigin || undefined,
      seoTitle: values.seoTitle || undefined,
      seoDescription: values.seoDescription || undefined,
      handle: values.handle || undefined,
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

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Supplier</Label>
              <Controller
                control={control}
                name="brand"
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {/* Keep an existing product's saved value selectable even if it's not a current supplier. */}
                      {field.value && !supplierNames.includes(field.value) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                      {supplierNames.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
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
            <div>
              <Label>Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {/* Keep an existing product's legacy category selectable even if it's not in the list. */}
                      {field.value && !CATEGORIES.includes(field.value as (typeof CATEGORIES)[number]) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {showSubCategory && (
              <div>
                <Label>Sub-category</Label>
                <Controller
                  control={control}
                  name="subCategory"
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                      <SelectContent>
                        {/* Keep an existing product's saved value selectable even if it's not in the list. */}
                        {field.value && !SUB_CATEGORIES.includes(field.value as (typeof SUB_CATEGORIES)[number]) && (
                          <SelectItem value={field.value}>{field.value}</SelectItem>
                        )}
                        {SUB_CATEGORIES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            {showSubCategory && (
              <>
                <div>
                  <Label>Dupatta</Label>
                  <Controller
                    control={control}
                    name="dupatta"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Dupatta height</Label>
                  <Input type="text" inputMode="decimal" placeholder="0" onKeyDown={blockNonNumericKeys} onPaste={sanitizeNumericPaste} {...register('dupattaHeight')} />
                </div>
                <div>
                  <Label>Back opening</Label>
                  <Controller
                    control={control}
                    name="backOpening"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                          <SelectItem value="Backless">Backless</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Blouse size</Label>
                  <Controller
                    control={control}
                    name="blouseSize"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                        <SelectContent>
                          {/* Keep an existing product's saved value selectable even if it's no longer in any size group. */}
                          {field.value && !blouseSizeOptions.includes(field.value) && (
                            <SelectItem value={field.value}>{field.value}</SelectItem>
                          )}
                          {blouseSizeOptions.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Gher</Label>
                  <Input type="text" inputMode="decimal" placeholder="0" onKeyDown={blockNonNumericKeys} onPaste={sanitizeNumericPaste} {...register('gher')} />
                </div>
                <div>
                  <Label>Cap?</Label>
                  <Controller
                    control={control}
                    name="cap"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Belt?</Label>
                  <Controller
                    control={control}
                    name="belt"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Sleeves?</Label>
                  <Controller
                    control={control}
                    name="sleeves"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full">Full</SelectItem>
                          <SelectItem value="Half">Half</SelectItem>
                          <SelectItem value="Sleeveless">Sleeveless</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Back knot or hook?</Label>
                  <Controller
                    control={control}
                    name="backClosure"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Knot">Knot</SelectItem>
                          <SelectItem value="Hook">Hook</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Pant / Dhoti?</Label>
                  <Controller
                    control={control}
                    name="bottomType"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pant">Pant</SelectItem>
                          <SelectItem value="Dhoti">Dhoti</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </>
            )}
            {!useGrid && (
              <div>
                <Label>Size group</Label>
                <Controller
                  control={control}
                  name="sizeGroup"
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select size group" /></SelectTrigger>
                      <SelectContent>
                        {/* Keep an existing product's saved value selectable even if it's not in the list. */}
                        {field.value && !sizeGroupOptions.includes(field.value) && (
                          <SelectItem value={field.value}>{field.value}</SelectItem>
                        )}
                        {sizeGroupOptions.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            <div><Label>Fabric</Label><Input {...register('fabric')} /></div>
            <div><Label>HSN code</Label><Input placeholder="e.g. 6209" {...register('hsnCode')} /></div>
            <div><Label>Unit</Label><Input placeholder="Pcs" {...register('unit')} /></div>
            <div><Label>Tax rate (GST %)</Label><Input type="number" inputMode="decimal" step="0.01" placeholder="e.g. 12" {...register('taxRate')} /></div>
            <div>
              <Label>Purchase price</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                onKeyDown={blockNonNumericKeys}
                onPaste={sanitizeNumericPaste}
                {...register('costPrice', {
                  onChange: (e) => {
                    // Auto-fill B2B (160%) and B2C (190%) from the purchase price, until each is edited by hand.
                    const cost = Number(String(e.target.value).replace(/[^\d.]/g, ''));
                    if (!b2bTouched) setValue('b2bPrice', cost > 0 ? String(Math.round(cost * B2B_FROM_PURCHASE)) : '');
                    if (!b2cTouched) setValue('b2cPrice', cost > 0 ? String(Math.round(cost * B2C_FROM_PURCHASE)) : '');
                  },
                })}
              />
            </div>
            <div>
              <Label>B2B price *</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                onKeyDown={blockNonNumericKeys}
                onPaste={sanitizeNumericPaste}
                {...register('b2bPrice', { onChange: () => setB2bTouched(true) })}
              />
              {errors.b2bPrice && <p className="mt-1 text-xs text-destructive">{errors.b2bPrice.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Auto-set to 160% of purchase price — edit if needed.</p>
            </div>
            <div>
              <Label>B2C price *</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                onKeyDown={blockNonNumericKeys}
                onPaste={sanitizeNumericPaste}
                {...register('b2cPrice', { onChange: () => setB2cTouched(true) })}
              />
              {errors.b2cPrice && <p className="mt-1 text-xs text-destructive">{errors.b2cPrice.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Auto-set to 210% of purchase price — edit if needed.</p>
            </div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea {...register('description')} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Organisation &amp; pricing</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value || 'active'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active (visible online)</SelectItem>
                      <SelectItem value="draft">Draft (hidden)</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">Only Active products show on the online store.</p>
            </div>
            <div><Label>Product type</Label><Input placeholder="e.g. Lehenga" {...register('productType')} /></div>
            <div>
              <Label>Compare-at price (MRP) ₹</Label>
              <Input type="text" inputMode="decimal" placeholder="struck-through price" onKeyDown={blockNonNumericKeys} onPaste={sanitizeNumericPaste} {...register('compareAtPrice')} />
              <p className="mt-1 text-xs text-muted-foreground">Shows as a strikethrough next to the selling price.</p>
            </div>
            <div><Label>Tags (comma-separated)</Label><Input placeholder="festive, new, cotton" {...register('tags')} /></div>
            <div className="sm:col-span-2">
              <Label>Collections</Label>
              {collections?.length ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {collections.map((c) => {
                    const on = collectionsSel.includes(c._id);
                    return (
                      <button
                        type="button"
                        key={c._id}
                        onClick={() => setCollectionsSel(on ? collectionsSel.filter((x) => x !== c._id) : [...collectionsSel, c._id])}
                        className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}
                      >
                        {c.title}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No collections yet — create them under Collections.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Shipping</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={requiresShipping} onChange={(e) => setRequiresShipping(e.target.checked)} className="h-4 w-4" />
              This is a physical product (requires shipping)
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={allowBackorder} onChange={(e) => setAllowBackorder(e.target.checked)} className="h-4 w-4" />
              Continue selling when out of stock (backorders)
            </label>
            {requiresShipping && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1"><Label>Weight</Label><Input type="text" inputMode="decimal" placeholder="0" onKeyDown={blockNonNumericKeys} onPaste={sanitizeNumericPaste} {...register('weight')} /></div>
                  <div className="w-24">
                    <Label>Unit</Label>
                    <Controller control={control} name="weightUnit" render={({ field }) => (
                      <Select value={field.value || 'kg'} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="g">g</SelectItem></SelectContent>
                      </Select>
                    )} />
                  </div>
                </div>
                <div><Label>Country of origin</Label><Input placeholder="India" {...register('countryOfOrigin')} /></div>
                <div className="sm:col-span-2 grid grid-cols-4 gap-2">
                  <div><Label className="text-xs">Length</Label><Input type="text" inputMode="decimal" placeholder="L" onKeyDown={blockNonNumericKeys} onPaste={sanitizeNumericPaste} {...register('length')} /></div>
                  <div><Label className="text-xs">Width</Label><Input type="text" inputMode="decimal" placeholder="W" onKeyDown={blockNonNumericKeys} onPaste={sanitizeNumericPaste} {...register('width')} /></div>
                  <div><Label className="text-xs">Height</Label><Input type="text" inputMode="decimal" placeholder="H" onKeyDown={blockNonNumericKeys} onPaste={sanitizeNumericPaste} {...register('height')} /></div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Controller control={control} name="dimensionUnit" render={({ field }) => (
                      <Select value={field.value || 'cm'} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cm">cm</SelectItem><SelectItem value="in">in</SelectItem></SelectContent>
                      </Select>
                    )} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Search engine listing (SEO)</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div><Label>Page title</Label><Input placeholder="Defaults to the product name" {...register('seoTitle')} /></div>
            <div><Label>Meta description</Label><Textarea rows={2} placeholder="Short description shown in Google results" {...register('seoDescription')} /></div>
            <div><Label>URL handle</Label><Input placeholder="auto-generated from the name" {...register('handle')} /></div>
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
                    <div>
                      <Label className="text-xs">Colour *</Label>
                      <Controller
                        control={control}
                        name={`variants.${i}.color`}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder="Colour" /></SelectTrigger>
                            <SelectContent>
                              {field.value && !colorNames.includes(field.value) && <SelectItem value={field.value}>{field.value}</SelectItem>}
                              {colorNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
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
