import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import KitchenEventDetail from "@/components/kitchen/KitchenEventDetail";
import PurchasePlanning from "@/components/kitchen/PurchasePlanning";

export default function KitchenView() {
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [showPurchase, setShowPurchase] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date'),
    initialData: [],
  });

  const approvedEvents = events.filter(e => {
    if (!e.approved_for_kitchen) return false;
    if (!e.event_date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(e.event_date);
    eventDate.setHours(23, 59, 59, 999);
    return eventDate >= today;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">עמוד רכש</h1>
          <p className="text-stone-500 mt-1">אירועים מאושרים ותכנון הזמנות רכש</p>
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 text-sm font-bold">⚠️ יש לתכנן הזמנת רכש לכל האירועים של השבוע ביחד על מנת לקבל כמויות הכי מדויקות לתתי מנות ולמנוע הכנה מיותרת</p>
        </div>
        <Button
          onClick={() => setShowPurchase(!showPurchase)}
          variant={showPurchase ? "default" : "outline"}
          className={showPurchase ? "bg-emerald-600 hover:bg-emerald-700" : ""}
        >
          <ShoppingCart className="w-4 h-4 ml-2" />
          {showPurchase ? 'חזרה לאירועים' : 'תכנון הזמנות רכש'}
        </Button>
      </div>

      {showPurchase ? (
        <PurchasePlanning events={approvedEvents} />
      ) : (
        <>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
              ))}
            </div>
          ) : approvedEvents.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">אין אירועים מאושרים כרגע</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {approvedEvents.map(event => (
                <Card key={event.id} className="border-stone-200">
                  <CardContent className="p-6">
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-stone-900">{event.event_name}</h3>
                          <Badge className="bg-emerald-100 text-emerald-700">מאושר</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {event.event_date ? format(new Date(event.event_date), "dd/MM/yyyy") : '-'}
                          </span>
                          {event.event_time && <span>{event.event_time}</span>}
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {event.guest_count} סועדים
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        {expandedEventId === event.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </Button>
                    </div>

                    {expandedEventId === event.id && (
                      <div className="mt-6 border-t border-stone-200 pt-6">
                        <KitchenEventDetail event={event} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}