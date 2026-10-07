import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useSingleFlightMutation } from "@/lib/useSingleFlightMutation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, ChevronsUpDown } from "lucide-react";
import { fmtCurrency, fmtNum } from "../utils/formatNumbers";
import { localDateString } from "@/lib/ingredientTerms";
import {
  datedTermsChanged,
  minEffectiveDate,
  saveIngredientWithDatedChange,
  cancelPendingChange,
} from "@/lib/ingredientChanges";

export default function IngredientDialog({ ingredient, suppliers = [], ingredientCategories = [], open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    purchase_unit: '',
    system_unit: '',
    base_price: '',
    price_per_system: 0,
    current_supplier_id: '',
    current_supplier_name: '',
    waste_pct: '',
    on_hand_qty: '',
    ingredient_category_id: '',
    ingredient_category_name: ''
  });

  const { data: priceHistory = [] } = useQuery({
    queryKey: ['ingredient-price-history', ingredient?.id],
    queryFn: () => ingredient?.id ? base44.entities.Ingredient_Price_History.filter({ ingredient_id: ingredient.id }, '-created_date') : Promise.resolve([]),
    enabled: !!ingredient?.id
  });

  const { data: allDishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    enabled: !!ingredient?.id
  });

  // Dishes whose ingredient list references this ingredient — so changing a
  // price here shows exactly what it affects, right above the history of
  // past changes.
  const dishesUsingIngredient = ingredient?.id
    ? allDishes.filter((dish) => dish.ingredients?.some((item) => item.ingredient_id === ingredient.id))
    : [];

  useEffect(() => {
    if (ingredient) {
      const purchaseUnit = ingredient.purchase_unit || 1;
      const basePrice = ingredient.base_price ?? ingredient.price_per_unit ?? 0;
      setFormData({
        name: ingredient.name || '',
        purchase_unit: purchaseUnit,
        system_unit: ingredient.system_unit || ingredient.unit || '',
        base_price: basePrice,
        price_per_system: purchaseUnit > 0 ? basePrice / purchaseUnit : 0, // Without waste - supplier price
        current_supplier_id: ingredient.current_supplier_id || '',
        current_supplier_name: ingredient.current_supplier_name || '',
        waste_pct: ingredient.waste_pct ?? '',
        on_hand_qty: ingredient.on_hand_qty ?? '',
        ingredient_category_id: ingredient.ingredient_category_id || '',
        ingredient_category_name: ingredient.ingredient_category_name || ''
      });
    }
  }, [ingredient]);

  const calculateActualQuantityAfterWaste = (purchaseUnit, wastePct) => {
    const unit = parseFloat(purchaseUnit) || 0;
    const waste = parseFloat(wastePct) || 0;
    return unit * (1 - waste / 100);
  };

  const calculatePricePerSystem = (basePrice, purchaseUnit) => {
    const price = parseFloat(basePrice) || 0;
    const unit = parseFloat(purchaseUnit) || 0;
    return unit > 0 ? price / unit : 0;
  };

  const handleBasePriceChange = (value) => {
    const price_per_system = calculatePricePerSystem(value, formData.purchase_unit);
    setFormData({...formData, base_price: value, price_per_system});
  };

  const handlePurchaseUnitChange = (value) => {
    const price_per_system = calculatePricePerSystem(formData.base_price, value);
    setFormData({...formData, purchase_unit: value, price_per_system});
  };

  const handleWasteChange = (value) => {
    setFormData({...formData, waste_pct: value});
  };

  const saveMutation = useSingleFlightMutation({
    mutationFn: async ({ data, effectiveFrom }) => {
      const purchaseUnit = parseFloat(data.purchase_unit) || 1;
      const basePrice = parseFloat(data.base_price) || 0;
      const wastePct = data.waste_pct === '' ? 0 : parseFloat(data.waste_pct) || 0;
      const pricePerSystem = purchaseUnit > 0 ? basePrice / purchaseUnit : 0;
      
      const dataToSave = {
        ...data,
        purchase_unit: purchaseUnit,
        base_price: basePrice,
        price_per_system: pricePerSystem,
        waste_pct: wastePct,
        on_hand_qty: data.on_hand_qty === '' ? 0 : parseFloat(data.on_hand_qty) || 0,
        unit: data.system_unit,
        price_per_unit: pricePerSystem,
        last_price_update: new Date().toISOString().split('T')[0]
      };
      // Clean UUID fields - empty strings are invalid for PostgreSQL uuid columns
      ['current_supplier_id', 'ingredient_category_id'].forEach(k => {
        if (!dataToSave[k]) dataToSave[k] = null;
      });
      
      let result;
      if (ingredient?.id && effectiveFrom) {
        // Price and/or supplier changed — applies to events from effectiveFrom
        // on; earlier events keep the old price and supplier.
        result = await saveIngredientWithDatedChange(ingredient, dataToSave, effectiveFrom);
      } else if (ingredient?.id) {
        result = await base44.entities.Ingredient.update(ingredient.id, dataToSave);
      } else {
        result = await base44.entities.Ingredient.create(dataToSave);
      }
      
      return result;
    },
    onSuccess: (_result, { effectiveFrom }) => {
      invalidateCostQueries();
      setDatePrompt(null);
      if (effectiveFrom && effectiveFrom > localDateString()) {
        toast.success(`השינוי נשמר ויכנס לתוקף ב-${effectiveFrom.split('-').reverse().join('/')}`);
      } else {
        toast.success(ingredient ? 'הרכיב עודכן' : 'הרכיב נוצר');
      }
      onClose();
    },
    onError: (err) => {
      toast.error(err?.message || 'שמירת הרכיב נכשלה');
    }
  });

  const invalidateCostQueries = () => {
    ['ingredients', 'ingredient-price-history', 'ingredient-price-changes', 'dishes', 'specialIngredients', 'events']
      .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  // "From which date?" prompt shown when a save changes the price or the
  // supplier: { date, minDate } while open.
  const [datePrompt, setDatePrompt] = useState(null);

  const cancelPending = useSingleFlightMutation({
    mutationFn: cancelPendingChange,
    onSuccess: () => {
      invalidateCostQueries();
      toast.success('השינוי העתידי בוטל');
    },
    onError: (err) => toast.error(err?.message || 'ביטול השינוי נכשל'),
  });

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setFormData({
      ...formData,
      current_supplier_id: supplierId,
      current_supplier_name: supplier?.name || ''
    });
  };

  const handleCategoryChange = (categoryId) => {
    const category = ingredientCategories.find(c => c.id === categoryId);
    setFormData({
      ...formData,
      ingredient_category_id: categoryId,
      ingredient_category_name: category?.name || ''
    });
  };

  const [validationError, setValidationError] = useState('');
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const handleSubmit = (e) => {
    if (saveMutation.isPending) return; // already saving — ignore a second click/Enter
    if (e?.preventDefault) e.preventDefault();
    const errors = [];
    if (!formData.name?.trim()) errors.push('שם');
    if (!formData.system_unit) errors.push('יחידת מדידה');
    if (!formData.purchase_unit || parseFloat(formData.purchase_unit) <= 0) errors.push('כמות יחידת רכישה');
    if (!formData.base_price && formData.base_price !== 0) errors.push('מחיר רכישה מינימום');
    if (errors.length > 0) {
      setValidationError('שדות חובה חסרים: ' + errors.join(', '));
      return;
    }
    setValidationError('');
    if (ingredient?.id && datedTermsChanged(ingredient, formData).any) {
      const minDate = minEffectiveDate(ingredient.id, priceHistory);
      const today = localDateString();
      setDatePrompt({ date: minDate && minDate > today ? minDate : today, minDate });
      return;
    }
    saveMutation.mutate({ data: formData, effectiveFrom: null });
  };

  const confirmDatedSave = () => {
    if (!datePrompt?.date) return;
    if (datePrompt.minDate && datePrompt.date < datePrompt.minDate) return;
    saveMutation.mutate({ data: formData, effectiveFrom: datePrompt.date });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ingredient ? 'עריכת רכיב' : 'רכיב חדש'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>שם *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div>
            <Label>שם ספק</Label>
            <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierPopoverOpen}
                  className="w-full justify-between font-normal"
                >
                  {suppliers.find(s => s.id === formData.current_supplier_id)?.name || (
                    <span className="text-muted-foreground">בחר ספק...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="חיפוש ספק..." />
                  <CommandList>
                    <CommandEmpty>לא נמצאו ספקים</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map(supplier => (
                        <CommandItem
                          key={supplier.id}
                          value={supplier.name}
                          onSelect={() => {
                            handleSupplierChange(supplier.id);
                            setSupplierPopoverOpen(false);
                          }}
                        >
                          {supplier.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>קטגוריה</Label>
            <Select
              value={formData.ingredient_category_id}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר קטגוריה..." />
              </SelectTrigger>
              <SelectContent>
                {ingredientCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>כמות יחידת רכישה *</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="לדוגמה, 15 לשק 15 ק״ג"
                value={formData.purchase_unit}
                onChange={(e) => handlePurchaseUnitChange(e.target.value)}
                required
              />
            </div>

            <div>
              <Label>יחידת מדידה *</Label>
              <Select
                value={formData.system_unit}
                onValueChange={(value) => setFormData({...formData, system_unit: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר יחידה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ק״ג">ק״ג</SelectItem>
                  <SelectItem value="ליטר">ליטר</SelectItem>
                  <SelectItem value="יחידה">יחידה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>מחיר רכישה מינימום (₪) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={formData.base_price}
              onChange={(e) => handleBasePriceChange(e.target.value)}
              placeholder="מחיר כולל ליחידת רכישה"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-stone-700">כמות שמישה (אחרי פחת):</span>
                <span className="text-lg font-bold text-blue-600">
                  {fmtNum(calculateActualQuantityAfterWaste(formData.purchase_unit, formData.waste_pct))} {formData.system_unit || 'unit'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-stone-700">מחיר ל-{formData.system_unit || 'יחידה'}:</span>
                <span className="text-lg font-bold text-emerald-600">{fmtCurrency(formData.price_per_system)}</span>
              </div>
              <p className="text-xs text-stone-600 mt-1">(לפני פחת - מחיר ספק)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>אחוז פחת</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formData.waste_pct}
                onChange={(e) => handleWasteChange(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>כמות במלאי</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formData.on_hand_qty}
                onChange={(e) => setFormData({...formData, on_hand_qty: e.target.value})}
                placeholder="0"
              />
            </div>
          </div>

          {ingredient?.id && dishesUsingIngredient.length > 0 && (
            <div className="pt-4 border-t border-stone-200">
              <Label className="text-base mb-3 block">מנות המשתמשות ברכיב זה</Label>
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מנה</TableHead>
                      <TableHead className="text-right">כמות</TableHead>
                      <TableHead className="text-right">יחידה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dishesUsingIngredient.map((dish) => {
                      const item = dish.ingredients.find((i) => i.ingredient_id === ingredient.id);
                      return (
                        <TableRow key={dish.id}>
                          <TableCell className="text-sm">{dish.name}</TableCell>
                          <TableCell className="text-right text-sm">{fmtNum(item?.qty || 0)}</TableCell>
                          <TableCell className="text-right text-sm">{item?.unit || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {ingredient?.id && priceHistory.length > 0 && (
            <div className="pt-4 border-t border-stone-200">
              <Label className="text-base mb-3 block">היסטוריית מחירים</Label>
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>בתוקף מ-</TableHead>
                      <TableHead>ספק</TableHead>
                      <TableHead className="text-right">מחיר ישן</TableHead>
                      <TableHead className="text-right">מחיר חדש</TableHead>
                      <TableHead className="text-center">שינוי</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...priceHistory]
                      .sort((a, b) => String(b.effective_from || b.change_date).localeCompare(String(a.effective_from || a.change_date)))
                      .map((record) => {
                      const priceDiff = record.new_price_per_system - record.old_price_per_system;
                      const isIncrease = priceDiff > 0;
                      const pending = record.applied === false;
                      return (
                        <TableRow key={record.id} className={pending ? 'bg-amber-50' : ''}>
                          <TableCell className="text-sm">
                            {format(new Date(record.effective_from || record.change_date), 'dd/MM/yyyy')}
                            {pending && (
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-amber-700 font-medium">ממתין</span>
                                <button
                                  type="button"
                                  className="text-xs text-red-600 underline"
                                  disabled={cancelPending.isPending}
                                  onClick={() => cancelPending.mutate(record)}
                                >
                                  ביטול
                                </button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.supplier_changed
                              ? `${record.old_supplier_name || '-'} ← ${record.new_supplier_name || '-'}`
                              : (record.supplier_name || '-')}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {fmtCurrency(record.old_price_per_system)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {fmtCurrency(record.new_price_per_system)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                              isIncrease ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {isIncrease ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {isIncrease ? '+' : ''}{fmtCurrency(Math.abs(priceDiff))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {validationError && (
            <p className="text-sm text-red-600 text-center">{validationError}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="button" onClick={() => handleSubmit()} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {ingredient ? 'עדכון' : 'יצירת'} רכיב
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      <Dialog open={!!datePrompt} onOpenChange={(o) => !o && setDatePrompt(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">החל מאיזה תאריך השינוי רלוונטי?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              המחיר / הספק החדש יחול על אירועים מהתאריך הזה והלאה — גם בעלות האוכל וגם בהזמנות הרכש.
              אירועים לפניו נשארים עם המחיר והספק הקודמים.
            </p>
            <Input
              type="date"
              value={datePrompt?.date || ''}
              min={datePrompt?.minDate || undefined}
              onChange={(e) => setDatePrompt((p) => ({ ...p, date: e.target.value }))}
            />
            {datePrompt?.minDate && (
              <p className="text-xs text-stone-500">
                כבר נרשם שינוי החל מ-{datePrompt.minDate.split('-').reverse().join('/')} — אפשר לבחור מהתאריך הזה והלאה.
              </p>
            )}
            {datePrompt?.date > localDateString() && (
              <p className="text-xs text-amber-700">
                תאריך עתידי: עד אליו הרכיב ממשיך עם המחיר והספק הנוכחיים, והשינוי ייכנס לתוקף אוטומטית.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDatePrompt(null)}>
              ביטול
            </Button>
            <Button
              type="button"
              onClick={confirmDatedSave}
              disabled={saveMutation.isPending || !datePrompt?.date || (datePrompt?.minDate && datePrompt.date < datePrompt.minDate)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saveMutation.isPending ? 'שומר...' : 'שמירה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}