import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import CategoryBreakdown from "../reports/CategoryBreakdown";
import { fmtCurrency } from "../utils/formatNumbers";
import { excludeVat } from "@/lib/vat";

export default function EventSummary({ foodRevenue = 0, pricePerPlate = 0, guestCount = 0, eventDishes = [], getEffectivePlannedCost, eventId = null, additions = {} }) {
  const calculatedRevenue = (parseFloat(pricePerPlate) || 0) * (parseFloat(guestCount) || 0);
  const safeRevenue = calculatedRevenue || parseFloat(foodRevenue) || 0;
  const additionsTotal =
    (parseFloat(additions.lighting_sound_cost) || 0) +
    (parseFloat(additions.after_party_food_cost) || 0) +
    (parseFloat(additions.custom_addition_1_amount) || 0) +
    (parseFloat(additions.custom_addition_2_amount) || 0);
  const totalRevenueExVat = excludeVat(safeRevenue + additionsTotal);

  return (
    <Card className="border-stone-200 sticky top-6">
      <CardHeader className="border-b border-stone-200 p-5 bg-stone-50">
        <CardTitle className="text-lg">סיכום אירוע</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-stone-500" />
            <p className="text-sm text-stone-600">הכנסה כוללת ללא מע״מ</p>
          </div>
          <p className="text-2xl font-bold text-stone-900">{fmtCurrency(totalRevenueExVat)}</p>
        </div>

        {eventId && (
          <div className="pt-4 border-t border-stone-200">
            <CategoryBreakdown events={[{ id: eventId }]} eventDishes={eventDishes} getEffectivePlannedCost={getEffectivePlannedCost} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
