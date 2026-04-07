import React from "react";
import { Repeat } from "lucide-react";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function getRecurrenceLabel(task) {
  const time = task.recurrence_time || (task.start_time ? new Date(task.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  const type = task.recurrence_type;

  if (type === 'daily') {
    return `יומי | ${time} | ראשון עד חמישי כל שבוע, לתמיד`;
  }
  if (type === 'weekly') {
    const days = (task.recurrence_days || []).sort().map(d => dayNames[d]).join(', ');
    return `שבועי | ${time} | כל יום ${days}, לתמיד`;
  }
  if (type === 'monthly') {
    const dom = task.recurrence_day_of_month || 1;
    return `חודשי | ${time} | ה-${dom} בכל חודש, לתמיד`;
  }
  // once
  if (task.start_time) {
    const d = new Date(task.start_time);
    return `חד פעמי | ${d.toLocaleDateString('he-IL')} ${time}`;
  }
  return 'לא הוגדר';
}

function getStatusSummary(instances) {
  const done = instances.filter(i => i.status === 'DONE').length;
  const notDone = instances.filter(i => i.status === 'NOT_DONE').length;
  const overdue = instances.filter(i => i.status === 'OVERDUE').length;
  const pending = instances.filter(i => i.status === 'PENDING').length;
  return { done, notDone, overdue, pending, total: instances.length };
}

export default function RecurringTaskSummaryCard({ templateId, taskTitle, taskDescription, instances, onClick }) {
  const representative = instances[0];
  const recurrenceLabel = getRecurrenceLabel(representative);
  return (
    <div
      onClick={onClick}
      className="border-2 rounded-lg p-3 bg-white border-stone-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-1.5">
        <h4 className="font-semibold text-sm leading-tight flex-1 text-stone-900">{taskTitle}</h4>
      </div>

      {taskDescription && (
        <p className="text-xs text-stone-500 mb-2 leading-relaxed line-clamp-2">{taskDescription}</p>
      )}

      <div className="flex items-center gap-1.5 text-xs text-stone-600 mb-2">
        <Repeat className="w-3 h-3 flex-shrink-0" />
        <span>{recurrenceLabel}</span>
      </div>


    </div>
  );
}