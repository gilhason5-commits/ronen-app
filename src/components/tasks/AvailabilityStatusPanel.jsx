import React from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Bell, 
  ArrowUpCircle,
  UserCheck
} from "lucide-react";
import { format, parseISO } from "date-fns";

const availabilityConfig = {
  CONFIRMED_AVAILABLE: {
    label: 'מגיע',
    icon: CheckCircle2,
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-500',
    cardBg: 'bg-green-50'
  },
  CONFIRMED_UNAVAILABLE: {
    label: 'לא מגיע',
    icon: XCircle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-500',
    cardBg: 'bg-red-50'
  },
  NO_RESPONSE: {
    label: 'לא ענה',
    icon: XCircle,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-500',
    cardBg: 'bg-orange-50'
  },
  PENDING: {
    label: 'ממתין לתשובה',
    icon: Clock,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-500',
    cardBg: 'bg-blue-50'
  }
};

function formatDateTime(dt) {
  if (!dt) return null;
  return format(parseISO(dt), 'dd/MM HH:mm');
}

function EmployeeAvailabilityCard({ record }) {
  const config = availabilityConfig[record.confirmation_status] || availabilityConfig.PENDING;
  const Icon = config.icon;

  return (
    <div className={`border-2 ${config.borderColor} ${config.cardBg} rounded-xl p-4 transition-all`}>
      {/* Header: name + badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-stone-900 text-sm">{record.employee_name || 'עובד'}</span>
        <Badge className={`${config.bgColor} ${config.textColor} flex items-center gap-1 px-2 py-0.5 text-xs`}>
          <Icon className="w-3.5 h-3.5" />
          {config.label}
        </Badge>
      </div>

      {/* Timeline details */}
      <div className="space-y-1.5 text-xs text-stone-600">
        {record.confirmation_sent_at && (
          <div className="flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-blue-500" />
            <span>הודעה נשלחה: {formatDateTime(record.confirmation_sent_at)}</span>
          </div>
        )}
        {record.confirmation_response_at && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span>תשובה התקבלה: {formatDateTime(record.confirmation_response_at)}</span>
          </div>
        )}
        {record.manager_notified_at && (
          <div className="flex items-center gap-1.5">
            <ArrowUpCircle className="w-3.5 h-3.5 text-orange-600" />
            <span>אסקלציה למנהל: {formatDateTime(record.manager_notified_at)}</span>
          </div>
        )}
        {!record.confirmation_sent_at && (
          <div className="flex items-center gap-1.5 text-stone-400">
            <Clock className="w-3.5 h-3.5" />
            <span>טרם נשלחה הודעה</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AvailabilityStatusPanel({ eventId, eventDate }) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['employeeDailyAvailability', eventId],
    queryFn: async () => {
      return base44.entities.EmployeeDailyAvailability.filter({ event_id: eventId });
    },
    initialData: [],
    enabled: !!eventId,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-stone-500 text-sm">טוען סטטוס הגעה...</p>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-dashed border-stone-300">
        <CardContent className="p-6 text-center">
          <UserCheck className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 text-sm">אין נתוני הגעה לאירוע זה עדיין</p>
          <p className="text-stone-400 text-xs mt-1">הודעות יישלחו לעובדים בהתאם לתזמון</p>
        </CardContent>
      </Card>
    );
  }

  // Count by status
  const counts = records.reduce((acc, r) => {
    acc[r.confirmation_status] = (acc[r.confirmation_status] || 0) + 1;
    return acc;
  }, { CONFIRMED_AVAILABLE: 0, CONFIRMED_UNAVAILABLE: 0, NO_RESPONSE: 0, PENDING: 0 });

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-stone-900">סטטוס הגעה</h3>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          <div className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-medium">{counts.CONFIRMED_AVAILABLE}</span> מגיעים
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-medium">{counts.CONFIRMED_UNAVAILABLE}</span> לא מגיעים
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-medium">{counts.NO_RESPONSE}</span> לא ענו
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{counts.PENDING}</span> ממתינים
          </div>
        </div>

        {/* Employee grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {records.map(record => (
            <EmployeeAvailabilityCard key={record.id} record={record} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}