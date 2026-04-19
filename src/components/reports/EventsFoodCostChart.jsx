import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subMonths, isAfter, parseISO, format } from 'date-fns';

export default function EventsFoodCostChart({ events }) {
  const data = useMemo(() => {
    const oneMonthAgo = subMonths(new Date(), 1);
    
    return events
      .filter(e => {
        if (!e.event_date) return false;
        const date = parseISO(e.event_date);
        // Include completed and in_progress events from the last month that have revenue
        return isAfter(date, oneMonthAgo) && (e.event_price > 0);
      })
      .map(e => ({
        name: e.event_name,
        date: format(parseISO(e.event_date), 'dd/MM'),
        originalDate: e.event_date,
        foodCostPct: e.food_cost_pct || 0,
        revenue: e.event_price || 0,
        cost: e.food_cost_sum || 0
      }))
      .sort((a, b) => new Date(a.originalDate) - new Date(b.originalDate));
  }, [events]);

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
            הכנסות: ₪{data.revenue.toLocaleString(undefined, {maximumFractionDigits: 2})}
          </p>
          <p className="text-stone-500 text-xs">
            עלות מזון: ₪{data.cost.toLocaleString(undefined, {maximumFractionDigits: 2})}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-stone-200">
      <CardHeader className="p-5 border-b border-stone-200">
        <CardTitle className="text-lg font-semibold text-stone-900">אחוז פוד קוסט - חודש אחרון</CardTitle>
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
                dataKey="date" 
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
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-stone-400">
            <p>אין נתונים לחודש האחרון</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}