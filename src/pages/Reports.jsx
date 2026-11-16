import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";

import CategoryBreakdown from "../components/reports/CategoryBreakdown";
import EventsFoodCostChart from "../components/reports/EventsFoodCostChart";
import IngredientCategoryPieChart from "../components/reports/IngredientCategoryPieChart";
import ProfitabilitySummary from "../components/reports/ProfitabilitySummary";
import useReportPeriod from "../components/reports/useReportPeriod";
import { eventTotalRevenue, withoutVat, countedEventsInMonth, countedEventsInYear } from "@/lib/monthlyFinance";

export default function Reports() {
  const period = useReportPeriod();
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date'),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  // Same revenue as the monthly/annual P&L: plate price × guests + additions, pre-VAT.
  // (event_price alone is empty on most events.)
  const eventRevenue = (e) => withoutVat(eventTotalRevenue(e));

  const completedEvents = events.filter(e => e.status === 'completed');

  // Approved + completed events in the selected year / month — what every
  // section below the P&L tiles summarises.
  const periodEvents = period.mode === "year"
    ? countedEventsInYear(events, period.year)
    : countedEventsInMonth(events, period.month);

  const exportToCSV = () => {
    const csvData = completedEvents.map(event => ({
      'שם אירוע': event.event_name,
      'תאריך': format(new Date(event.event_date), 'yyyy-MM-dd'),
      'אורחים': event.guest_count,
      'הכנסות (לפני מע״מ)': eventRevenue(event).toFixed(2),
      'עלות מזון (לפני מע״מ)': event.food_cost_sum?.toFixed(2),
      'רווח (לפני מע״מ)': (eventRevenue(event) - (event.food_cost_sum || 0)).toFixed(2),
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

      <ProfitabilitySummary events={events} period={period} isLoading={eventsLoading} />

      {/* New Charts Section */}
      <EventsFoodCostChart events={events} period={period} isLoading={eventsLoading} />

      <div className="grid lg:grid-cols-2 gap-6">
        <IngredientCategoryPieChart events={periodEvents} periodLabel={period.label} isLoading={eventsLoading} />
        <CategoryBreakdown events={periodEvents} periodLabel={period.label} isLoading={eventsLoading} />
      </div>
    </div>
  );
}