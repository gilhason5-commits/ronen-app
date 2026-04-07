import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Clock, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function TodayEvents({ events }) {
  const statusColors = {
    draft: "bg-stone-100 text-stone-700",
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700"
  };

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <CardTitle className="text-xl">Today's Events</CardTitle>
          </div>
          <Link to={createPageUrl("Events")}>
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">No events scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-xl border border-stone-200 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-stone-900 mb-1">{event.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-stone-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {event.event_time || 'TBD'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {event.guests} guests
                      </span>
                    </div>
                  </div>
                  <Badge className={statusColors[event.status]}>
                    {event.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-stone-900">
                      ${(event.event_price || 0).toFixed(2)}
                    </span>
                    {event.food_cost > 0 && (
                      <span className="text-stone-500">
                        • {event.margin_pct?.toFixed(1)}% margin
                      </span>
                    )}
                  </div>
                  <Link to={`${createPageUrl("Events")}?id=${event.id}`}>
                    <Button variant="ghost" size="sm">View Details</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}