import React from 'react';
import { format, addDays } from 'date-fns';
import { Truck, Check } from "lucide-react";
import { getWeeklyDeliverySlot } from "./purchaseUtils";

const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];
const GROUPS = [
  { half: 'A', days: [0, 1, 2], deliveryOffset: 0, label: 'הזמנת ראשון' },
  { half: 'B', days: [3, 4, 5], deliveryOffset: 3, label: 'הזמנת רביעי' },
];

// Event selection for purchase planning, laid out per week as two horizontal
// groups — Sun–Tue (delivered Sunday) and Wed–Fri (delivered Wednesday) —
// so a whole delivery's events can be picked together.
export default function EventWeekPicker({ events, selectedEventIds, onToggleEvent, onSetGroup }) {
  const weeks = {};
  const undated = [];
  events.forEach(e => {
    if (!e.event_date) { undated.push(e); return; }
    const { weekStart } = getWeeklyDeliverySlot(e.event_date);
    (weeks[weekStart] ||= []).push(e);
  });

  const eventChip = (e) => {
    const selected = selectedEventIds.includes(e.id);
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => onToggleEvent(e.id)}
        className={`w-full text-right rounded-md border px-2 py-1.5 text-xs transition-colors ${
          selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
        }`}
      >
        <div className="flex items-center gap-1 font-semibold">
          {selected && <Check className="w-3 h-3 shrink-0" />}
          <span className="truncate">{e.event_name}</span>
        </div>
        <div className="text-stone-500">{e.guest_count} סועדים{e.event_time ? ` · ${e.event_time}` : ''}</div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {Object.keys(weeks).sort().map(weekStart => {
        const start = new Date(weekStart);
        const weekEvents = weeks[weekStart];
        const onDay = (offset) => {
          const day = format(addDays(start, offset), 'yyyy-MM-dd');
          return weekEvents.filter(e => e.event_date.slice(0, 10) === day);
        };
        return (
          <div key={weekStart}>
            <div className="text-sm font-semibold text-stone-500 mb-2">
              שבוע {format(start, 'dd/MM')}–{format(addDays(start, 5), 'dd/MM')}
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              {GROUPS.map(group => {
                const groupIds = group.days.flatMap(onDay).map(e => e.id);
                const allSelected = groupIds.length > 0 && groupIds.every(id => selectedEventIds.includes(id));
                return (
                  <div
                    key={group.half}
                    className={`flex-1 rounded-3xl border-2 p-3 transition-colors ${
                      allSelected ? 'border-emerald-400 bg-emerald-50/40' : 'border-blue-200 bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900">
                        <Truck className="w-4 h-4 text-blue-600" />
                        {group.label}
                        <span className="text-xs font-normal text-stone-500">
                          {format(addDays(start, group.deliveryOffset), 'dd/MM')}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={groupIds.length === 0}
                        onClick={() => onSetGroup(groupIds, !allSelected)}
                        className="text-xs font-medium text-emerald-700 hover:underline disabled:text-stone-300 disabled:no-underline"
                      >
                        {allSelected ? 'בטל' : 'בחר הכל'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {group.days.map(offset => {
                        const dayEvents = onDay(offset);
                        return (
                          <div
                            key={offset}
                            className={`rounded-lg border p-2 min-h-24 ${
                              dayEvents.length ? 'border-stone-300 bg-white' : 'border-dashed border-stone-200 bg-white/50'
                            }`}
                          >
                            <div className="text-center mb-1.5">
                              <span className="font-bold text-stone-900">{DAY_LETTERS[offset]}</span>
                              <span className="text-xs text-stone-400 mr-1">{format(addDays(start, offset), 'dd/MM')}</span>
                            </div>
                            <div className="space-y-1">{dayEvents.map(eventChip)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {undated.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-stone-500 mb-2">ללא תאריך</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{undated.map(eventChip)}</div>
        </div>
      )}
    </div>
  );
}
