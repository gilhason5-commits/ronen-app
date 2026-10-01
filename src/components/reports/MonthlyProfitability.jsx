import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { fmtCurrency } from "../utils/formatNumbers";
import { fetchEventsInRange } from "@/lib/kitchenShifts";
import LoadingState from "@/components/utils/LoadingState";
import {
  monthRange,
  countedEventsInMonth,
  eventTotalRevenue,
  withoutVat,
  generalExpensesForMonth,
  fixedExpensesTotal,
} from "@/lib/monthlyFinance";

// Monthly P&L, all amounts pre-VAT:
//   revenue − food cost − event-dependent general expenses = gross profit
//   gross profit − fixed expenses = net profit
// Shown for the whole month first; the per-event split comes last.
function Line({ label, value, sign, strong, hint }) {
  return (
    <div className={`flex items-center justify-between py-2 ${strong ? "border-t-2 border-stone-800 font-bold text-base" : "border-b border-stone-100 text-sm"}`}>
      <span className={strong ? "text-stone-900" : "text-stone-600"}>
        {sign && <span className="inline-block w-4 text-stone-400">{sign}</span>}
        {label}
        {hint && <span className="text-xs text-stone-400 mr-2">{hint}</span>}
      </span>
      <span className={strong ? (value >= 0 ? "text-emerald-700" : "text-red-600") : "text-stone-900 font-medium"}>{fmtCurrency(value)}</span>
    </div>
  );
}

export default function MonthlyProfitability() {
  const [month, setMonth] = useState(() => new Date());
  const shiftMonth = (dir) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));
  const monthLabel = month.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const [monthFrom, monthTo] = monthRange(month);

  const { data: rangeEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["financeMonthEvents", monthFrom, monthTo],
    queryFn: () => fetchEventsInRange(monthFrom, monthTo),
  });
  const { data: fixedExpenses = [] } = useQuery({
    queryKey: ["fixedExpenses"],
    queryFn: () => base44.entities.FixedExpense.list("sort_order"),
  });
  const { data: generalItems = [] } = useQuery({
    queryKey: ["generalExpenses"],
    queryFn: () => base44.entities.GeneralExpense.list("sort_order"),
  });

  const pnl = useMemo(() => {
    const events = countedEventsInMonth(rangeEvents, month);
    const revenue = withoutVat(events.reduce((sum, e) => sum + eventTotalRevenue(e), 0));
    const foodCost = events.reduce((sum, e) => sum + (parseFloat(e.food_cost_sum) || 0), 0);
    const general = generalExpensesForMonth(generalItems, events);
    const grossProfit = revenue - foodCost - general.total;
    const fixed = fixedExpensesTotal(fixedExpenses);
    const netProfit = grossProfit - fixed;
    return { events, revenue, foodCost, general, grossProfit, fixed, netProfit };
  }, [rangeEvents, month, generalItems, fixedExpenses]);

  const n = pnl.events.length;
  const perEvent = (v) => (n > 0 ? v / n : 0);

  return (
    <Card className="border-stone-200">
      <CardHeader className="p-5 border-b border-stone-200 flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-stone-500" /> רווחיות חודשית
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shiftMonth(1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
            <span className="text-xs font-medium w-24 text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shiftMonth(-1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
          </div>
          <Link to={createPageUrl("FixedExpenses")}>
            <Button variant="outline" size="sm">ניהול הוצאות ←</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <p className="text-xs text-stone-500">
          {n} אירועים מאושרים והושלמו · {pnl.general.guestCount.toLocaleString("he-IL")} אורחים · כל הסכומים לפני מע״מ
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-semibold text-stone-800 mb-1">סה״כ לחודש</p>
            <Line label="הכנסות" value={pnl.revenue} />
            <Line sign="−" label="הוצאות אוכל/תוכן" value={pnl.foodCost} hint="לפי עלות המנות באירועים" />
            <Line sign="−" label="הוצאות כלליות תלויות אירוע" value={pnl.general.total} />
            <Line strong label="רווח גולמי" value={pnl.grossProfit} />
            <Line sign="−" label="הוצאות קבועות" value={pnl.fixed} />
            <Line strong label="רווח נקי" value={pnl.netProfit} />
          </div>

          <div>
            <p className="text-sm font-semibold text-stone-800 mb-1">חלוקה לאירוע ({n})</p>
            {n === 0 && eventsLoading ? (
              <LoadingState className="py-2" />
            ) : n === 0 ? (
              <p className="text-sm text-stone-400 py-2">אין אירועים מאושרים בחודש זה — לא ניתן לחלק לאירוע</p>
            ) : (
              <>
                <Line label="הכנסה ממוצעת" value={perEvent(pnl.revenue)} />
                <Line sign="−" label="הוצאות אוכל/תוכן" value={perEvent(pnl.foodCost)} />
                <Line sign="−" label="הוצאות כלליות תלויות אירוע" value={perEvent(pnl.general.total)} />
                <Line strong label="רווח גולמי לאירוע" value={perEvent(pnl.grossProfit)} />
                <Line sign="−" label="הוצאות קבועות לאירוע" value={perEvent(pnl.fixed)} />
                <Line strong label="רווח נקי לאירוע" value={perEvent(pnl.netProfit)} />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
