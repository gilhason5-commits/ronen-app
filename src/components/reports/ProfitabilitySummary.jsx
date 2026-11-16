import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { fmtCurrency } from "../utils/formatNumbers";
import LoadingState from "@/components/utils/LoadingState";
import ExVatTag from "./ExVatTag";
import {
  countedEventsInMonth,
  countedEventsInYear,
  eventTotalRevenue,
  withoutVat,
  generalExpensesForMonth,
  fixedExpensesTotal,
  fixedExpenseMonthsInYear,
} from "@/lib/monthlyFinance";

// P&L for a year or a single month, all amounts pre-VAT:
//   revenue − food − event-dependent general expenses = gross profit
//   gross profit − fixed expenses = net profit
// Fixed expenses are monthly amounts: × 1 for a month, × 12 (or months so far) for a year.
// `period` comes from useReportPeriod (shared with the food-cost chart).
export default function ProfitabilitySummary({ events, period, isLoading = false }) {
  const { mode, setMode, year, month, shift, label: periodLabel } = period;

  const { data: fixedExpenses = [] } = useQuery({
    queryKey: ["fixedExpenses"],
    queryFn: () => base44.entities.FixedExpense.list("sort_order"),
  });
  const { data: generalItems = [] } = useQuery({
    queryKey: ["generalExpenses"],
    queryFn: () => base44.entities.GeneralExpense.list("sort_order"),
  });

  const pnl = useMemo(() => {
    const periodEvents = mode === "year" ? countedEventsInYear(events, year) : countedEventsInMonth(events, month);
    const revenue = withoutVat(periodEvents.reduce((sum, e) => sum + eventTotalRevenue(e), 0));
    const foodCost = periodEvents.reduce((sum, e) => sum + (parseFloat(e.food_cost_sum) || 0), 0);
    const general = generalExpensesForMonth(generalItems, periodEvents);
    const grossProfit = revenue - foodCost - general.total;
    const fixedMonthly = fixedExpensesTotal(fixedExpenses);
    const fixedMonths = mode === "year" ? fixedExpenseMonthsInYear(year) : 1;
    const fixed = fixedMonthly * fixedMonths;
    const netProfit = grossProfit - fixed;
    const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
    return { n: periodEvents.length, revenue, foodCost, foodCostPct, general, grossProfit, fixedMonthly, fixedMonths, fixed, netProfit };
  }, [events, mode, year, month, generalItems, fixedExpenses]);

  const guests = pnl.general.guestCount.toLocaleString("he-IL");
  const tiles = [
    { label: "הכנסות", value: pnl.revenue, sub: `${pnl.n} אירועים · ${guests} אורחים` },
    { label: "מזון, משקאות ומשתנים", value: pnl.foodCost, sub: `${pnl.foodCostPct.toFixed(1)}% מההכנסות` },
    { label: "הוצאות כלליות פר אירוע", value: pnl.general.perEventTotal, sub: `${fmtCurrency(pnl.general.perEventUnit)} × ${pnl.n} אירועים` },
    { label: "הוצאות כלליות פר אורח", value: pnl.general.perGuestTotal, sub: `${fmtCurrency(pnl.general.perGuestUnit)} × ${guests} אורחים` },
    { label: "רווח גולמי", value: pnl.grossProfit, profit: true },
    { label: "הוצאות קבועות", value: pnl.fixed, sub: pnl.fixedMonths > 1 ? `${fmtCurrency(pnl.fixedMonthly)} × ${pnl.fixedMonths} חודשים` : "לחודש" },
    { label: "רווח נקי", value: pnl.netProfit, profit: true },
    { label: "אחוז פוד קוסט", pct: pnl.foodCostPct },
  ];

  return (
    <Card className="border-stone-200">
      <CardHeader className="p-5 border-b border-stone-200 flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="text-lg font-semibold text-stone-900 flex items-center gap-2 flex-wrap">
          <CalendarRange className="w-5 h-5 text-stone-500" /> רווח והפסד
          <span className="text-xs font-normal text-stone-500">אירועים מאושרים והושלמו · לפני מע״מ</span>
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-stone-100 rounded-lg p-1">
            {[["year", "שנתי"], ["month", "חודשי"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shift(1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
            <span className="text-xs font-medium w-24 text-center">{periodLabel}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shift(-1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
          </div>
          <Link to={createPageUrl("FixedExpenses")}>
            <Button variant="outline" size="sm">ניהול הוצאות ←</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {isLoading ? (
          <LoadingState className="py-8" />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-stone-200 p-4">
                <p className="text-sm font-medium text-stone-500 mb-2">{t.label}</p>
                {t.pct != null ? (
                  <p className={`text-2xl font-bold ${t.pct <= 30 ? "text-emerald-600" : t.pct <= 35 ? "text-yellow-600" : "text-red-600"}`}>{t.pct.toFixed(1)}%</p>
                ) : (
                  <p className={`text-2xl font-bold ${t.profit ? (t.value >= 0 ? "text-emerald-600" : "text-red-600") : "text-stone-900"}`}>
                    {fmtCurrency(t.value)} <ExVatTag />
                  </p>
                )}
                {t.sub && <p className="text-xs text-stone-500 mt-1">{t.sub}</p>}
                {t.pct == null && pnl.n > 0 && (
                  <p className="text-xs text-stone-400 mt-0.5">לאירוע: {fmtCurrency(t.value / pnl.n)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
