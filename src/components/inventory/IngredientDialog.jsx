import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtCurrency, fmtNum } from "../utils/formatNumbers";

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

  const saveMutation = useMutation({
    mutationFn: async (data) => {
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
      if (ingredient?.id) {
        // Check if price changed
        const oldBasePrice = parseFloat(ingredient.base_price) || 0;
        const oldPurchaseUnit = parseFloat(ingredient.purchase_unit) || 1;
        const oldPricePerSystem = oldPurchaseUnit > 0 ? oldBasePrice / oldPurchaseUnit : 0;
        
        if (oldBasePrice !== basePrice) {
          // Log price change
          await base44.entities.Ingredient_Price_History.create({
            ingredient_id: ingredient.id,
            ingredient_name: data.name,
            old_price: oldBasePrice,
            new_price: basePrice,
            old_price_per_system: oldPricePerSystem,
            new_price_per_system: pricePerSystem,
            supplier_id: data.current_supplier_id || null,
            supplier_name: data.current_supplier_name || '',
            change_date: new Date().toISOString().split('T')[0]
          });
        }
        
        result = await base44.entities.Ingredient.update(ingredient.id, dataToSave);
      } else {
        result = await base44.entities.Ingredient.create(dataToSave);
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient-price-history'] });
      toast.success(ingredient ? 'הרכיב עודכן' : 'הרכיב נוצר');
      onClose();
    },
    onError: () => {
      toast.error('שמירת הרכיב נכשלה');
    }
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

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    const errors = [];
    if (!formData.name?.trim()) errors.push('שם');
    if (!formData.system_unit) errors.push('יחידת מדידה');
    if (!formData.purchase_unit || parseFloat(formData.purchase_unit) <= 0) errors.push('כמות יחידת רכישה');
    if (!formData.base_price && formData.base_price !== 0) errors.push('מחיר רכישה כולל');
    if (errors.length > 0) {
      setValidationError('שדות חובה חסרים: ' + errors.join(', '));
      return;
    }
    setValidationError('');
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ingredient ? 'עריכת רכיב' : 'רכיב חדש'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Select
              value={formData.current_supplier_id}
              onValueChange={handleSupplierChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר ספק..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>מחיר רכישה כולל (₪) *</Label>
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

          {ingredient?.id && priceHistory.length > 0 && (
            <div className="pt-4 border-t border-stone-200">
              <Label className="text-base mb-3 block">היסטוריית מחירים</Label>
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תאריך</TableHead>
                      <TableHead>ספק</TableHead>
                      <TableHead className="text-right">מחיר ישן</TableHead>
                      <TableHead className="text-right">מחיר חדש</TableHead>
                      <TableHead className="text-center">שינוי</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.map((record) => {
                      const priceDiff = record.new_price_per_system - record.old_price_per_system;
                      const isIncrease = priceDiff > 0;
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="text-sm">
                            {format(new Date(record.change_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.supplier_name || '-'}
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
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              {ingredient ? 'עדכון' : 'יצירת'} רכיב
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}