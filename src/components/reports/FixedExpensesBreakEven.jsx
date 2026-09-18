import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { fmtCurrency } from "../utils/formatNumbers";

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Same per-event total-revenue formula as EventSummary.jsx: food revenue
// (price_per_plate × guests, falling back to event_price) plus every
// addition line item — kept in sync manually since there's no shared entity
// to compute it from server-side.
function eventTotalRevenue(e) {
  const guestCount = e.guest_count ?? e.total_guests ?? 0;
  const calculatedRevenue = (parseFloat(e.price_per_plate) || 0) * (parseFloat(guestCount) || 0);
  const foodRevenue = calculatedRevenue || parseFloat(e.event_price) || 0;
  const additions =
    (parseFloat(e.lighting_sound_cost) || 0) +
    (parseFloat(e.after_party_food_cost) || 0) +
    (parseFloat(e.custom_addition_1_amount) || 0) +
    (parseFloat(e.custom_addition_2_amount) || 0);
  return foodRevenue + additions;
}

export default function FixedExpensesBreakEven({ events = [] }) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const { data: expenses = [] } = useQuery({
    queryKey: ["fixedExpenses"],
    queryFn: () => base44.entities.FixedExpense.list("sort_order"),
    initialData: [],
  });

  const create = useMutation({
    mutationFn: (data) => base44.entities.FixedExpense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] });
      setNewName("");
      setNewAmount("");
      toast.success("ההוצאה נוספה");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FixedExpense.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] }),
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.FixedExpense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] }),
    onError: (e) => toast.error(e.message),
  });

  const activeTotal = useMemo(
    () => expenses.filter((e) => e.is_active).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    [expenses]
  );

  const monthEvents = useMemo(() => {
    const key = monthKey(month);
    return events.filter((e) => e.event_date && e.status !== "cancelled" && e.event_date.slice(0, 7) === key);
  }, [events, month]);

  const monthRevenue = useMemo(() => monthEvents.reduce((sum, e) => sum + eventTotalRevenue(e), 0), [monthEvents]);
  const avgRevenuePerEvent = monthEvents.length > 0 ? monthRevenue / monthEvents.length : 0;
  const breakEvenPerEvent = monthEvents.length > 0 ? activeTotal / monthEvents.length : 0;
  const monthLabel = month.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  const shiftMonth = (dir) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));

  return (
    <Card className="border-stone-200">
      <CardHeader className="p-5 border-b border-stone-200">
        <CardTitle className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-stone-500" /> הוצאות קבועות ונקודת איזון
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="flex items-center gap-2">
              <Switch checked={exp.is_active} onCheckedChange={(v) => update.mutate({ id: exp.id, data: { is_active: v } })} />
              <Input
                className="flex-1"
                defaultValue={exp.name}
                onBlur={(e) => { if (e.target.value !== exp.name) update.mutate({ id: exp.id, data: { name: e.target.value } }); }}
              />
              <Input
                type="number"
                step="0.01"
                className="w-32"
                defaultValue={exp.amount}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  if (v !== exp.amount) update.mutate({ id: exp.id, data: { amount: v } });
                }}
              />
              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { if (confirm(`למחוק את "${exp.name}"?`)) remove.mutate(exp.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {expenses.length === 0 && <p className="text-sm text-stone-400">אין הוצאות קבועות מוגדרות</p>}
        </div>

        <div className="flex gap-2">
          <Input placeholder="שם ההוצאה (למשל שכירות)" className="flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input type="number" step="0.01" placeholder="סכום" className="w-32" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
          <Button
            disabled={!newName.trim() || !newAmount}
            onClick={() => create.mutate({ name: newName.trim(), amount: parseFloat(newAmount) || 0, is_active: true, sort_order: expenses.length })}
          >
            <Plus className="w-4 h-4 ml-1" /> הוספה
          </Button>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-stone-700">חישוב לפי חודש</p>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shiftMonth(1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
              <span className="text-xs font-medium w-24 text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shiftMonth(-1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-stone-500 mb-1">סה״כ הוצאות קבועות</p>
              <p className="text-xl font-bold text-stone-900">{fmtCurrency(activeTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500 mb-1">אירועים בחודש</p>
              <p className="text-xl font-bold text-stone-900">{monthEvents.length}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500 mb-1">הכנסה ממוצעת לאירוע</p>
              <p className="text-xl font-bold text-stone-900">{fmtCurrency(avgRevenuePerEvent)}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500 mb-1">נדרש לאירוע לנקודת איזון</p>
              <p className={`text-xl font-bold ${avgRevenuePerEvent >= breakEvenPerEvent ? "text-emerald-600" : "text-red-600"}`}>
                {monthEvents.length > 0 ? fmtCurrency(breakEvenPerEvent) : "—"}
              </p>
            </div>
          </div>
          {monthEvents.length === 0 && (
            <p className="text-xs text-stone-400 mt-2">אין אירועים בחודש זה — לא ניתן לחשב חלוקה לאירוע</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
