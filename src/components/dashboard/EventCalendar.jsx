import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  Users,
  X
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  addDays, addMonths, addWeeks, subMonths, subWeeks, subDays,
  isSameMonth, isSameDay, isToday, startOfDay, endOfDay,
  eachDayOfInterval, eachHourOfInterval, setHours } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusColors = {
  draft: "bg-stone-100 text-stone-700",
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700"
};

export default function EventCalendar({ events = [], onEventClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const getEventsForDate = (date) => {
    return events.filter(event => 
      isSameDay(new Date(event.event_date), date)
    );
  };

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation();
    setSelectedEvent(event);
  };

  // Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-lg overflow-hidden">
        {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map(day => (
          <div key={day} className="bg-stone-100 p-2 text-center text-xs font-semibold text-stone-600">
            {day}
          </div>
        ))}
        {days.map(day => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`bg-white min-h-[80px] p-1 cursor-pointer hover:bg-stone-50 transition-colors
                ${!isCurrentMonth ? 'bg-stone-50 text-stone-400' : ''}
                ${isSelected ? 'ring-2 ring-emerald-500 ring-inset' : ''}
              `}
            >
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                ${isToday(day) ? 'bg-emerald-600 text-white' : ''}
              `}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => handleEventClick(event, e)}
                    className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${statusColors[event.status]}`}
                  >
                    {event.event_name}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-stone-500 px-1">
                    +{dayEvents.length - 2} נוספים
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayEvents = getEventsForDate(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`bg-white border border-stone-200 rounded-lg p-2 min-h-[200px] cursor-pointer hover:border-emerald-300 transition-colors
                ${isSelected ? 'ring-2 ring-emerald-500' : ''}
              `}
            >
              <div className={`text-center mb-2 pb-2 border-b border-stone-100`}>
                <div className="text-xs text-stone-500">{format(day, 'EEE')}</div>
                <div className={`text-lg font-semibold w-8 h-8 mx-auto flex items-center justify-center rounded-full
                  ${isToday(day) ? 'bg-emerald-600 text-white' : 'text-stone-900'}
                `}>
                  {format(day, 'd')}
                </div>
              </div>
              <div className="space-y-1">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => handleEventClick(event, e)}
                    className={`text-xs p-1.5 rounded cursor-pointer hover:opacity-80 ${statusColors[event.status]}`}
                  >
                    <div className="font-medium truncate">{event.event_name}</div>
                    {event.event_time && (
                      <div className="text-[10px] opacity-75">{event.event_time}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Day View
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className={`text-center p-3 border-b border-stone-200 ${isToday(currentDate) ? 'bg-emerald-50' : 'bg-stone-50'}`}>
          <div className="text-sm text-stone-500">{format(currentDate, 'EEEE')}</div>
          <div className="text-2xl font-bold text-stone-900">{format(currentDate, 'MMMM d, yyyy')}</div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {dayEvents.length === 0 ? (
            <div className="p-8 text-center text-stone-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-2 text-stone-300" />
              <p>אין אירועים מתוכננים</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="p-4 hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-stone-900">{event.event_name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-stone-600">
                        {event.event_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {event.event_time}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {event.guest_count} סועדים
                        </span>
                      </div>
                    </div>
                    <Badge className={statusColors[event.status]}>
                      {event.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Selected Date Events Panel
  const renderSelectedDatePanel = () => {
    if (!selectedDate || viewMode === 'day') return null;
    const dayEvents = getEventsForDate(selectedDate);

    return (
      <div className="mt-4 bg-white border border-stone-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-900">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {dayEvents.length === 0 ? (
          <p className="text-sm text-stone-500">אין אירועים מתוכננים</p>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(event => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="p-3 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-stone-900">{event.event_name}</h4>
                    <div className="flex items-center gap-2 text-xs text-stone-600 mt-1">
                      {event.event_time && <span>{event.event_time}</span>}
                      <span>•</span>
                      <span>{event.guest_count} סועדים</span>
                    </div>
                  </div>
                  <Badge className={statusColors[event.status]}>{event.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getHeaderTitle = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM d, yyyy');
  };

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              היום
            </Button>
            <h2 className="text-lg font-semibold text-stone-900 ml-2">
              {getHeaderTitle()}
            </h2>
          </div>
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
            {[
              { mode: 'month', label: 'חודש' },
              { mode: 'week', label: 'שבוע' },
              { mode: 'day', label: 'יום' }
            ].map(({ mode, label }) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode(mode)}
                className={viewMode === mode ? 'bg-white shadow-sm' : ''}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
        {renderSelectedDatePanel()}
      </CardContent>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.event_name}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={statusColors[selectedEvent.status]}>
                  {selectedEvent.status}
                </Badge>
                <span className="text-sm text-stone-500 capitalize">
                  {selectedEvent.event_type}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-stone-500">תאריך</p>
                  <p className="font-medium">{format(new Date(selectedEvent.event_date), 'MMM d, yyyy')}</p>
                </div>
                {selectedEvent.event_time && (
                  <div>
                    <p className="text-stone-500">שעה</p>
                    <p className="font-medium">{selectedEvent.event_time}</p>
                  </div>
                )}
                <div>
                  <p className="text-stone-500">סועדים</p>
                  <p className="font-medium">{selectedEvent.guest_count}</p>
                </div>
                <div>
                  <p className="text-stone-500">הכנסה מאוכל</p>
                  <p className="font-medium">₪{(selectedEvent.food_revenue || 0).toFixed(2)}</p>
                </div>
              </div>

              {selectedEvent.notes && (
                <div>
                  <p className="text-sm text-stone-500">הערות</p>
                  <p className="text-sm">{selectedEvent.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Link to={`${createPageUrl('Events')}?edit=${selectedEvent.id}`} className="flex-1">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                    צפייה בפרטים
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}