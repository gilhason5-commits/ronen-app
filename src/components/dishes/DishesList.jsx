import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { isFixedPerEventCategory, getFixedEventQty } from "@/lib/fixedEventItems";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, UtensilsCrossed, CalendarSearch, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import DishQtyModeFields from "./DishQtyModeFields";
import { isExplicitQtyMode, qtyModeLabel } from "@/lib/plannedDishQty";
import { Skeleton } from "@/components/ui/skeleton";
import DishPrintButton from "./DishPrintButton";
import DishEventsDialog from "./DishEventsDialog";

export default function DishesList({ dishes, isLoading, onEdit, categories = [], ingredients = [], specialIngredients = [] }) {
  const [eventsDish, setEventsDish] = useState(null);

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (dishes.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">לא נמצאו מנות</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {dishes.map((dish) => {
        const dishCategories = categories.filter(cat => 
          dish.categories?.includes(cat.id)
        );
        
        const isFirstCourse = dishCategories.some(cat => {
          const name = cat.name.toLowerCase();
          return name.includes('first course') || name.includes('מנה ראשונה');
        });
        
        const isFixedItem = dishCategories.some(isFixedPerEventCategory);

        const pricePerGuest = dish.price_per_guest ?? (dish.unit_cost || 0) / 6;

        return (
          <Card key={dish.id} className="border-stone-200 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-stone-900">{dish.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dishCategories.map(cat => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                    {!dish.active && (
                      <Badge variant="outline" className="text-xs bg-stone-100">
                        לא פעיל
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {dish.description && (
                <p className="text-sm text-stone-600 mb-3 line-clamp-2">{dish.description}</p>
              )}

              <div className="space-y-2 mb-4">
                {!isFixedItem && (
                  <div className="flex justify-between items-center p-2 bg-stone-50 rounded">
                    <span className={`text-sm ${isExplicitQtyMode(dish) ? 'font-medium text-blue-700' : 'text-stone-600'}`}>
                      {qtyModeLabel(dish)}
                    </span>
                    <QtyModePopover dish={dish} />
                  </div>
                )}
                {isFixedItem ? (
                  <FixedQtyEditor dish={dish} />
                ) : isFirstCourse ? (
                  <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                    <span className="text-sm text-stone-600">מחיר לסועד:</span>
                    <span className="font-semibold text-emerald-700">₪{pricePerGuest.toFixed(2)}</span>
                  </div>
                ) : (
                  dish.avg_portion_per_guest > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">מנה לסועד:</span>
                      <span className="font-medium">{dish.avg_portion_per_guest}</span>
                    </div>
                  )
                )}

                <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                  <span className="text-sm text-stone-600">עלות כוללת למנה:</span>
                  <span className="font-semibold text-emerald-700">₪{dish.unit_cost?.toFixed(2) || '0.00'}</span>
                </div>

                {dish.ingredients?.length > 0 && (
                  <p className="text-xs text-stone-500">
                    {dish.ingredients.length} מצרכים
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(dish)}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  עריכת מנה
                </Button>
                <DishPrintButton 
                  dish={dish} 
                  ingredients={ingredients} 
                  specialIngredients={specialIngredients} 
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => setEventsDish(dish)}
              >
                <CalendarSearch className="w-3 h-3 mr-2" />
                מופיע באירועים
              </Button>
            </CardContent>
          </Card>
        );
      })}
      <DishEventsDialog
        dish={eventsDish}
        open={!!eventsDish}
        onOpenChange={(open) => !open && setEventsDish(null)}
      />
    </div>
  );
}
// Fixed per-event items are quantified per event, not per guest: edit
// fixed_event_qty right on the card.
function FixedQtyEditor({ dish }) {
  const queryClient = useQueryClient();
  const current = getFixedEventQty(dish);
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const qty = parseFloat(value);
    if (!Number.isFinite(qty) || qty < 0) {
      setValue(String(current));
      return;
    }
    if (qty === current && dish.fixed_event_qty != null) return;
    setSaving(true);
    try {
      await base44.entities.Dish.update(dish.id, { fixed_event_qty: qty });
      await queryClient.invalidateQueries({ queryKey: ['dishes'] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
      <span className="text-sm text-stone-600">כמות לאירוע:</span>
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-20 h-7 text-center text-sm"
      />
    </div>
  );
}

// Card shortcut for how the dish's event quantity is set (serving % / fixed
// per event / per N guests) — saves straight to the dish.
function QtyModePopover({ dish }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const openChange = (o) => {
    if (o) {
      setDraft({
        qty_mode: dish.qty_mode || 'percent',
        serving_percentage: dish.serving_percentage ?? 100,
        fixed_event_qty: dish.fixed_event_qty ?? '',
        per_guests_qty: dish.per_guests_qty ?? '',
        per_guests_base: dish.per_guests_base ?? 100,
      });
    }
    setOpen(o);
  };

  const save = async () => {
    const clean = (v) => (v === '' || v == null ? null : parseFloat(v));
    const data = {
      qty_mode: draft.qty_mode,
      serving_percentage: clean(draft.serving_percentage) ?? 100,
      fixed_event_qty: clean(draft.fixed_event_qty),
      per_guests_qty: clean(draft.per_guests_qty),
      per_guests_base: clean(draft.per_guests_base) ?? 100,
    };
    if (data.qty_mode === 'fixed' && data.fixed_event_qty == null) return toast.error('יש להזין כמות לאירוע');
    if (data.qty_mode === 'per_guests' && data.per_guests_qty == null) return toast.error('יש להזין כמות');
    setSaving(true);
    try {
      await base44.entities.Dish.update(dish.id, data);
      await queryClient.invalidateQueries({ queryKey: ['dishes'] });
      setOpen(false);
      toast.success('הכמות עודכנה');
    } catch (e) {
      toast.error(`שגיאה: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-blue-700" title="אופן חישוב הכמות">
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" dir="rtl">
        <p className="font-semibold text-sm mb-2">אופן חישוב הכמות באירוע</p>
        <DishQtyModeFields value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>ביטול</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={save}>שמור</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
