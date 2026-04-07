import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  Package,
  FileText,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  MessageSquare,
  BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import KPICard from "../components/dashboard/KPICard";
import EventCalendar from "../components/dashboard/EventCalendar";
import RecentActivity from "../components/dashboard/RecentActivity";
import ARAPStatus from "../components/dashboard/ARAPStatus";


export default function Dashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date'),
    initialData: [],
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: [],
  });

  const { data: customerInvoices = [] } = useQuery({
    queryKey: ['customerInvoices'],
    queryFn: () => base44.entities.CustomerInvoice.list('-created_date'),
    initialData: [],
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ['supplierInvoices'],
    queryFn: () => base44.entities.SupplierInvoice.list('-created_date'),
    initialData: [],
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    initialData: [],
  });

  const todayEvents = events.filter(e => e.event_date === today && e.status === 'in_progress');
  
  const activeEvents = events.filter(e => e.status === 'in_progress');
  
  // Calculate average food cost percentage across all active events
  const avgFoodCostPct = activeEvents.length > 0 
    ? activeEvents.reduce((sum, e) => sum + (e.food_cost_pct || 0), 0) / activeEvents.length 
    : 0;

  // Calculate average cost per guest across all active events
  const avgCostPerGuest = activeEvents.length > 0 
    ? activeEvents.reduce((sum, e) => {
        const guestCount = e.guest_count || 0;
        const foodCost = e.food_cost_sum || 0;
        return sum + (guestCount > 0 ? foodCost / guestCount : 0);
      }, 0) / activeEvents.length
    : 0;

  const lowStockItems = ingredients.filter(ing => 
    (ing.on_hand_qty || 0) < 10
  );

  const overdueAR = customerInvoices.filter(inv => 
    inv.status === 'overdue' || (inv.status === 'sent' && new Date(inv.due_date) < new Date())
  );

  const dueAP = supplierInvoices.filter(inv => 
    inv.status === 'pending' || inv.status === 'overdue'
  );

  const posArrivingToday = purchaseOrders.filter(po => {
    if (!po.expected_date || po.status === 'received' || po.status === 'cancelled') return false;
    return po.expected_date === today;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">לוח בקרה</h1>
          <p className="text-stone-500 mt-1">ברוכים הבאים למערכת הניהול של ריי אירועים</p>
        </div>
        <div className="flex gap-3">
          <Link to={createPageUrl("Events")}>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              אירוע חדש
            </Button>
          </Link>
        </div>
      </div>

      {posArrivingToday.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-orange-900">
                  {posArrivingToday.length} הזמנת רכש {posArrivingToday.length > 1 ? 'צפויות' : 'צפויה'} להגיע היום
                </p>
                <div className="mt-2 space-y-1">
                  {posArrivingToday.map(po => (
                    <p key={po.id} className="text-sm text-orange-700">
                      {po.supplier_name} - {po.po_number}
                      {po.expected_time && ` at ${po.expected_time}`}
                    </p>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-orange-300 hover:bg-orange-100"
                  onClick={() => navigate(createPageUrl('PurchaseOrders'))}
                >
                  צפייה בהזמנות רכש
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="אחוז עלות אוכל"
          value={`${avgFoodCostPct.toFixed(1)}%`}
          icon={TrendingUp}
          trend={avgFoodCostPct < 30 ? "מצוין" : avgFoodCostPct < 35 ? "טוב" : "גבוה"}
          trendUp={avgFoodCostPct >= 35}
          color="emerald"
        />
        <KPICard
          title="אירועים פעילים"
          value={activeEvents.length}
          icon={Calendar}
          subtitle={`${todayEvents.length} היום`}
          color="blue"
        />
        <KPICard
          title="עלות ממוצעת לסועד"
          value={avgCostPerGuest}
          icon={DollarSign}
          color="purple"
          currency={true}
        />
        <KPICard
          title="פריטים במלאי נמוך"
          value={lowStockItems.length}
          icon={AlertCircle}
          color={lowStockItems.length > 0 ? "red" : "green"}
          alert={lowStockItems.length > 0}
        />
      </div>



      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <EventCalendar events={events} />
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-stone-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">סוכן אנליטיקה</h3>
                    <p className="text-sm text-stone-600 mt-1">
                      שאל שאלות על ביצועים ורווחיות
                    </p>
                  </div>
                </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    פתח שיחה ב-WhatsApp
                  </Button>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-gradient-to-br from-emerald-50 to-green-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">סוכן רכש חכם</h3>
                    <p className="text-sm text-stone-600 mt-1">
                      הכנת הזמנות והודעות לספקים
                    </p>
                  </div>
                </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    פתח שיחה ב-WhatsApp
                  </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}