import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtCurrency } from "../utils/formatNumbers";
import {
  countedEventsInYear,
  eventTotalRevenue,
  withoutVat,
  generalExpensesForMonth,
  fixedExpensesTotal,
  fixedExpenseMonthsInYear,
} from "@/lib/monthlyFinance";

// Yearly P&L — the monthly summary's formula over a whole year, pre-VAT.
// Fixed expenses are monthly amounts: × 12, or × months so far this year.
export default function AnnualProfitability({ events }) {
  const [year, setYear] = useState(() => new Date().getFullYear());

  const { data: fixedExpenses = [] } = useQuery({
    queryKey: ["fixedExpenses"],
    queryFn: () => base44.entities.FixedExpense.list("sort_order"),
  });
  const { data: generalItems = [] } = useQuery({
    queryKey: ["generalExpenses"],
    queryFn: () => base44.entities.GeneralExpense.list("sort_order"),
  });

  const pnl = useMemo(() => {
    const yearEvents = countedEventsInYear(events, year);
    const revenue = withoutVat(yearEvents.reduce((sum, e) => sum + eventTotalRevenue(e), 0));
    const foodCost = yearEvents.reduce((sum, e) => sum + (parseFloat(e.food_cost_sum) || 0), 0);
    const general = generalExpensesForMonth(generalItems, yearEvents);
    const grossProfit = revenue - foodCost - general.total;
    const fixedMonthly = fixedExpensesTotal(fixedExpenses);
    const fixedMonths = fixedExpenseMonthsInYear(year);
    const fixed = fixedMonthly * fixedMonths;
    const netProfit = grossProfit - fixed;
    const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
    return { n: yearEvents.length, revenue, foodCost, foodCostPct, general, grossProfit, fixedMonthly, fixedMonths, fixed, netProfit };
  }, [events, year, generalItems, fixedExpenses]);

  const tiles = [
    { label: "הכנסות", value: pnl.revenue, sub: `${pnl.n} אירועים · ${pnl.general.guestCount.toLocaleString("he-IL")} אורחים` },
    { label: "מזון, משקאות ומשתנים", value: pnl.foodCost, sub: `${pnl.foodCostPct.toFixed(1)}% מההכנסות` },
    { label: "הוצאות כלליות פר אירוע", value: pnl.general.perEventTotal, sub: `${fmtCurrency(pnl.general.perEventUnit)} × ${pnl.n} אירועים` },
    { label: "הוצאות כלליות פר אורח", value: pnl.general.perGuestTotal, sub: `${fmtCurrency(pnl.general.perGuestUnit)} × ${pnl.general.guestCount.toLocaleString("he-IL")} אורחים` },
    { label: "רווח גולמי", value: pnl.grossProfit, profit: true },
    { label: "הוצאות קבועות", value: pnl.fixed, sub: `${fmtCurrency(pnl.fixedMonthly)} × ${pnl.fixedMonths} חודשים` },
    { label: "רווח נקי", value: pnl.netProfit, profit: true },
    { label: "אחוז פוד קוסט", pct: pnl.foodCostPct },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-stone-900 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-stone-500" /> סיכום שנתי
          <span className="text-xs font-normal text-stone-500">אירועים מאושרים והושלמו · לפני מע״מ</span>
        </h2>
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setYear((y) => y + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
          <span className="text-xs font-medium w-12 text-center">{year}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label} className="border-stone-200">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-stone-500">{t.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {t.pct != null ? (
                <p className={`text-2xl font-bold ${t.pct <= 30 ? "text-emerald-600" : t.pct <= 35 ? "text-yellow-600" : "text-red-600"}`}>{t.pct.toFixed(1)}%</p>
              ) : (
                <p className={`text-2xl font-bold ${t.profit ? (t.value >= 0 ? "text-emerald-600" : "text-red-600") : "text-stone-900"}`}>{fmtCurrency(t.value)}</p>
              )}
              {t.sub && <p className="text-xs text-stone-500 mt-1">{t.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
