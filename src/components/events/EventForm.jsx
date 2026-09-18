import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { ArrowLeft, AlertCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import EventStages from "../events/EventStages";
import EventSummary from "../events/EventSummary";

import EventPrintDialog from "../events/EventPrintDialog";
import DepartmentPrintDialog from "../events/DepartmentPrintDialog";
import { fmtCurrency } from "../utils/formatNumbers";
import { calculateAdultCommitment, calculateAdultPortions, parseRangeMax } from "@/lib/dinerCount";
import { applyWasteToValue, wasteLabel } from "@/lib/foodWaste";

export default function EventForm({ event, onClose }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    event_name: '',
    event_date: '',
    event_time: '',
    event_type: 'serving',
    price_per_plate: '',
    total_guests: 0,
    guest_count: 0,
    children_count: '',
    status: 'in_progress',
    notes: '',
    food_cost_sum: 0,
    food_cost_pct: 0
  });

  // Keep guest_count (סה״כ מבוגרים להתחייבות) in sync = total_guests − children_count
  const updateGuestData = (changes) => {
    setFormData((prev) => {
      const next = { ...prev, ...changes };
      next.guest_count = calculateAdultCommitment(next.total_guests, next.children_count);
      return next;
    });
  };

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showDeptPrintDialog, setShowDeptPrintDialog] = useState(false);

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('display_order'),
    initialData: []
  });

  const categories = allCategories.filter((cat) => cat.event_type === formData.event_type);

  const { data: allDishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: []
  });

  const dishes = allDishes.filter((dish) => dish.event_type === formData.event_type);

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: []
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['ingredient_categories'],
    queryFn: () => base44.entities.Ingredient_Category.list(),
    initialData: []
  });

  const { data: specialIngredients = [] } = useQuery({
    queryKey: ['specialIngredients'],
    queryFn: () => base44.entities.SpecialIngredient.list(),
    initialData: []
  });

  const { data: allSubCategories = [] } = useQuery({
    queryKey: ['subCategories'],
    queryFn: () => base44.entities.SubCategory.list('display_order'),
    initialData: []
  });

  const subCategories = allSubCategories.filter(sc => sc.event_type === formData.event_type);

  const isFirstCourseDish = (dish) => {
    const dishCategories = categories.filter((cat) => dish.categories?.includes(cat.id));
    return dishCategories.some((cat) => {
      const name = cat.name.toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
  };

  useEffect(() => {
    if (event?.id) {
      setFormData((prev) => {
        const merged = {
          ...prev,
          ...event,
          price_per_plate: event.price_per_plate != null ? String(event.price_per_plate) : '',
          total_guests: event.total_guests ?? event.guest_count ?? 0,
          children_count: event.children_count ?? ''
        };
        merged.guest_count = calculateAdultCommitment(merged.total_guests, merged.children_count);
        return merged;
      });
    }
  }, [event?.id]);

  const { data: eventDishes = [], refetch: refetchEventDishes } = useQuery({
    queryKey: ["event_form_dishes", event?.id],
    queryFn: () => base44.entities.Events_Dish.filter({ event_id: event.id }),
    enabled: !!event?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });
  
  const [dishesLoadedOnce, setDishesLoadedOnce] = useState(false);
  useEffect(() => {
    if (event?.id && eventDishes.length > 0 && !dishesLoadedOnce) {
      setDishesLoadedOnce(true);
    }
  }, [event?.id, eventDishes.length]);

  const recalcRef = React.useRef(false);

  const getEffectivePlannedCost = useCallback((eventDish) => {
    const guestCount = formData.guest_count || 0;
    // Apply the event-level food reduction (פחת) to the stored cost as well —
    // planned_cost is saved as the pre-reduction base, so reduce it here.
    // The waste bracket is driven by the full committed headcount (guest_count),
    // same as revenue — it's a billing concept, unrelated to who eats what.
    if (eventDish.planned_cost && eventDish.planned_cost > 0) {
      return applyWasteToValue(eventDish.planned_cost, guestCount);
    }
    // If planned_cost is 0, calculate from suggested quantity. Standard dish
    // quantities are planned for the guests actually eating the standard
    // menu — i.e. guest_count minus vegans/glatt, who get separate dishes
    // not counted in this tree (e.g. 300 committed, 20 vegan -> plan for 280).
    const dishGuestCount = calculateAdultPortions(formData.guest_count, formData.vegan_count, formData.glatt_count);
    const dish = dishes.find(d => d.id === eventDish.dish_id);
    if (!dish) return 0;
    const servingPercentage = dish.serving_percentage ?? 100;
    let plannedQty;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = dishGuestCount * (servingPercentage / 100);
      plannedQty = Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    } else {
      const isWedding = formData.event_type === 'wedding';
      const portionFactor = (isFirstCourseDish(dish) && !isWedding) ? 1 / 6 : (dish.portion_factor ?? 1);
      const rawQuantity = dishGuestCount * (servingPercentage / 100) * portionFactor;
      plannedQty = Math.ceil(rawQuantity);
    }
    return applyWasteToValue(plannedQty * (dish.unit_cost || 0), guestCount);
  }, [dishes, formData.guest_count, formData.vegan_count, formData.glatt_count, formData.event_type, categories]);

  const recalculateEventCosts = useCallback(async (overrideRevenue = null, specificEventId = null) => {
    const targetEventId = specificEventId || event?.id;
    if (!targetEventId || recalcRef.current) return;

    recalcRef.current = true;
    setIsRecalculating(true);
    try {
      // Use effective cost that falls back to suggested quantity when planned is 0
      const totalCost = eventDishes.reduce((sum, d) => sum + getEffectivePlannedCost(d), 0);

      const pricePerPlate = overrideRevenue !== null ?
      overrideRevenue :
      parseFloat(formData.price_per_plate) || 0;

      const foodRevenue = pricePerPlate * (formData.guest_count || 0);
      const foodCostPct = foodRevenue > 0 ? totalCost / foodRevenue * 100 : 0;

      setFormData((prev) => ({
        ...prev,
        food_cost_sum: totalCost,
        food_cost_pct: foodCostPct
      }));

      await base44.entities.Event.update(targetEventId, {
        food_cost_sum: totalCost,
        food_cost_pct: foodCostPct,
        food_revenue: foodRevenue,
        price_per_plate: pricePerPlate
      });

      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error) {
      console.error('Error recalculating costs:', error);
    } finally {
      recalcRef.current = false;
      setIsRecalculating(false);
    }
  }, [event?.id, formData.price_per_plate, formData.guest_count, eventDishes, queryClient]);

  const saveEventMutation = useMutation({
    mutationFn: async (data) => {
      const { food_cost_sum, food_cost_pct, ...dataToSave } = data;
      // children_count is an integer column — an untouched field leaves it as '' in
      // form state, which Postgres rejects ("invalid input syntax for type integer").
      dataToSave.children_count = parseInt(dataToSave.children_count, 10) || 0;
      if (event?.id) {
        return await base44.entities.Event.update(event.id, dataToSave);
      } else {
        return await base44.entities.Event.create(dataToSave);
      }
    },
    onSuccess: (savedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(event ? 'Event updated' : 'Event created');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save event');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    saveEventMutation.mutate(formData);
  };

  const handleDishToggle = async (dish, categoryId, checked) => {
    if (!event?.id) {
      toast.error('Save event first');
      return;
    }

    try {
      if (checked) {
        // Standard dish quantities are planned for guests eating the standard
        // menu — guest_count minus vegans/glatt, who get separate dishes not
        // counted in this tree (e.g. 300 committed, 20 vegan -> plan for 280).
        const guestCount = calculateAdultPortions(formData.guest_count, formData.vegan_count, formData.glatt_count);
        const isFirstCourse = isFirstCourseDish(dish);
        const servingPercentage = dish.serving_percentage ?? 100;

        let plannedQty;
        let plannedCost;

        // Check if dish has new preparation_mass_grams and portion_size_grams fields
        if (dish.preparation_mass_grams && dish.portion_size_grams) {
          // New calculation: portions per preparation
          const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
          // Total portions needed (considering serving percentage)
          const totalPortionsNeeded = guestCount * (servingPercentage / 100);
          // Number of preparations needed
          plannedQty = Math.ceil(totalPortionsNeeded / portionsPerPreparation);
          // Cost = preparations × unit_cost
          plannedCost = plannedQty * (dish.unit_cost || 0);
        } else {
          const isWedding = formData.event_type === 'wedding';
          const portionFactor = (isFirstCourse && !isWedding) ? 1 / 6 : (dish.portion_factor ?? 1);
          // Formula: planned_qty = (guest_count × serving_percentage/100 × portion_factor)
          const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
          plannedQty = Math.ceil(rawQuantity);

          if (isFirstCourse) {
            plannedCost = plannedQty * (dish.unit_cost || 0);
          } else {
            const unitCost = dish.unit_cost || 0;
            plannedCost = plannedQty * unitCost;
          }
        }

        await base44.entities.Events_Dish.create({
          event_id: event.id,
          stage_id: null,
          category_id: categoryId,
          dish_id: dish.id,
          dish_name: dish.name,
          planned_qty: plannedQty,
          planned_cost: plannedCost,
          unit: dish.base_unit
        });
      } else {
        const existingDish = eventDishes.find((ed) => ed.dish_id === dish.id);
        if (existingDish?.id) {
          await base44.entities.Events_Dish.delete(existingDish.id);
        }
      }

      await refetchEventDishes();
      await recalculateEventCosts();
    } catch (error) {
      console.error('Error toggling dish:', error);
      toast.error('Failed to update dish');
      await refetchEventDishes();
    }
  };



  // Recalculate when dishes load for the first time or when price/guests change
  useEffect(() => {
    if (event?.id && dishesLoadedOnce && eventDishes.length > 0) {
      const timer = setTimeout(() => {
        const pricePerPlate = parseFloat(formData.price_per_plate);
        if (!isNaN(pricePerPlate)) {
          recalculateEventCosts(pricePerPlate);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.price_per_plate, formData.guest_count, event?.id, dishesLoadedOnce]);

  const handlePrint = () => {
    setShowPrintDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onClose} className="print:hidden">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-stone-900">
              {event ? 'עריכת אירוע' : 'יצירת אירוע חדש'}
            </h1>
            <p className="text-stone-500 mt-1">הגדר פרטי אירוע ובחר מנות לפי קטגוריה</p>
          </div>
        </div>
        {event?.id &&
        <div className="flex gap-2">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="print:hidden">
            <Printer className="w-4 h-4 mr-2" />
            דוח כללי
          </Button>
          <Button
            onClick={() => {
              if (!event.producer_approved) {
                toast.warning("שימו לב: האירוע עדיין לא אושר סופית על ידי המפיק");
              }
              setShowDeptPrintDialog(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 print:hidden">
            <Printer className="w-4 h-4 mr-2" />
            דוחות מחלקות
          </Button>
        </div>
        }
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-stone-200">
            <CardHeader className="border-b border-stone-200 p-5">
              <CardTitle className="text-lg">פרטי אירוע</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>שם האירוע *</Label>
                    <Input
                      value={formData.event_name}
                      onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                      required />
                  </div>
                  <div>
                    <Label>סוג האירוע</Label>
                    <Select
                      value={formData.occasion || ''}
                      onValueChange={(value) => setFormData({ ...formData, occasion: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג אירוע..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="חתונה">חתונה</SelectItem>
                        <SelectItem value="בר מצווה">בר מצווה</SelectItem>
                        <SelectItem value="ברית">ברית</SelectItem>
                        <SelectItem value="אירוע עסקי">אירוע עסקי</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>תאריך *</Label>
                    <Input
                      type="date"
                      value={formData.event_date}
                      onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                      required />

                  </div>

                  <div>
                    <Label>שעה</Label>
                    <Select
                      value={formData.event_time || ''}
                      onValueChange={(value) => setFormData({ ...formData, event_time: value })}>

                      <SelectTrigger>
                        <SelectValue placeholder="בחר שעה..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 48 }, (_, i) => {
                          const hours = Math.floor(i / 2);
                          const minutes = i % 2 === 0 ? '00' : '30';
                          const time = `${hours.toString().padStart(2, '0')}:${minutes}`;
                          return (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>);

                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>סוג הגשה *</Label>
                    <Select
                      value={formData.event_type}
                      onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                      disabled={!!event?.id}>

                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="serving">אירוע הגשה</SelectItem>
                        <SelectItem value="wedding">אירוע הפוכה</SelectItem>
                      </SelectContent>
                    </Select>
                    {event?.id &&
                    <p className="text-xs text-stone-500 mt-1">לא ניתן לשנות סוג הגשה לאחר היצירה</p>
                    }
                  </div>

                  <div className="col-span-2 grid grid-cols-4 gap-4">
                    <div>
                      <Label>סה״כ אורחים *</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formData.total_guests || ''}
                        onChange={(e) => updateGuestData({ total_guests: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        required />
                    </div>
                    <div>
                      <Label>ילדים</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formData.children_count ?? ''}
                        onChange={(e) => updateGuestData({ children_count: parseInt(e.target.value) || 0 })}
                        placeholder="0" />
                    </div>
                    <div>
                      <Label>סה״כ מבוגרים להתחייבות</Label>
                      <Input
                        type="text"
                        value={formData.guest_count || ''}
                        disabled
                        readOnly />
                      {wasteLabel(formData.guest_count) ? (
                        <p className="text-xs text-amber-700 mt-1">
                          פחת אוכל: {wasteLabel(formData.guest_count)}
                        </p>
                      ) : (
                        <p className="text-xs text-stone-400 mt-1">ללא פחת (מתחת ל-150)</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"> מחיר מנה כולל מע״מ (₪)
                      </Label>
                      <Input type="text"
                        inputMode="decimal"
                        value={formData.price_per_plate}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData({ ...formData, price_per_plate: value });
                        }}
                        placeholder="0"
                        required />
                      <p className="text-sm text-stone-500 mt-1">
                        הכנסה מאוכל: {fmtCurrency((parseFloat(formData.price_per_plate) || 0) * (formData.guest_count || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-4 gap-4">
                    <div>
                      <Label>רזרבות</Label>
                      <Input
                        type="text"
                        value={formData.reserves || ''}
                        onChange={(e) => setFormData({ ...formData, reserves: e.target.value })}
                        placeholder="טווח (10-20)" />
                      {(() => {
                        const reservesMax = parseRangeMax(formData.reserves);
                        const guestCount = formData.guest_count || 0;
                        const pct = guestCount > 0 ? (reservesMax / guestCount) * 100 : 0;
                        return pct > 5 ? (
                          <p className="text-xs text-amber-700 mt-1">
                            מעל 5% מהאורחים — יש לבקש אישור מרונן
                          </p>
                        ) : null;
                      })()}
                    </div>
                    <div>
                      <Label>טבעונים</Label>
                      <Input
                        type="text"
                        value={formData.vegan_count || ''}
                        onChange={(e) => setFormData({ ...formData, vegan_count: e.target.value })}
                        placeholder="0 או טווח" />
                    </div>
                    <div>
                      <Label>גלאט</Label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="w-16 shrink-0 text-center font-semibold"
                          value={formData.glatt_count || ''}
                          onChange={(e) => setFormData({ ...formData, glatt_count: e.target.value })}
                          placeholder="0" />
                        <Input
                          type="text"
                          className="flex-1"
                          value={formData.kashrut_note || ''}
                          onChange={(e) => setFormData({ ...formData, kashrut_note: e.target.value })}
                          placeholder="סוג כשרות..." />
                      </div>
                    </div>
                    <div>
                      <Label>מנות מבוגר</Label>
                      <Input
                        type="text"
                        value={calculateAdultPortions(formData.guest_count, formData.vegan_count, formData.glatt_count) || ''}
                        disabled
                        readOnly />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-4 gap-4">
                    <div>
                      <Label>תאורה והגברה (₪)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.lighting_sound_cost ?? ''}
                        onChange={(e) => setFormData({ ...formData, lighting_sound_cost: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        placeholder="0" />
                    </div>
                    <div>
                      <Label>אוכל אפטר (₪)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.after_party_food_cost ?? ''}
                        onChange={(e) => setFormData({ ...formData, after_party_food_cost: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <Label>תוספת נוספת</Label>
                        <Input
                          type="text"
                          value={formData.custom_addition_1_name || ''}
                          onChange={(e) => setFormData({ ...formData, custom_addition_1_name: e.target.value })}
                          placeholder="שם התוספת..." />
                      </div>
                      <div>
                        <Label>מחיר (₪)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.custom_addition_1_amount ?? ''}
                          onChange={(e) => setFormData({ ...formData, custom_addition_1_amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                          placeholder="0" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <Label>תוספת נוספת</Label>
                        <Input
                          type="text"
                          value={formData.custom_addition_2_name || ''}
                          onChange={(e) => setFormData({ ...formData, custom_addition_2_name: e.target.value })}
                          placeholder="שם התוספת..." />
                      </div>
                      <div>
                        <Label>מחיר (₪)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.custom_addition_2_amount ?? ''}
                          onChange={(e) => setFormData({ ...formData, custom_addition_2_amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                          placeholder="0" />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label>הערות</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3} />
                  </div>
                </div>

                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  {event ? 'עדכון אירוע' : 'יצירת אירוע'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {event?.id &&
          <>
              <EventStages
              event={event}
              categories={categories}
              dishes={dishes}
              eventDishes={eventDishes}
              onDishToggle={handleDishToggle}
              onEventDishUpdate={(edId, data) => {
                queryClient.invalidateQueries({ queryKey: ["event_form_dishes", event?.id] });
              }} />



            </>
          }

          {!event?.id &&
          <Card className="border-stone-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">שמור את האירוע תחילה</p>
                    <p className="text-sm text-blue-700 mt-1">
                      צור את האירוע למעלה כדי לבחור מנות לפי קטגוריה
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          }
        </div>

        <div>
          <EventSummary
            pricePerPlate={parseFloat(formData.price_per_plate) || 0}
            foodRevenue={(parseFloat(formData.price_per_plate) || 0) * (formData.guest_count || 0)}
            foodCostSum={formData.food_cost_sum}
            foodCostPct={formData.food_cost_pct}
            guestCount={formData.guest_count}
            eventDishes={eventDishes}
            categories={allCategories}
            dishes={dishes}
            getEffectivePlannedCost={getEffectivePlannedCost}
            eventId={event?.id}
            additions={{
              lighting_sound_cost: formData.lighting_sound_cost,
              after_party_food_cost: formData.after_party_food_cost,
              custom_addition_1_amount: formData.custom_addition_1_amount,
              custom_addition_2_amount: formData.custom_addition_2_amount,
            }} />

        </div>
      </div>

      {event?.id && (
        <>
          <EventPrintDialog
            open={showPrintDialog}
            onOpenChange={setShowPrintDialog}
            event={event}
            eventDishes={eventDishes}
            dishes={dishes}
            categories={categories}
            ingredients={ingredients}
            ingredientCategories={ingredientCategories}
          />
          <DepartmentPrintDialog
            open={showDeptPrintDialog}
            onOpenChange={setShowDeptPrintDialog}
            event={event}
            eventDishes={eventDishes}
            dishes={dishes}
            categories={categories}
            ingredients={ingredients}
            ingredientCategories={ingredientCategories}
            specialIngredients={specialIngredients}
            subCategories={subCategories}
          />
        </>
      )}
    </div>);

}