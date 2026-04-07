import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, TrendingUp, DollarSign } from "lucide-react";
import { format } from "date-fns";

import MonthlyRollup from "../components/reports/MonthlyRollup";
import CategoryBreakdown from "../components/reports/CategoryBreakdown";
import EventsFoodCostChart from "../components/reports/EventsFoodCostChart";
import IngredientCategoryPieChart from "../components/reports/IngredientCategoryPieChart";
import { fmtCurrency } from "../components/utils/formatNumbers";

export default function Reports() {
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date'),
    initialData: [],
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    initialData: [],
  });

  const inProgressEvents = events.filter(e => e.status === 'in_progress');
  const completedEvents = events.filter(e => e.status === 'completed');
  
  const inProgressRevenue = inProgressEvents.reduce((sum, e) => sum + (e.food_revenue || 0), 0);
  const inProgressFoodCost = inProgressEvents.reduce((sum, e) => sum + (e.food_cost_sum || 0), 0);
  const inProgressProfit = inProgressRevenue - inProgressFoodCost;
  const inProgressFoodCostPct = inProgressRevenue > 0 ? ((inProgressFoodCost / inProgressRevenue) * 100) : 0;
  
  const completedRevenue = completedEvents.reduce((sum, e) => sum + (e.food_revenue || 0), 0);
  const completedFoodCost = completedEvents.reduce((sum, e) => sum + (e.food_cost_sum || 0), 0);
  const completedProfit = completedRevenue - completedFoodCost;
  const completedFoodCostPct = completedRevenue > 0 ? ((completedFoodCost / completedRevenue) * 100) : 0;
  
  const totalRevenue = inProgressRevenue + completedRevenue;
  const totalFoodCost = inProgressFoodCost + completedFoodCost;
  const totalProfit = totalRevenue - totalFoodCost;
  const avgFoodCostPct = totalRevenue > 0 ? ((totalFoodCost / totalRevenue) * 100) : 0;

  const exportToCSV = () => {
    const csvData = completedEvents.map(event => ({
      'שם אירוע': event.event_name,
      'תאריך': format(new Date(event.event_date), 'yyyy-MM-dd'),
      'אורחים': event.guest_count,
      'הכנסות': event.food_revenue?.toFixed(2),
      'עלות מזון': event.food_cost_sum?.toFixed(2),
      'רווח': (event.food_revenue - event.food_cost_sum)?.toFixed(2),
      'שולי רווח %': event.food_cost_pct?.toFixed(2)
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-reports-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">דוחות וניתוח</h1>
          <p className="text-stone-500 mt-1">ניתוח רווח והפסד ותובנות עסקיות</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          ייצוא ל-CSV
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-stone-900">אירועים בתהליך</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">הכנסות</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-stone-900">{fmtCurrency(inProgressRevenue)}</p>
                <p className="text-xs text-stone-500 mt-1">{inProgressEvents.length} אירועים</p>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">עלויות מזון</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-stone-900">{fmtCurrency(inProgressFoodCost)}</p>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">רווח</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-blue-600">{fmtCurrency(inProgressProfit)}</p>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">אחוז פוד קוסט</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className={`text-2xl font-bold ${inProgressFoodCostPct <= 30 ? 'text-emerald-600' : inProgressFoodCostPct <= 35 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {inProgressFoodCostPct.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-stone-900">אירועים שהושלמו</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">הכנסות</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-stone-900">{fmtCurrency(completedRevenue)}</p>
                <p className="text-xs text-stone-500 mt-1">{completedEvents.length} אירועים</p>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">עלויות מזון</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-stone-900">{fmtCurrency(completedFoodCost)}</p>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">רווח</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-emerald-600">{fmtCurrency(completedProfit)}</p>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-stone-500">אחוז פוד קוסט</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className={`text-2xl font-bold ${completedFoodCostPct <= 30 ? 'text-emerald-600' : completedFoodCostPct <= 35 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {completedFoodCostPct.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Card className="border-stone-200 bg-stone-50">
        <CardHeader className="p-5 border-b border-stone-200">
          <CardTitle className="text-lg font-semibold text-stone-900">סיכום כולל</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-stone-500 mb-1">סך הכנסות</p>
              <p className="text-2xl font-bold text-stone-900">{fmtCurrency(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500 mb-1">סך עלויות מזון</p>
              <p className="text-2xl font-bold text-stone-900">{fmtCurrency(totalFoodCost)}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500 mb-1">סך רווח</p>
              <p className="text-2xl font-bold text-emerald-600">{fmtCurrency(totalProfit)}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500 mb-1">אחוז פוד קוסט ממוצע</p>
              <p className={`text-2xl font-bold ${avgFoodCostPct <= 30 ? 'text-emerald-600' : avgFoodCostPct <= 35 ? 'text-yellow-600' : 'text-red-600'}`}>
                {avgFoodCostPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Charts Section */}
      <EventsFoodCostChart events={events} />

      <div className="grid lg:grid-cols-2 gap-6">
        <IngredientCategoryPieChart />
        <CategoryBreakdown events={completedEvents} />
      </div>



      <MonthlyRollup events={events} />
    </div>
  );
}