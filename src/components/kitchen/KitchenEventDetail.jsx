import React from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import DepartmentPrintDialog from "@/components/events/DepartmentPrintDialog";

export default function KitchenEventDetail({ event }) {
  const [showDeptPrint, setShowDeptPrint] = React.useState(false);

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('display_order'),
    initialData: []
  });

  const { data: allDishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: []
  });

  const { data: eventDishes = [] } = useQuery({
    queryKey: ['eventDishes', event.id],
    queryFn: () => base44.entities.Events_Dish.filter({ event_id: event.id }),
    initialData: []
  });

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

  const { data: subCategories = [] } = useQuery({
    queryKey: ['subCategories'],
    queryFn: () => base44.entities.SubCategory.list('display_order'),
    initialData: []
  });

  const categories = allCategories.filter(c => c.event_type === event.event_type);
  const dishes = allDishes.filter(d => d.event_type === event.event_type);

  const isFirstCourseDish = (dish) => {
    const dishCategories = categories.filter(cat => dish.categories?.includes(cat.id));
    return dishCategories.some(cat => {
      const name = cat.name.toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
  };

  const calculateSuggestedQuantity = (dish) => {
    const guestCount = event?.guest_count || 0;
    const servingPercentage = dish.serving_percentage ?? 100;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = guestCount * (servingPercentage / 100);
      return Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    }
    const portionFactor = isFirstCourseDish(dish) ? 1/6 : (dish.portion_factor ?? 1);
    const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
    return Math.ceil(rawQuantity);
  };

  const sortedCategories = [...categories]
    .filter(cat => cat.name !== 'תת מנה')
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowDeptPrint(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Printer className="w-4 h-4 ml-2" />
          הדפסת דוחות מחלקות
        </Button>
      </div>

      {sortedCategories.map(category => {
        const categoryDishes = eventDishes
          .filter(ed => ed.category_id === category.id)
          .map(ed => {
            const dish = dishes.find(d => d.id === ed.dish_id);
            if (!dish) return null;
            const qty = ed.planned_qty || calculateSuggestedQuantity(dish);
            return { ...dish, planned_qty: qty };
          })
          .filter(Boolean);

        if (categoryDishes.length === 0) return null;

        return (
          <Card key={category.id} className="border-stone-200">
            <CardHeader className="bg-stone-50 border-b border-stone-200 p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-stone-900">{category.name}</CardTitle>
                <Badge variant="outline" className="text-xs">{categoryDishes.length} מנות</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/50">
                    <th className="text-right p-3 font-medium text-stone-600">שם המנה</th>
                    <th className="text-center p-3 font-medium text-stone-600 w-24">כמות</th>
                    <th className="text-center p-3 font-medium text-stone-600 w-24">אחוז הגשה</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryDishes.map(dish => (
                    <tr key={dish.id} className="border-b border-stone-100 last:border-b-0">
                      <td className="p-3">
                        <p className="font-medium text-stone-900">{dish.name}</p>
                        {dish.description && <p className="text-xs text-stone-500 mt-0.5">{dish.description}</p>}
                      </td>
                      <td className="p-3 text-center font-semibold text-stone-900">{dish.planned_qty}</td>
                      <td className="p-3 text-center text-stone-600">{dish.serving_percentage || 100}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}

      {showDeptPrint && (
        <DepartmentPrintDialog
          open={showDeptPrint}
          onOpenChange={setShowDeptPrint}
          event={event}
          eventDishes={eventDishes}
          dishes={dishes}
          categories={categories}
          ingredients={ingredients}
          ingredientCategories={ingredientCategories}
          specialIngredients={specialIngredients}
          subCategories={subCategories}
        />
      )}
    </div>
  );
}