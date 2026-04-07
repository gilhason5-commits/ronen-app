import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Phone, 
  User, 
  Key,
  Bell,
  ArrowUpCircle,
  Filter,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AvailabilityStatusPanel from "./AvailabilityStatusPanel";

// Calculate actual status based on time and DB status
const calculateStatus = (assignment) => {
  const now = new Date();
  const endTime = assignment.end_time ? new Date(assignment.end_time) : null;
  
  if (assignment.status === 'DONE') return 'DONE';
  if (assignment.status === 'NOT_DONE') return 'NOT_DONE';
  if (assignment.status === 'OVERDUE') return 'OVERDUE';
  if (assignment.status === 'NOT_ARRIVING') return 'NOT_ARRIVING';
  
  // Check if pending but past end time
  if (assignment.status === 'PENDING' && endTime && now > endTime) {
    return 'OVERDUE';
  }
  
  return 'PENDING';
};

// Status configuration
const statusConfig = {
  DONE: {
    label: 'בוצע',
    icon: CheckCircle2,
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-l-green-500',
    cardBg: 'bg-white/80',
    emoji: '✅'
  },
  NOT_DONE: {
    label: 'לא בוצע',
    icon: XCircle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-l-red-500',
    cardBg: 'bg-red-50',
    emoji: '❌'
  },
  OVERDUE: {
    label: 'באיחור',
    icon: AlertTriangle,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-l-orange-500',
    cardBg: 'bg-amber-50',
    emoji: '⚠️',
    pulse: true
  },
  PENDING: {
    label: 'ממתין',
    icon: Clock,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-l-blue-500',
    cardBg: 'bg-white',
    emoji: '⏳'
  },
  NOT_ARRIVING: {
    label: 'לא מגיע',
    icon: AlertTriangle,
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-l-yellow-500',
    cardBg: 'bg-yellow-50',
    emoji: '🚫'
  }
};

// Format delay time
const formatDelay = (endTime) => {
  if (!endTime) return '';
  const now = new Date();
  const end = new Date(endTime);
  const delayMinutes = differenceInMinutes(now, end);
  
  if (delayMinutes < 0) return '';
  if (delayMinutes < 60) return `${delayMinutes} דקות איחור`;
  
  const hours = Math.floor(delayMinutes / 60);
  const minutes = delayMinutes % 60;
  return `${hours} שעות ו-${minutes} דקות איחור`;
};

// Format time until start
const formatTimeUntilStart = (startTime) => {
  if (!startTime) return '';
  const now = new Date();
  const start = new Date(startTime);
  const minutesUntil = differenceInMinutes(start, now);
  
  if (minutesUntil <= 0) return '';
  if (minutesUntil < 60) return `מתחיל בעוד ${minutesUntil} דקות`;
  
  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  return `מתחיל בעוד ${hours} שעות ו-${minutes} דקות`;
};

