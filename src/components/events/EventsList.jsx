import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Edit, Trash2, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtCurrency } from "../utils/formatNumbers";

export default function EventsList({ events, isLoading, onEdit, onDelete }) {
  const statusColors = {
    in_progress: "bg-emerald-100 text-emerald-700",
    completed: "bg-blue-100 text-blue-700",
    producer_draft: "bg-amber-100 text-amber-700",
  };

  const statusLabels = {
    in_progress: "בתהליך",
    completed: "הושלם",
    producer_draft: "טיוטת מפיק",
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">לא נמצאו אירועים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <Card 
          key={event.id}
          className="border-stone-200 hover:shadow-md transition-shadow"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-stone-900 mb-2">
                  {event.event_name}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(event.event_date), "MMM d, yyyy")}
                  </span>
                  {event.event_time && (
                    <span>{event.event_time}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {event.guest_count} סועדים
                  </span>
                  {event.event_type && (
                    <span className="capitalize">{event.event_type}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge className={statusColors[event.status]}>
                  {statusLabels[event.status] || event.status}
                </Badge>
                {event.producer_approved ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 ml-1" />
                    מאושר סופית
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                    <Clock className="w-3 h-3 ml-1" />
                    ממתין לאישור המפיק
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <div className="flex items-center gap-6 text-sm">
                {event.event_price > 0 && (
                  <div>
                    <p className="text-xs text-stone-500">הכנסה מאוכל</p>
                    <p className="font-semibold text-stone-900">
                      {fmtCurrency(event.event_price)}
                    </p>
                  </div>
                )}
                {event.food_cost_sum > 0 && (
                  <div>
                    <p className="text-xs text-stone-500">עלות אוכל</p>
                    <p className="font-semibold text-stone-900">
                      {fmtCurrency(event.food_cost_sum)}
                    </p>
                  </div>
                )}
                {event.event_price > 0 && event.food_cost_sum > 0 && (
                  <div>
                    <p className="text-xs text-stone-500">רווח</p>
                    <p className={`font-semibold ${(event.event_price - event.food_cost_sum) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtCurrency(event.event_price - event.food_cost_sum)}
                    </p>
                  </div>
                )}
                {event.food_cost_pct != null && (
                  <div>
                    <p className="text-xs text-stone-500">אחוז עלות אוכל</p>
                    <p className={`font-semibold ${
                      event.food_cost_pct <= 30 ? 'text-emerald-600' :
                      event.food_cost_pct <= 35 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {event.food_cost_pct.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(event)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  עריכה
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    if (confirm(`האם אתה בטוח שברצונך למחוק את "${event.event_name}"?`)) {
                      onDelete(event.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}