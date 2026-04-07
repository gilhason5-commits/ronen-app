import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, X, Calendar, Users, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function EventDetails({ event, onEdit, onClose }) {
  const statusColors = {
    draft: "bg-stone-100 text-stone-700",
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700"
  };

  return (
    <Card className="border-stone-200 sticky top-6">
      <CardHeader className="border-b border-stone-200 p-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Event Details</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-stone-900 mb-2">{event.name}</h3>
          <Badge className={statusColors[event.status]}>{event.status}</Badge>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-stone-600">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(event.event_date), "MMMM d, yyyy")}</span>
          </div>
          {event.event_time && (
            <div className="flex items-center gap-2 text-stone-600">
              <span className="font-medium">Time:</span>
              <span>{event.event_time}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-stone-600">
            <Users className="w-4 h-4" />
            <span>{event.guests} guests</span>
          </div>
          <div className="flex items-center gap-2 text-stone-600">
            <span className="font-medium">Service:</span>
            <span className="capitalize">{event.service_style}</span>
          </div>
        </div>

        {event.selected_dishes?.length > 0 && (
          <div>
            <p className="font-medium text-sm text-stone-700 mb-2">Selected Dishes</p>
            <div className="space-y-2">
              {event.selected_dishes.map((dish, idx) => (
                <div key={idx} className="text-sm p-2 bg-stone-50 rounded">
                  <p className="font-medium">{dish.dish_name}</p>
                  <p className="text-xs text-stone-500">
                    Qty: {dish.quantity} × ${(dish.unit_cost || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-stone-200 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-stone-600">Revenue</span>
            <span className="font-semibold text-stone-900">
              ${(event.event_price || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-stone-600">Food Cost</span>
            <span className="font-semibold text-stone-900">
              ${(event.food_cost || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-stone-600">Margin</span>
            <span className={`font-semibold ${
              event.margin_pct >= 60 ? 'text-emerald-600' : 
              event.margin_pct >= 50 ? 'text-orange-600' : 'text-red-600'
            }`}>
              {(event.margin_pct || 0).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-semibold text-stone-700">Profit</span>
            <span className="font-bold text-emerald-600">
              ${((event.event_price || 0) - (event.food_cost || 0)).toFixed(2)}
            </span>
          </div>
        </div>

        {event.notes && (
          <div>
            <p className="font-medium text-sm text-stone-700 mb-1">Notes</p>
            <p className="text-sm text-stone-600">{event.notes}</p>
          </div>
        )}

        <Button 
          onClick={onEdit}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Event
        </Button>
      </CardContent>
    </Card>
  );
}