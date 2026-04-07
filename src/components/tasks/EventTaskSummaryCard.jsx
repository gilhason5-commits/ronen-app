import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Bell, ArrowUpCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const statusConfig = {
  PENDING: { badge: "bg-blue-100 text-blue-700", label: "ממתין" },
  DONE: { badge: "bg-green-100 text-green-700", label: "בוצע" },
  NOT_DONE: { badge: "bg-red-100 text-red-700", label: "לא בוצע" },
  OVERDUE: { badge: "bg-orange-100 text-orange-700", label: "באיחור" },
  NOT_ARRIVING: { badge: "bg-yellow-100 text-yellow-700", label: "לא מגיע" },
};

function calculateStatus(assignment) {
  const now = new Date();
  const endTime = assignment.end_time ? new Date(assignment.end_time) : null;
  if (assignment.status === 'DONE') return 'DONE';
  if (assignment.status === 'NOT_DONE') return 'NOT_DONE';
  if (assignment.status === 'OVERDUE') return 'OVERDUE';
  if (assignment.status === 'NOT_ARRIVING') return 'NOT_ARRIVING';
  if (assignment.status === 'PENDING' && endTime && now > endTime) return 'OVERDUE';
  return 'PENDING';
}

export default function EventTaskSummaryCard({ assignment }) {
  const status = calculateStatus(assignment);
  const config = statusConfig[status] || statusConfig.PENDING;

  const startTime = assignment.start_time ? format(parseISO(assignment.start_time), 'HH:mm') : '--:--';
  const endTime = assignment.end_time ? format(parseISO(assignment.end_time), 'HH:mm') : '--:--';

  return (
    <div className="border-2 rounded-lg p-3 bg-white border-stone-200 transition-all">
      <div className="flex items-start justify-between mb-1.5">
        <h4 className="font-semibold text-sm leading-tight flex-1 text-stone-900">
          {assignment.task_title}
        </h4>
        <Badge className={`${config.badge} text-xs mr-2 flex-shrink-0`}>
          {config.label}
        </Badge>
      </div>

      {assignment.task_description && (
        <p className="text-xs text-stone-500 mb-2 leading-relaxed line-clamp-2">
          {assignment.task_description}
        </p>
      )}

      <div className="flex items-center gap-1.5 text-xs text-stone-600 mb-1">
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>{startTime} - {endTime}</span>
      </div>

      {assignment.last_notification_start_sent_at && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600">
          <Bell className="w-3 h-3 flex-shrink-0" />
          <span>תזכורת נשלחה ב-{format(parseISO(assignment.last_notification_start_sent_at), 'HH:mm')}</span>
        </div>
      )}

      {assignment.escalation_sent_at && (
        <div className="flex items-center gap-1.5 text-xs text-orange-600">
          <ArrowUpCircle className="w-3 h-3 flex-shrink-0" />
          <span>הועבר למנהל ב-{format(parseISO(assignment.escalation_sent_at), 'HH:mm')}</span>
        </div>
      )}

      {status === 'DONE' && assignment.completed_at && (
        <p className="text-xs text-green-600 mt-1">
          הושלם: {format(parseISO(assignment.completed_at), "dd/MM HH:mm")}
        </p>
      )}
    </div>
  );
}