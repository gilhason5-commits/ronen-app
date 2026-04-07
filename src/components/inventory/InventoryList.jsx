import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Sliders, Package, TrendingUp, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function InventoryList({ ingredients, isLoading, onEdit, onAdjust, onDelete }) {
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    initialData: []
  });

  const getFutureArrivals = (ingredientId) => {
    const arrivals = [];
    
    purchaseOrders.forEach(po => {
      if (po.status !== 'received' && po.status !== 'cancelled' && po.expected_date) {
        po.items?.forEach(item => {
          if (item.ingredient_id === ingredientId) {
            arrivals.push({
              qty: item.qty,
              date: po.expected_date,
              po_number: po.po_number,
              supplier: po.supplier_name
            });
          }
        });
      }
    });
    
    return arrivals.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">לא נמצאו מצרכים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ingredients.map((ingredient) => {
        const futureArrivals = getFutureArrivals(ingredient.id);
        const totalIncoming = futureArrivals.reduce((sum, a) => sum + a.qty, 0);
        const systemUnit = ingredient.system_unit || ingredient.unit || '';
        const purchaseUnit = ingredient.purchase_unit || 1;
        const wastePct = ingredient.waste_pct || 0;
        const actualQtyAfterWaste = purchaseUnit * (1 - wastePct / 100);
        const pricePerSystem = ingredient.price_per_system ?? 
          ((ingredient.base_price ?? ingredient.price_per_unit ?? 0) / (actualQtyAfterWaste || 1));
        const basePrice = ingredient.base_price ?? ingredient.price_per_unit ?? 0;
        
        return (
          <Card 
            key={ingredient.id} 
            className="border-stone-200 hover:shadow-md transition-shadow"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-stone-900">{ingredient.name}</h3>
                  {ingredient.category && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {ingredient.category}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center p-2 bg-stone-50 rounded">
                  <span className="text-sm text-stone-600">במלאי:</span>
                  <span className="font-semibold text-stone-900">
                    {ingredient.on_hand_qty} {systemUnit}
                  </span>
                </div>

                {futureArrivals.length > 0 && (
                  <div className="border-l-2 border-emerald-500 pl-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">
                        הגעות צפויות: {totalIncoming} {systemUnit}
                      </span>
                    </div>
                    {futureArrivals.map((arrival, idx) => (
                      <div key={idx} className="text-xs space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-stone-600">{arrival.qty} {systemUnit}</span>
                          <span className="text-stone-500">
                            {format(new Date(arrival.date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="text-stone-500">
                          {arrival.po_number} • {arrival.supplier}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-600">יחידת רכישה:</span>
                    <span className="font-medium">{purchaseUnit} {systemUnit}</span>
                  </div>
                  {wastePct > 0 && (
                    <div className="flex justify-between">
                      <span className="text-stone-600">שמיש אחרי בזבוז:</span>
                      <span className="font-medium text-blue-600">{actualQtyAfterWaste.toFixed(2)} {systemUnit}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-600">מחיר רכישה כולל:</span>
                    <span className="font-medium">₪{basePrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                  <span className="text-sm text-stone-600">מחיר ל-{systemUnit}:</span>
                  <span className="font-semibold text-emerald-700">
                    ₪{pricePerSystem.toFixed(2)}
                  </span>
                </div>

                {ingredient.current_supplier_name && (
                  <div className="text-sm text-stone-600">
                    <span className="font-medium">ספק:</span> {ingredient.current_supplier_name}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(ingredient)}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  עריכה
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onAdjust(ingredient)}
                >
                  <Sliders className="w-3 h-3 mr-2" />
                  התאמה
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(ingredient)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}