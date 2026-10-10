import React from 'react';
import { format, addDays } from 'date-fns';
import { Truck } from "lucide-react";
import { formatNumber } from "./purchaseUtils";

const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];

// Horizontal overview of one week's weekly-supplier deliveries: Sun–Tue
// events are supplied by the Sunday order, Wed–Fri by the Wednesday order.
// Each group shows its day boxes followed by the delivery box.
export default function WeeklyDeliveryStrip({ weekStart, events, tickets }) {
  const start = new Date(weekStart);
  const eventsOnDay = (offset) => {
    const day = format(addDays(start, offset), 'yyyy-MM-dd');
    return events.filter(e => e.event_date && e.event_date.slice(0, 10) === day);
  };

  const groups = [
    { half: 'A', days: [0, 1, 2], deliveryOffset: 0 },
    { half: 'B', days: [3, 4, 5], deliveryOffset: 3 },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {groups.map(group => {
        const groupTickets = tickets.filter(t => t.half === group.half);
        const deliveryDate = addDays(start, group.deliveryOffset);
        const total = groupTickets.reduce(
          (sum, t) => sum + t.items.reduce((s, i) => s + (i.purchase_qty ?? i.qty) * i.price_per_unit, 0),
          0
        );
        return (
          <div
            key={group.half}
            className="flex-1 flex items-stretch gap-2 p-3 rounded-3xl border-2 border-blue-200 bg-blue-50/40 overflow-x-auto"
          >
            {group.days.map(offset => {
              const dayEvents = eventsOnDay(offset);
              return (
                <div
                  key={offset}
                  className={`w-24 shrink-0 rounded-lg border p-2 text-center ${
                    dayEvents.length ? 'border-stone-300 bg-white' : 'border-dashed border-stone-200 bg-white/50'
                  }`}
                >
                  <div className="font-bold text-stone-900">{DAY_LETTERS[offset]}</div>
                  <div className="text-xs text-stone-400">{format(addDays(start, offset), 'dd/MM')}</div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.map(e => (
                      <div key={e.id} className="text-xs text-stone-700 leading-tight truncate" title={e.event_name}>
                        {e.event_name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div
              className={`min-w-36 flex-1 rounded-lg border-2 p-3 ${
                groupTickets.length ? 'border-blue-400 bg-white' : 'border-dashed border-stone-200 bg-white/50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-stone-900">
                <Truck className="w-4 h-4 text-blue-600" />
                אספקה ביום {DAY_LETTERS[group.deliveryOffset]}
              </div>
              <div className="text-xs text-stone-500">{format(deliveryDate, 'dd/MM/yyyy')}</div>
              {groupTickets.length ? (
                <>
                  <ul className="mt-2 space-y-0.5 text-sm text-stone-700">
                    {groupTickets.map(t => (
                      <li key={t.supplier.id} className="truncate">{t.supplier.name}</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-sm font-semibold text-stone-900">₪{formatNumber(total)}</div>
                </>
              ) : (
                <div className="mt-2 text-xs text-stone-400">אין הזמנה</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
