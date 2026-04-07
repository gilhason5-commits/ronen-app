import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sliders, Package, TrendingUp, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays } from "date-fns";

export default function InventoryTrackingList({ ingredients, events, eventsDishes, dishes, purchaseOrders, isLoading, onAdjust, onShowEventNeeds }) {
  
  const getUpcomingNeed = (ingredientId) => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    
    const upcomingEvents = events.filter(e => {
      if (!e.event_date || e.status !== 'in_progress') return false;
      const eventDate = new Date(e.event_date);
      return eventDate >= today && eventDate <= nextWeek;
    });

    let totalNeeded = 0;
    
    upcomingEvents.forEach(event => {
      const eventDishesForEvent = eventsDishes.filter(ed => ed.event_id === event.id);
      
      eventDishesForEvent.forEach(ed => {
        const dish = dishes.find(d => d.id === ed.dish_id);
        if (!dish || !dish.ingredients) return;
        
        const ingredient = dish.ingredients.find(i => i.ingredient_id === ingredientId);
        if (!ingredient) return;
        
        const plannedQty = ed.planned_qty || 0;
        const baseQty = ingredient.qty || 0;
        const neededForEvent = baseQty * plannedQty;
        
        totalNeeded += neededForEvent;
      });
    });
    
    return Math.ceil(totalNeeded * 10) / 10;
  };

  const getEventNeeds = (ingredientId) => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    
    const upcomingEvents = events.filter(e => {
      if (!e.event_date || e.status !== 'in_progress') return false;
      const eventDate = new Date(e.event_date);
      return eventDate >= today && eventDate <= nextWeek;
    });

    const eventNeedsList = [];
    
    upcomingEvents.forEach(event => {
      const eventDishesForEvent = eventsDishes.filter(ed => ed.event_id === event.id);
      let totalForEvent = 0;
      
      eventDishesForEvent.forEach(ed => {
        const dish = dishes.find(d => d.id === ed.dish_id);
        if (!dish || !dish.ingredients) return;
        
        const ingredient = dish.ingredients.find(i => i.ingredient_id === ingredientId);
        if (!ingredient) return;
        
        const plannedQty = ed.planned_qty || 0;
        const baseQty = ingredient.qty || 0;
        const neededForEvent = baseQty * plannedQty;
        
        totalForEvent += neededForEvent;
      });
      
      if (totalForEvent > 0) {
        eventNeedsList.push({
          event_name: event.event_name,
          event_date: event.event_date,
          needed_qty: totalForEvent
        });
      }
    });
    
    return eventNeedsList.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  };

  const getIncomingQty = (ingredientId) => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    
    let totalIncoming = 0;
    
    purchaseOrders.forEach(po => {
      if (po.status === 'received' || po.status === 'cancelled' || !po.expected_date) return;
      
      const expectedDate = new Date(po.expected_date);
      if (expectedDate < today || expectedDate > nextWeek) return;
      
      po.items?.forEach(item => {
        if (item.ingredient_id === ingredientId) {
          totalIncoming += item.qty || 0;
        }
      });
    });
    
    return totalIncoming;
  };

  const shouldOrder = (onHand, needed, incoming) => {
    const available = onHand + incoming;
    return available < needed;
  };

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">לא נמצאו רכיבים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ingredients.map((ingredient) => {
        const systemUnit = ingredient.system_unit || ingredient.unit || '';
        const onHand = ingredient.on_hand_qty || 0;
        const needed = getUpcomingNeed(ingredient.id);
        const incoming = getIncomingQty(ingredient.id);
        const needsOrder = shouldOrder(onHand, needed, incoming);
        
        return (
          <Card 
            key={ingredient.id} 
            className={`border-stone-200 hover:shadow-md transition-shadow ${needsOrder ? 'border-l-4 border-l-red-500' : ''}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-stone-900">{ingredient.name}</h3>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">במלאי כרגע</span>
                  </div>
                  <span className="font-bold text-blue-900">
                    {onHand} {systemUnit}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">נדרש השבוע</span>
                  </div>
                  <span className="font-bold text-purple-900">
                    {needed} {systemUnit}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-900">צפוי להגיע</span>
                  </div>
                  <span className="font-bold text-emerald-900">
                    {incoming} {systemUnit}
                  </span>
                </div>

                <button 
                  className={`w-full flex justify-between items-center p-3 rounded-lg transition-colors ${
                    needsOrder ? 'bg-red-50 border-2 border-red-200 hover:bg-red-100 cursor-pointer' : 'bg-green-50 cursor-default'
                  }`}
                  onClick={() => needsOrder && onShowEventNeeds && onShowEventNeeds(ingredient, getEventNeeds(ingredient.id))}
                  disabled={!needsOrder}
                >
                  <div className="flex items-center gap-2">
                    {needsOrder ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    <span className={`text-sm font-bold ${needsOrder ? 'text-red-900' : 'text-green-900'}`}>
                      {needsOrder ? 'דרושה הזמנה' : 'מספיק במלאי'}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${needsOrder ? 'text-red-700' : 'text-green-700'}`}>
                    זמין: {(onHand + incoming).toFixed(1)} {systemUnit}
                  </span>
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onAdjust(ingredient)}
              >
                <Sliders className="w-3 h-3 mr-2" />
                התאמת כמות
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}