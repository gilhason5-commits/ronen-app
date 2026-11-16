import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { parseISO, format } from 'date-fns';
import LoadingState from "@/components/utils/LoadingState";
import ExVatTag from "./ExVatTag";
import { countedEventsInMonth, eventTotalRevenue, withoutVat } from "@/lib/monthlyFinance";

const bar = (name, date, periodEvents) => {
  const revenue = withoutVat(periodEvents.reduce((sum, e) => sum + eventTotalRevenue(e), 0));
  const cost = periodEvents.reduce((sum, e) => sum + (parseFloat(e.food_cost_sum) || 0), 0);
  return { name, date, foodCostPct: revenue > 0 ? (cost / revenue) * 100 : 0, revenue, cost };
};

// Food cost % — per month for the yearly filter, per event for the monthly
// one. Same events and pre-VAT revenue as the P&L tiles (`period` is shared).
export default function EventsFoodCostChart({ events, period, isLoading = false }) {
  const { mode, year, month, label } = period;

  const data = useMemo(() => {
    if (mode === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(year, i, 1);
        const monthEvents = countedEventsInMonth(events, d);
        return bar(d.toLocaleDateString("he-IL", { month: "long" }), `${monthEvents.length} אירועים`, monthEvents);
      }).filter(d => d.revenue > 0);
    }
    return countedEventsInMonth(events, month)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .map(e => bar(e.event_name, format(parseISO(e.event_date), 'dd/MM'), [e]))
      .filter(d => d.revenue > 0);
  }, [events, mode, year, month]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-stone-200 shadow-lg rounded-lg text-sm">
          <p className="font-bold text-stone-900 mb-1">{data.name}</p>
          <p className="text-stone-500 mb-2">{data.date}</p>
          <p className="text-stone-700">
            אחוז פוד קוסט: <span className={`font-bold ${data.foodCostPct > 35 ? 'text-red-600' : 'text-emerald-600'}`}>{data.foodCostPct.toFixed(1)}%</span>
          </p>
          <p className="text-stone-500 text-xs mt-1">
            הכנסות: ₪{data.revenue.toLocaleString(undefined, {maximumFractionDigits: 2})} <ExVatTag />
          </p>
          <p className="text-stone-500 text-xs">
            עלות מזון: ₪{data.cost.toLocaleString(undefined, {maximumFractionDigits: 2})} <ExVatTag />
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-stone-200">
      <CardHeader className="p-5 border-b border-stone-200">
        <CardTitle className="text-lg font-semibold text-stone-900">
          אחוז פוד קוסט {mode === "year" ? "לפי חודש" : "לפי אירוע"} · {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 h-[400px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
              <XAxis 
                dataKey={mode === "year" ? "name" : "date"} 
                tick={{ fontSize: 11, fill: '#78716c' }} 
                interval={0} 
                angle={-45} 
                textAnchor="end" 
                height={60}
                tickMargin={5}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#78716c' }} 
                unit="%"
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="foodCostPct" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.foodCostPct > 35 ? '#ef4444' : entry.foodCostPct > 30 ? '#f59e0b' : '#10b981'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : isLoading ? (
          <LoadingState className="h-full" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-stone-400">
            <p>אין אירועים מאושרים בתקופה זו</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}