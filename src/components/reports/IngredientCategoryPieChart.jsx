import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { subMonths, format } from 'date-fns';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1'];

export default function IngredientCategoryPieChart() {
  const oneMonthAgo = useMemo(() => format(subMonths(new Date(), 1), 'yyyy-MM-dd'), []);

  // 1. Fetch Events from last month (regardless of status, but typically not cancelled if we want "existing")
  const { data: events = [] } = useQuery({
    queryKey: ['events', 'lastMonth'],
    queryFn: () => base44.entities.Event.filter({
      event_date: { "$gte": oneMonthAgo }
    }),
    initialData: []
  });

  // 2. Fetch Events_Dish to get planned dishes
  const { data: eventsDishes = [] } = useQuery({
    queryKey: ['eventsDishes'],
    queryFn: () => base44.entities.Events_Dish.list(),
    initialData: []
  });

  // 3. Fetch Dishes to get recipe/ingredients
  const { data: dishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: []
  });

  // 4. Fetch Ingredients to get prices and categories
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: []
  });

  // 5. Fetch Categories for names
  const { data: categories = [] } = useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: () => base44.entities.Ingredient_Category.list(),
    initialData: []
  });

  const chartData = useMemo(() => {
    if (!events.length || !eventsDishes.length || !dishes.length || !ingredients.length) return [];

    const categoryTotals = {};
    const relevantEventIds = new Set(events.map(e => e.id));

    // Filter relevant EventDishes
    const relevantEventDishes = eventsDishes.filter(ed => relevantEventIds.has(ed.event_id));

    relevantEventDishes.forEach(ed => {
      const dish = dishes.find(d => d.id === ed.dish_id);
      if (!dish || !dish.ingredients) return;

      const plannedQty = ed.planned_qty || 0; // Number of portions/units

      dish.ingredients.forEach(dishIng => {
        const ingredientDef = ingredients.find(i => i.id === dishIng.ingredient_id);
        if (ingredientDef) {
           // Calculate cost for this ingredient in this dish
           // Cost = (Qty per portion * Planned Portions) * Price per unit
           // Note: dishIng.qty is usually per portion/batch. Assuming dish.ingredients stores qty per portion OR standard batch.
           // However, standard Dish entity usually stores recipe for 1 portion or a batch? 
           // Based on `Dish` entity: "portion_size_grams". 
           // Assuming `dishIng.qty` is per 1 unit of Dish (portion_factor=1).
           // `ed.planned_qty` is the number of guests/portions.
           
           const totalQtyNeeded = (dishIng.qty || 0) * plannedQty;
           
           // Price is usually per purchase unit or system unit. 
           // ingredientDef.price_per_system is the price per system unit (kg, L, etc).
           // Assuming dishIng.unit matches system_unit or needs conversion. 
           // For simplicity in this dashboard, we assume unit consistency or 1:1 if not specified.
           // A more robust implementation would convert units. 
           // Defaulting to price_per_system * totalQtyNeeded (assuming dishIng.qty is in system units)
           
           const cost = totalQtyNeeded * (ingredientDef.price_per_system || 0);

           const catId = ingredientDef.ingredient_category_id || 'unknown';
           
           if (!categoryTotals[catId]) {
             categoryTotals[catId] = 0;
           }
           categoryTotals[catId] += cost;
        }
      });
    });

    const data = Object.entries(categoryTotals)
      .map(([catId, total]) => {
        let name = 'אחר';
        if (catId !== 'unknown') {
          const cat = categories.find(c => c.id === catId);
          name = cat ? cat.name : 'ללא קטגוריה';
        }
        return { name, value: total };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return data;
  }, [events, eventsDishes, dishes, ingredients, categories]);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-2 border border-stone-200 shadow-sm rounded text-sm">
          <p className="font-semibold">{data.name}</p>
          <p className="text-stone-600">₪{data.value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-stone-200 h-full">
      <CardHeader className="p-5 border-b border-stone-200">
        <CardTitle className="text-lg font-semibold text-stone-900">תחזית עלויות רכיבים (לפי אירועים) - חודש אחרון</CardTitle>
      </CardHeader>
      <CardContent className="p-5 h-[350px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-stone-400">
            <p>אין נתוני צריכה לחודש האחרון</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}