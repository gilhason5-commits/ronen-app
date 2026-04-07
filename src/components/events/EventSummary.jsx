import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import CategoryBreakdown from "../reports/CategoryBreakdown";
import { fmtCurrency, fmtNum } from "../utils/formatNumbers";

export default function EventSummary({ foodRevenue = 0, pricePerPlate = 0, foodCostSum = 0, foodCostPct = 0, guestCount = 0, eventDishes = [], categories = [], dishes = [], getEffectivePlannedCost, eventId = null }) {
  const calculatedRevenue = (parseFloat(pricePerPlate) || 0) * (parseFloat(guestCount) || 0);
  const safeRevenue = calculatedRevenue || parseFloat(foodRevenue) || 0;
  const safeCostSum = parseFloat(foodCostSum) || 0;
  const safeCostPct = parseFloat(foodCostPct) || 0;
  const safeGuestCount = parseFloat(guestCount) || 0;
  const grossProfit = safeRevenue - safeCostSum;
  const costPerGuest = safeGuestCount > 0 ? safeCostSum / safeGuestCount : 0;

  return (
    <Card className="border-stone-200 sticky top-6">
      <CardHeader className="border-b border-stone-200 p-5 bg-stone-50">
        <CardTitle className="text-lg">סיכום אירוע</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-stone-500" />
            <p className="text-sm text-stone-600">הכנסה מאוכל</p>
          </div>
          <p className="text-2xl font-bold text-stone-900">{fmtCurrency(safeRevenue)}</p>
        </div>
        
        {eventId && (
          <div className="pt-4 border-t border-stone-200">
            <CategoryBreakdown events={[{ id: eventId }]} eventDishes={eventDishes} getEffectivePlannedCost={getEffectivePlannedCost} />
          </div>
        )}

        <div className="pt-4 border-t border-stone-200">
          <p className="text-sm text-stone-600 mb-1">עלות אוכל</p>
          <p className="text-2xl font-bold text-stone-900">{fmtCurrency(safeCostSum)}</p>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-stone-500" />
            <p className="text-sm text-stone-600">אחוז עלות אוכל</p>
          </div>
          <p className={`text-2xl font-bold ${
            safeCostPct <= 30 ? 'text-emerald-600' :
            safeCostPct <= 35 ? 'text-orange-600' :
            'text-red-600'
          }`}>
            {safeCostPct.toFixed(1)}%
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {safeCostPct <= 30 ? 'מצוין' :
             safeCostPct <= 35 ? 'טוב' :
             'גבוה - בדוק עלויות'}
          </p>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <p className="text-sm text-stone-600 mb-1">רווח גולמי</p>
          <p className="text-xl font-bold text-emerald-600">{fmtCurrency(grossProfit)}</p>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-stone-500" />
            <p className="text-sm text-stone-600">עלות לסועד</p>
          </div>
          <p className="text-lg font-semibold text-stone-900">{fmtCurrency(costPerGuest)}</p>
        </div>
      </CardContent>
    </Card>
  );
}