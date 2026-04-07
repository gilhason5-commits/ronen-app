import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
  Calendar, 
  Package, 
  ShoppingCart, 
  FileText,
  UtensilsCrossed,
  Users,
  Clock,
  ClipboardList,
  UserCheck,
  FolderOpen,
  ListTodo
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function RecentActivity() {
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-created_date', 10),
    initialData: [],
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 10),
    initialData: [],
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list('-created_date', 10),
    initialData: [],
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list('-created_date', 10),
    initialData: [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('-created_date', 10),
    initialData: [],
  });

  const { data: taskAssignments = [] } = useQuery({
    queryKey: ['taskAssignments'],
    queryFn: () => base44.entities.TaskAssignment.list('-created_date', 10),
    initialData: [],
  });

  const { data: taskEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list('-created_date', 10),
    initialData: [],
  });

  const { data: taskCategories = [] } = useQuery({
    queryKey: ['taskCategories'],
    queryFn: () => base44.entities.TaskCategory.list('-created_date', 10),
    initialData: [],
  });

  const { data: taskTemplates = [] } = useQuery({
    queryKey: ['taskTemplates'],
    queryFn: () => base44.entities.TaskTemplate.list('-created_date', 10),
    initialData: [],
  });

  // Combine and sort all activities
  const activities = [
    ...events.map(e => ({
      type: 'event',
      icon: Calendar,
      title: e.event_name,
      description: `אירוע חדש - ${e.guest_count} סועדים`,
      time: e.created_date,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: createPageUrl('Events')
    })),
    ...purchaseOrders.map(po => ({
      type: 'purchase_order',
      icon: ShoppingCart,
      title: po.po_number || 'הזמנת רכש',
      description: `${po.supplier_name} - ₪${(po.subtotal || 0).toFixed(0)}`,
      time: po.created_date,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      link: createPageUrl('PurchaseOrders')
    })),
    ...ingredients.map(ing => ({
      type: 'ingredient',
      icon: Package,
      title: ing.name,
      description: 'רכיב חדש נוסף למלאי',
      time: ing.created_date,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: createPageUrl('Ingredients')
    })),
    ...dishes.map(dish => ({
      type: 'dish',
      icon: UtensilsCrossed,
      title: dish.name,
      description: 'מנה חדשה נוספה לתפריט',
      time: dish.created_date,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      link: createPageUrl('Dishes')
    })),
    ...suppliers.map(sup => ({
      type: 'supplier',
      icon: Users,
      title: sup.name,
      description: 'ספק חדש נוסף',
      time: sup.created_date,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      link: createPageUrl('Suppliers')
    })),
    ...taskAssignments.map(task => ({
      type: 'task_assignment',
      icon: ClipboardList,
      title: task.task_title || 'משימה',
      description: `הוקצתה ל-${task.assigned_to_name || 'לא ידוע'}`,
      time: task.created_date,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      link: createPageUrl('PerEventTasks')
    })),
    ...taskEmployees.map(emp => ({
      type: 'task_employee',
      icon: UserCheck,
      title: emp.full_name,
      description: `עובד חדש - ${emp.department_name || 'ללא מחלקה'}`,
      time: emp.created_date,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      link: createPageUrl('TaskEmployees')
    })),
    ...taskCategories.map(cat => ({
      type: 'task_category',
      icon: FolderOpen,
      title: cat.name,
      description: `קטגוריית משימות - ${cat.department || ''}`,
      time: cat.created_date,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      link: createPageUrl('TaskManagement')
    })),
    ...taskTemplates.map(tmpl => ({
      type: 'task_template',
      icon: ListTodo,
      title: tmpl.title,
      description: `תבנית משימה - ${tmpl.category_name || ''}`,
      time: tmpl.created_date,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      link: createPageUrl('TaskManagement')
    }))
  ]
  .sort((a, b) => new Date(b.time) - new Date(a.time))
  .slice(0, 8);

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-stone-500" />
            פעילות אחרונה
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-stone-500">
            אין פעילות אחרונה
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {activities.map((activity, idx) => {
              const Icon = activity.icon;
              const timeAgo = activity.time 
                ? formatDistanceToNow(new Date(activity.time), { 
                    addSuffix: true,
                    locale: he 
                  })
                : 'זה עתה';
              
              return (
                <Link
                  key={`${activity.type}-${idx}`}
                  to={activity.link}
                  className="flex items-start gap-3 p-4 hover:bg-stone-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${activity.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 truncate">
                      {activity.title}
                    </p>
                    <p className="text-sm text-stone-600 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      {timeAgo}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}