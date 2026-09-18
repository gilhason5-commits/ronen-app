import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import CategoryBreakdown from "../reports/CategoryBreakdown";
import { fmtCurrency, fmtNum } from "../utils/formatNumbers";
import { excludeVat } from "@/lib/vat";

export default function EventSummary({ foodRevenue = 0, pricePerPlate = 0, foodCostSum = 0, foodCostPct = 0, guestCount = 0, eventDishes = [], categories = [], dishes = [], getEffectivePlannedCost, eventId = null, additions = {} }) {
  const calculatedRevenue = (parseFloat(pricePerPlate) || 0) * (parseFloat(guestCount) || 0);
  const safeRevenue = calculatedRevenue || parseFloat(foodRevenue) || 0;
  const safeCostSum = parseFloat(foodCostSum) || 0;
  const safeCostPct = parseFloat(foodCostPct) || 0;
  const safeGuestCount = parseFloat(guestCount) || 0;
  const grossProfit = safeRevenue - safeCostSum;
  const costPerGuest = safeGuestCount > 0 ? safeCostSum / safeGuestCount : 0;
  const foodRevenueExVat = excludeVat(safeRevenue);
  const additionLines = [
    { name: 'תאורה והגברה', amount: parseFloat(additions.lighting_sound_cost) || 0 },
    { name: 'אוכל אפטר', amount: parseFloat(additions.after_party_food_cost) || 0 },
    { name: additions.custom_addition_1_name || 'תוספת נוספת', amount: parseFloat(additions.custom_addition_1_amount) || 0 },
    { name: additions.custom_addition_2_name || 'תוספת נוספת', amount: parseFloat(additions.custom_addition_2_amount) || 0 },
  ].filter((line) => line.amount > 0);
  const additionsTotal = additionLines.reduce((sum, line) => sum + line.amount, 0);
  const totalRevenue = safeRevenue + additionsTotal;

  return (
    <Card className="border-stone-200 sticky top-6">
      <CardHeader className="border-b border-stone-200 p-5 bg-stone-50">
        <CardTitle className="text-lg">סיכום אירוע</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-stone-500" />
            <p className="text-sm text-stone-600">סיכום תוספות</p>
          </div>
          {additionLines.length > 0 ? (
            <div className="space-y-1">
              {additionLines.map((line, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">{line.name}</span>
                  <span className="font-medium text-stone-900">{fmtCurrency(line.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold pt-1 border-t border-stone-100">
                <span className="text-stone-700">סה״כ תוספות</span>
                <span className="text-stone-900">{fmtCurrency(additionsTotal)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-400">אין תוספות</p>
          )}
        </div>

        <div className="pt-4 border-t border-stone-200">
          <p className="text-sm text-stone-600 mb-1">הכנסה מאוכל כולל מע״מ</p>
          <p className="text-2xl font-bold text-stone-900">{fmtCurrency(safeRevenue)}</p>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <p className="text-sm text-stone-600 mb-1">הכנסה מאוכל ללא מע״מ</p>
          <p className="text-2xl font-bold text-stone-900">{fmtCurrency(foodRevenueExVat)}</p>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <p className="text-sm text-stone-600 mb-1">הכנסה כוללת</p>
          <p className="text-2xl font-bold text-stone-900">{fmtCurrency(totalRevenue)}</p>
          {additionsTotal > 0 && (
            <p className="text-xs text-stone-500 mt-1">כולל {fmtCurrency(additionsTotal)} תוספות</p>
          )}
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