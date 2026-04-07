import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const statusConfig = {
  PENDING: { color: "bg-blue-50 border-blue-300 text-blue-900", badge: "bg-blue-100 text-blue-700", label: "ממתין" },
  DONE: { color: "bg-green-50 border-green-300 text-green-900", badge: "bg-green-100 text-green-700", label: "בוצע" },
  NOT_DONE: { color: "bg-red-50 border-red-300 text-red-900", badge: "bg-red-100 text-red-700", label: "לא בוצע" },
  OVERDUE: { color: "bg-red-50 border-red-300 text-red-900", badge: "bg-red-100 text-red-700", label: "באיחור" },
  NOT_ARRIVING: { color: "bg-yellow-50 border-yellow-300 text-yellow-900", badge: "bg-yellow-100 text-yellow-700", label: "לא מגיע" },
};

export default function RecurringTaskCard({ task, timeFilter, onStatusChange }) {
  const config = statusConfig[task.status] || statusConfig.PENDING;

  const startDate = new Date(task.start_time);
  const showDate = timeFilter !== "day";

  return (
    <div className={`border-2 rounded-lg p-3 ${config.color} transition-all`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-sm leading-tight flex-1">{task.task_title}</h4>
        <Badge className={`${config.badge} text-xs mr-2 flex-shrink-0`}>
          {config.label}
        </Badge>
      </div>

      {task.task_description && (
        <p className="text-xs opacity-80 mb-2 leading-relaxed">{task.task_description}</p>
      )}

      <div className="flex items-center gap-1 text-xs opacity-70 mb-2">
        <Clock className="w-3 h-3" />
        <span>
          {showDate && format(startDate, "EEE d/M", { locale: he }) + " "}
          {format(startDate, "HH:mm")}
          {task.end_time && ` - ${format(new Date(task.end_time), "HH:mm")}`}
        </span>
      </div>

      {task.status === 'PENDING' && (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
            onClick={() => onStatusChange(task.id, 'DONE')}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            בוצע
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
            onClick={() => onStatusChange(task.id, 'NOT_DONE')}
          >
            <XCircle className="w-3 h-3 mr-1" />
            לא בוצע
          </Button>
        </div>
      )}

      {task.completed_at && (
        <p className="text-xs opacity-60 mt-1">
          הושלם: {format(new Date(task.completed_at), "dd/MM HH:mm")}
        </p>
      )}
    </div>
  );
}