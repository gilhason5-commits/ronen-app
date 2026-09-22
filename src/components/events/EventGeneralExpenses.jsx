import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtCurrency } from "../utils/formatNumbers";

// Flat per-event expenses (security, transport, setup, etc.) picked from a
// reusable catalog — Dish rows under a Category whose group_type is
// 'general'. Unlike the guest-count driven dish tree in EventStages, these
// just need a name and an amount, stored independently in
// Event_GeneralExpense so they never affect food cost/waste calculations.
export default function EventGeneralExpenses({ event, generalDishes, generalCategories }) {
  const queryClient = useQueryClient();
  const [selectedDishId, setSelectedDishId] = useState("");
  const [amount, setAmount] = useState("");

  const { data: expenses = [] } = useQuery({
    queryKey: ["event_general_expenses", event.id],
    queryFn: () => base44.entities.Event_GeneralExpense.filter({ event_id: event.id }),
    initialData: [],
  });

  const addExpense = useMutation({
    mutationFn: ({ expense_name, category_name, amount }) =>
      base44.entities.Event_GeneralExpense.create({
        event_id: event.id,
        expense_name,
        category_name,
        amount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_general_expenses", event.id] });
      setSelectedDishId("");
      setAmount("");
    },
    onError: (e) => toast.error(e.message || "הוספת ההוצאה נכשלה"),
  });

  const removeExpense = useMutation({
    mutationFn: (id) => base44.entities.Event_GeneralExpense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event_general_expenses", event.id] }),
    onError: (e) => toast.error(e.message || "מחיקת ההוצאה נכשלה"),
  });

  const handleAdd = () => {
    const dish = generalDishes.find((d) => d.id === selectedDishId);
    const amountNum = parseFloat(amount);
    if (!dish || !amountNum) return;
    const category = generalCategories.find((c) => dish.categories?.includes(c.id));
    addExpense.mutate({
      expense_name: dish.name,
      category_name: category?.name || null,
      amount: amountNum,
    });
  };

  const total = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <CardTitle className="text-lg">הוצאות כלליות</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {expenses.length > 0 && (
          <div className="space-y-2">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 truncate">{exp.expense_name}</p>
                  {exp.category_name && <p className="text-xs text-stone-500">{exp.category_name}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-stone-900">{fmtCurrency(exp.amount)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:bg-red-50"
                    onClick={() => removeExpense.mutate(exp.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200 font-bold text-stone-900">
              <span>סה״כ הוצאות כלליות</span>
              <span>{fmtCurrency(total)}</span>
            </div>
          </div>
        )}

        {expenses.length === 0 && (
          <p className="text-sm text-stone-400">לא נוספו הוצאות כלליות לאירוע זה.</p>
        )}

        <div className="flex items-end gap-2 pt-2">
          <div className="flex-1">
            <Select value={selectedDishId} onValueChange={setSelectedDishId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג הוצאה..." />
              </SelectTrigger>
              <SelectContent>
                {generalDishes.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-stone-400">
                    אין סוגי הוצאה כלליים מוגדרים — הוסף ב״מנות ותפריטים״ ← קטגוריית כלליות
                  </div>
                )}
                {generalDishes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            step="0.01"
            placeholder="סכום (₪)"
            className="w-32 shrink-0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selectedDishId || !amount}
            className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
          >
            <Plus className="w-4 h-4 ml-1" />
            הוסף
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