// Task Card Component
function TaskCard({ assignment, status }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[status];
  const Icon = config.icon;
  
  const startTime = assignment.start_time ? format(parseISO(assignment.start_time), 'HH:mm') : '--:--';
  const endTime = assignment.end_time ? format(parseISO(assignment.end_time), 'HH:mm') : '--:--';
  
  return (
    <div
      id={`task-card-${assignment.id}`}
      className={`border-l-4 ${config.borderColor} ${config.cardBg} rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${config.pulse ? 'animate-pulse' : ''} ${status === 'DONE' ? 'opacity-80' : ''}`}
    >
      <div className="p-4">
        {/* Status Badge */}
        <div className="flex items-start justify-between mb-3">
          <Badge 
            id={`task-badge-${assignment.id}`}
            className={`${config.bgColor} ${config.textColor} flex items-center gap-1.5 px-3 py-1`}
            aria-label={`סטטוס: ${config.label}`}
          >
            <Icon className="w-4 h-4" />
            {config.label}
          </Badge>
          
          {assignment.task_description && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
        
        {/* Task Title */}
        <h4 className="font-bold text-lg text-stone-900 mb-2 flex items-center gap-2">
          📋 {assignment.task_title}
        </h4>
        
        {/* Employee Info */}
        <div className="flex items-center gap-2 text-stone-700 mb-1">
          <User className="w-4 h-4 text-stone-500" />
          <span className="font-medium">{assignment.assigned_to_name || 'לא מוקצה'}</span>
          {assignment.assigned_to_phone && (
            <span className="text-stone-500 text-sm flex items-center gap-1">
              <Phone className="w-3 h-3" />
              ({assignment.assigned_to_phone})
            </span>
          )}
        </div>
        {assignment.additional_employees?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1 mr-6">
            {assignment.additional_employees.map((emp, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-white">
                {emp.employee_name}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Time Window */}
        <div className="flex items-center gap-2 text-stone-600 mb-3">
          <Clock className="w-4 h-4 text-stone-500" />
          <span>{startTime} - {endTime}</span>
        </div>
        
        {/* Description (expandable) */}
        {expanded && assignment.task_description && (
          <div className="bg-stone-100 rounded p-3 mb-3 text-sm text-stone-600">
            {assignment.task_description}
          </div>
        )}
        
        {/* Status-specific info */}
        <div id={`task-details-${assignment.id}`} className="space-y-1.5 text-sm">
          {status === 'DONE' && assignment.completed_at && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              הושלם בתאריך: {format(parseISO(assignment.completed_at), 'dd/MM/yyyy HH:mm')}
            </div>
          )}
          
          {status === 'NOT_DONE' && (
            <>
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4" />
                העובד דיווח שלא ביצע
              </div>
              {assignment.escalation_sent_at && (
                <div className="flex items-center gap-2 text-orange-700">
                  <ArrowUpCircle className="w-4 h-4" />
                  הועבר למנהל ב-{format(parseISO(assignment.escalation_sent_at), 'HH:mm')}
                </div>
              )}
            </>
          )}
          
          {status === 'OVERDUE' && (
            <>
              <div className="flex items-center gap-2 text-orange-700 font-medium">
                <AlertTriangle className="w-4 h-4" />
                {formatDelay(assignment.end_time)}
              </div>
              {assignment.escalation_sent_at && (
                <div className="flex items-center gap-2 text-orange-600">
                  <ArrowUpCircle className="w-4 h-4" />
                  הועבר למנהל ב-{format(parseISO(assignment.escalation_sent_at), 'HH:mm')}
                </div>
              )}
            </>
          )}
          
          {status === 'PENDING' && (
            <>
              {assignment.last_notification_start_sent_at && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Bell className="w-4 h-4" />
                  תזכורת נשלחה ב-{format(parseISO(assignment.last_notification_start_sent_at), 'HH:mm')}
                </div>
              )}
              {assignment.last_notification_end_sent_at && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Bell className="w-4 h-4" />
                  תזכורת אחרונה נשלחה ב-{format(parseISO(assignment.last_notification_end_sent_at), 'HH:mm')}
                </div>
              )}
              {assignment.start_time && new Date() < new Date(assignment.start_time) && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Clock className="w-4 h-4" />
                  {formatTimeUntilStart(assignment.start_time)}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* WhatsApp Token */}
        {assignment.whatsapp_token && (
          <div className="mt-3 pt-3 border-t border-stone-200 flex items-center gap-2 text-stone-400 text-xs">
            <Key className="w-3 h-3" />
            קוד: <span className="font-mono blur-sm hover:blur-none transition-all">{assignment.whatsapp_token}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventTasksStatusView({ eventId, event }) {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('time');
  const queryClient = useQueryClient();

  // Query for task assignments - filtered by event_id
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['taskAssignments', 'status', eventId],
    queryFn: async () => {
      // CRITICAL: Filter by event_id to get only this event's tasks
      const data = await base44.entities.TaskAssignment.filter({ event_id: eventId });
      return data;
    },
    initialData: [],
    enabled: !!eventId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchIntervalInBackground: false,
  });

  // Process assignments with calculated status
  const processedAssignments = useMemo(() => {
    return assignments.map(a => ({
      ...a,
      calculatedStatus: calculateStatus(a)
    }));
  }, [assignments]);

  // Count by status
  const statusCounts = useMemo(() => {
    return processedAssignments.reduce((acc, a) => {
      acc[a.calculatedStatus] = (acc[a.calculatedStatus] || 0) + 1;
      return acc;
    }, { DONE: 0, NOT_DONE: 0, OVERDUE: 0, PENDING: 0, NOT_ARRIVING: 0 });
  }, [processedAssignments]);

  // Filtered and sorted assignments
  const filteredAssignments = useMemo(() => {
    let filtered = processedAssignments;
    
    // Apply filter
    if (filter !== 'all') {
      filtered = filtered.filter(a => a.calculatedStatus === filter);
    }
    
    // Apply sort
    if (sortBy === 'time') {
      filtered = [...filtered].sort((a, b) => {
        const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
        const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
        return timeA - timeB;
      });
    } else if (sortBy === 'status') {
      const statusOrder = { OVERDUE: 0, NOT_DONE: 1, NOT_ARRIVING: 2, PENDING: 3, DONE: 4 };
      filtered = [...filtered].sort((a, b) => 
        statusOrder[a.calculatedStatus] - statusOrder[b.calculatedStatus]
      );
    }
    
    return filtered;
  }, [processedAssignments, filter, sortBy]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-stone-500">טוען משימות...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Availability Status Panel - at the top */}
      <AvailabilityStatusPanel eventId={eventId} eventDate={event?.event_date} />

      {/* Header with Summary */}
      <Card className="bg-gradient-to-br from-stone-50 to-stone-100 border-stone-200">
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-stone-900">
              משימות האירוע: {event?.event_name}
            </h2>
            <p className="text-stone-500">
              תאריך אירוע: {event?.event_date ? format(parseISO(event.event_date), 'dd/MM/yyyy') : '-'}
            </p>
          </div>
          
          {/* Status Summary */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">{statusCounts.DONE}</span> בוצעו
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{statusCounts.PENDING}</span> ממתינים
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">{statusCounts.OVERDUE}</span> באיחור
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 rounded-full">
              <XCircle className="w-4 h-4" />
              <span className="font-medium">{statusCounts.NOT_DONE}</span> לא בוצעו
            </div>
            {statusCounts.NOT_ARRIVING > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">{statusCounts.NOT_ARRIVING}</span> לא מגיעים
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-500" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 bg-white">
              <SelectValue placeholder="סינון" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל ({processedAssignments.length})</SelectItem>
              <SelectItem value="PENDING">ממתינים ({statusCounts.PENDING})</SelectItem>
              <SelectItem value="DONE">בוצעו ({statusCounts.DONE})</SelectItem>
              <SelectItem value="OVERDUE">באיחור ({statusCounts.OVERDUE})</SelectItem>
              <SelectItem value="NOT_DONE">לא בוצעו ({statusCounts.NOT_DONE})</SelectItem>
              <SelectItem value="NOT_ARRIVING">לא מגיעים ({statusCounts.NOT_ARRIVING})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 bg-white">
            <SelectValue placeholder="מיון" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="time">לפי זמן</SelectItem>
            <SelectItem value="status">לפי סטטוס</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="text-xs text-stone-400 mr-auto">
          מתעדכן אוטומטית כל 30 שניות
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssignments.map(assignment => (
          <TaskCard 
            key={assignment.id} 
            assignment={assignment} 
            status={assignment.calculatedStatus}
          />
        ))}
      </div>

      {filteredAssignments.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-stone-700 mb-2">
              {filter === 'all' ? 'אין משימות לאירוע זה' : 'אין משימות בסטטוס זה'}
            </h3>
            <p className="text-stone-500">
              {filter === 'all' 
                ? 'הוסף משימות מהלשונית "תכנון אירוע"'
                : 'בחר סינון אחר לצפייה במשימות נוספות'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}