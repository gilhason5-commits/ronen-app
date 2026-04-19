import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format, parseISO, startOfWeek } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtCurrency } from "../utils/formatNumbers";

export default function MonthlyRollup({ events }) {
  const weeklyData = {};

  events.forEach(event => {
    if (!event.event_date) return;
    
    const eventDate = parseISO(event.event_date);
    const weekStart = startOfWeek(eventDate, { weekStartsOn: 0 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        revenue: 0,
        foodCost: 0,
        events: 0,
        weekStart: weekStart
      };
    }

    weeklyData[weekKey].revenue += event.event_price || 0;
    weeklyData[weekKey].foodCost += event.food_cost_sum || 0;
    weeklyData[weekKey].events += 1;
  });

  const sortedWeeks = Object.entries(weeklyData)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12);

  const chartData = sortedWeeks
    .reverse()
    .map(([weekKey, data]) => ({
      week: format(data.weekStart, 'dd/MM'),
      events: data.events,
      foodCostPct: data.revenue > 0 ? ((data.foodCost / data.revenue) * 100) : 0
    }));

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <CardTitle className="text-lg">ביצועים שבועיים</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {chartData.length > 0 && (
          <div className="mb-6">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="#f5f5f4" vertical={false} />
                <XAxis 
                  dataKey="week" 
                  stroke="#d6d3d1"
                  style={{ fontSize: '11px' }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a8a29e' }}
                />
                <YAxis 
                  stroke="#d6d3d1"
                  style={{ fontSize: '11px' }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a8a29e' }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => [`${value.toFixed(1)}%`, '']}
                  labelStyle={{ fontWeight: '600', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="foodCostPct" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  dot={{ fill: '#06b6d4', r: 3.5, strokeWidth: 2.5, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 3 }}
                  fill="url(#areaGradient)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-stone-700">שבוע</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-stone-700">אירועים</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-stone-700">הכנסות</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-stone-700">עלות מזון</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-stone-700">רווח</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-stone-700">אחוז פוד קוסט</th>
              </tr>
            </thead>
            <tbody>
              {sortedWeeks.reverse().map(([weekKey, data]) => {
                const profit = data.revenue - data.foodCost;
                const foodCostPct = data.revenue > 0 ? (data.foodCost / data.revenue) * 100 : 0;

                return (
                  <tr key={weekKey} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-3 px-4 font-medium text-stone-900">
                      {format(data.weekStart, 'dd/MM/yyyy')}
                    </td>
                    <td className="py-3 px-4 text-right text-stone-700">{data.events}</td>
                    <td className="py-3 px-4 text-right font-semibold text-stone-900">
                      {fmtCurrency(data.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right text-stone-700">
                      {fmtCurrency(data.foodCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                      {fmtCurrency(profit)}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${
                      foodCostPct <= 30 ? 'text-emerald-600' : 
                      foodCostPct <= 35 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {foodCostPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedWeeks.length === 0 && (
            <p className="text-center text-stone-500 py-12">אין נתונים שבועיים זמינים</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}