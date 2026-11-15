import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtCurrency } from "../utils/formatNumbers";
import { Line } from "./MonthlyProfitability";
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

  return (
    <Card className="border-stone-200 bg-stone-50">
      <CardHeader className="p-5 border-b border-stone-200 flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-stone-500" /> סיכום שנתי
        </CardTitle>
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setYear((y) => y + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
          <span className="text-xs font-medium w-12 text-center">{year}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-3">
        <p className="text-xs text-stone-500">
          {pnl.n} אירועים מאושרים והושלמו · {pnl.general.guestCount.toLocaleString("he-IL")} אורחים · כל הסכומים לפני מע״מ
        </p>
        <div className="max-w-2xl">
          <Line label="הכנסות" value={pnl.revenue} />
          <Line sign="−" label="הוצאות מזון, משקאות ומשתנים" value={pnl.foodCost} hint={`${pnl.foodCostPct.toFixed(1)}% מההכנסות`} />
          <Line sign="−" label="הוצאות כלליות פר אירוע" value={pnl.general.perEventTotal} hint={`${fmtCurrency(pnl.general.perEventUnit)} × ${pnl.n} אירועים`} />
          <Line sign="−" label="הוצאות כלליות פר אורח" value={pnl.general.perGuestTotal} hint={`${fmtCurrency(pnl.general.perGuestUnit)} × ${pnl.general.guestCount.toLocaleString("he-IL")} אורחים`} />
          <Line strong label="רווח גולמי" value={pnl.grossProfit} />
          <Line sign="−" label="הוצאות קבועות" value={pnl.fixed} hint={`${fmtCurrency(pnl.fixedMonthly)} × ${pnl.fixedMonths} חודשים`} />
          <Line strong label="רווח נקי" value={pnl.netProfit} />
        </div>
      </CardContent>
    </Card>
  );
}
