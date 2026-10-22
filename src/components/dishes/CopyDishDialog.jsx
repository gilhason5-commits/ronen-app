import React, { useEffect, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const MENUS = { serving: 'אירוע הגשה', wedding: 'אירוע הפוכה', party: 'מסיבה' };
const NO_SUB = '__none__';

// Fields that belong to the row, not the recipe — never copied.
const ROW_FIELDS = ['id', 'created_date', 'updated_date', 'display_order'];

function ChipPicker({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            value === o.id
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
          }`}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

// Duplicates a dish (recipe, quantities, PDFs) into any menu, under a chosen
// category + sub-category. The original is left untouched.
export default function CopyDishDialog({ dish, allCategories = [], allSubCategories = [], open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('serving');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState(NO_SUB);

  useEffect(() => {
    if (!dish) return;
    setName(dish.name || '');
    setEventType(dish.event_type || 'serving');
    setCategoryId((dish.categories || [])[0] || '');
    setSubCategoryId(dish.sub_category_id || NO_SUB);
  }, [dish]);

  const categories = allCategories.filter(c => c.event_type === eventType);
  const subCategories = allSubCategories.filter(sc => sc.event_type === eventType && sc.category_id === categoryId);

  const copy = useMutation({
    mutationFn: () => {
      const data = Object.fromEntries(Object.entries(dish).filter(([k]) => !ROW_FIELDS.includes(k)));
      const sub = subCategories.find(sc => sc.id === subCategoryId);
      return base44.entities.Dish.create({
        ...data,
        name: name.trim(),
        event_type: eventType,
        categories: [categoryId],
        sub_category_id: sub?.id || null,
        sub_category_name: sub?.name || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      toast.success(`המנה שוכפלה ל${MENUS[eventType]}`);
      onOpenChange(false);
    },
    onError: (e) => toast.error('שכפול המנה נכשל: ' + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>שכפול מנה לתפריט — {dish?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>שם המנה החדשה</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>תפריט</Label>
            <Select value={eventType} onValueChange={(v) => { setEventType(v); setCategoryId(''); setSubCategoryId(NO_SUB); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MENUS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Chips, not a dropdown: a menu has 12+ categories and the
              dropdown's fixed height cut the last ones off. */}
          <div>
            <Label>קטגוריה *</Label>
            <ChipPicker
              options={categories}
              value={categoryId}
              onChange={(v) => { setCategoryId(v); setSubCategoryId(NO_SUB); }}
            />
          </div>
          {categoryId && (
            <div>
              <Label>תת קטגוריה</Label>
              <ChipPicker
                options={[{ id: NO_SUB, name: 'ללא' }, ...subCategories]}
                value={subCategoryId}
                onChange={setSubCategoryId}
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!name.trim() || !categoryId || copy.isPending}
            onClick={() => copy.mutate()}
          >
            {copy.isPending ? 'משכפל...' : 'שכפל מנה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
