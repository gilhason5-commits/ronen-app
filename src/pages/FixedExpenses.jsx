import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtCurrency } from "../components/utils/formatNumbers";

// The 4 section titles and the 2 freeform memo blocks are user-editable —
// stored as AppSetting key/value rows rather than a new table, matching the
// existing pattern (see RoleEditDialog.jsx's paused-employee flags).
const TITLE_KEYS = {
  cat1: "fixed_expenses_title_cat1",
  cat2: "fixed_expenses_title_cat2",
  cat3: "fixed_expenses_title_cat3",
  cat4: "fixed_expenses_title_cat4",
};
const MEMO_KEYS = { cat3: "fixed_expenses_memo_cat3", cat4: "fixed_expenses_memo_cat4" };
const DEFAULT_TITLES = { cat1: "קטגוריה 1", cat2: "קטגוריה 2", cat3: "קטגוריה 3", cat4: "קטגוריה 4" };
const SETTING_KEYS = [...Object.values(TITLE_KEYS), ...Object.values(MEMO_KEYS)];

// Debounced free-text field bound to an AppSetting row — local state so
// typing doesn't fire a request per keystroke, saved on blur.
function EditableSetting({ value, placeholder, className, multiline, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onSave(draft); };
  const Field = multiline ? Textarea : Input;
  return (
    <Field
      value={draft}
      placeholder={placeholder}
      className={className}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

function ExpenseTable({ title, category, expenses, onSaveTitle, onAdd, onUpdate, onRemove }) {
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const rows = expenses.filter((e) => (e.category || "cat1") === category);
  const subtotal = rows.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="border border-stone-300 rounded-lg overflow-hidden bg-white">
      <div className="border-b border-stone-300 bg-stone-50 px-4 py-2">
        <EditableSetting
          value={title}
          className="font-bold text-stone-900 border-0 bg-transparent px-0 h-auto text-base focus-visible:ring-0"
          onSave={onSaveTitle}
        />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-stone-500 text-xs">
            <th className="text-right font-medium px-4 py-2">שם</th>
            <th className="text-right font-medium px-2 py-2 w-28">סכום</th>
            <th className="text-right font-medium px-4 py-2">הערות</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((exp) => (
            <tr key={exp.id} className="border-b border-stone-100 last:border-0">
              <td className="px-4 py-1.5">
                <EditableSetting
                  value={exp.name || ""}
                  className="border-0 bg-transparent px-0 h-auto focus-visible:ring-0"
                  onSave={(v) => onUpdate(exp.id, { name: v })}
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={exp.amount}
                  className="border-0 bg-transparent px-0 h-auto focus-visible:ring-0"
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    if (v !== exp.amount) onUpdate(exp.id, { amount: v });
                  }}
                />
              </td>
              <td className="px-4 py-1.5">
                <EditableSetting
                  value={exp.notes || ""}
                  className="border-0 bg-transparent px-0 h-auto focus-visible:ring-0 text-stone-500"
                  onSave={(v) => onUpdate(exp.id, { notes: v })}
                />
              </td>
              <td>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => onRemove(exp.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-4 py-1.5">
              <Input
                placeholder="שם הוצאה חדשה..."
                className="h-8"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </td>
            <td className="px-2 py-1.5">
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                className="h-8 w-24"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </td>
            <td colSpan={2} className="px-4 py-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!newName.trim()}
                onClick={() => {
                  onAdd({ name: newName.trim(), amount: parseFloat(newAmount) || 0, category });
                  setNewName("");
                  setNewAmount("");
                }}
              >
                <Plus className="w-3.5 h-3.5 ml-1" /> הוספה
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="border-t border-stone-200 bg-stone-50 px-4 py-2 flex items-center justify-between text-sm">
        <span className="text-stone-500">סה״כ {title}</span>
        <span className="font-bold text-stone-900">{fmtCurrency(subtotal)}</span>
      </div>
    </div>
  );
}

function MemoBlock({ title, memo, onSaveTitle, onSaveMemo }) {
  return (
    <div className="border border-stone-300 rounded-lg overflow-hidden bg-white flex flex-col h-full">
      <div className="border-b border-stone-300 bg-stone-50 px-4 py-2">
        <EditableSetting
          value={title}
          className="font-bold text-stone-900 border-0 bg-transparent px-0 h-auto text-base focus-visible:ring-0"
          onSave={onSaveTitle}
        />
      </div>
      <Textarea
        defaultValue={memo}
        placeholder="כתיבה חופשית..."
        className="flex-1 min-h-[180px] border-0 rounded-none resize-none focus-visible:ring-0"
        onBlur={(e) => { if (e.target.value !== memo) onSaveMemo(e.target.value); }}
      />
    </div>
  );
}

export default function FixedExpenses() {
  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ["fixedExpenses"],
    queryFn: () => base44.entities.FixedExpense.list("sort_order"),
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["fixedExpensesSettings"],
    queryFn: async () => {
      const all = await base44.entities.AppSetting.list();
      return all.filter((s) => SETTING_KEYS.includes(s.key));
    },
    initialData: [],
  });
  const settingByKey = useMemo(() => Object.fromEntries(settings.map((s) => [s.key, s])), [settings]);

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }) => {
      const existing = settingByKey[key];
      if (existing) return base44.entities.AppSetting.update(existing.id, { value });
      return base44.entities.AppSetting.create({ key, value });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixedExpensesSettings"] }),
    onError: (e) => toast.error(e.message),
  });

  const addExpense = useMutation({
    mutationFn: (data) => base44.entities.FixedExpense.create({ ...data, is_active: true, sort_order: expenses.length }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] }),
    onError: (e) => toast.error(e.message),
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FixedExpense.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] }),
    onError: (e) => toast.error(e.message),
  });

  const removeExpense = useMutation({
    mutationFn: (id) => base44.entities.FixedExpense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] }),
    onError: (e) => toast.error(e.message),
  });

  const titleOf = (cat) => settingByKey[TITLE_KEYS[cat]]?.value ?? DEFAULT_TITLES[cat];
  const memoOf = (cat) => settingByKey[MEMO_KEYS[cat]]?.value ?? "";

  const grandTotal = expenses
    .filter((e) => e.category === "cat1" || e.category === "cat2")
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6" dir="rtl">
      <div className="border-2 border-stone-800 rounded-lg py-4 text-center bg-white">
        <h1 className="text-3xl font-bold text-stone-900">הוצאות קבועות</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <ExpenseTable
            title={titleOf("cat1")}
            category="cat1"
            expenses={expenses}
            onSaveTitle={(v) => saveSetting.mutate({ key: TITLE_KEYS.cat1, value: v })}
            onAdd={(data) => addExpense.mutate(data)}
            onUpdate={(id, data) => updateExpense.mutate({ id, data })}
            onRemove={(id) => removeExpense.mutate(id)}
          />
          <ExpenseTable
            title={titleOf("cat2")}
            category="cat2"
            expenses={expenses}
            onSaveTitle={(v) => saveSetting.mutate({ key: TITLE_KEYS.cat2, value: v })}
            onAdd={(data) => addExpense.mutate(data)}
            onUpdate={(id, data) => updateExpense.mutate({ id, data })}
            onRemove={(id) => removeExpense.mutate(id)}
          />
        </div>

        <div className="space-y-6">
          <MemoBlock
            title={titleOf("cat3")}
            memo={memoOf("cat3")}
            onSaveTitle={(v) => saveSetting.mutate({ key: TITLE_KEYS.cat3, value: v })}
            onSaveMemo={(v) => saveSetting.mutate({ key: MEMO_KEYS.cat3, value: v })}
          />
          <MemoBlock
            title={titleOf("cat4")}
            memo={memoOf("cat4")}
            onSaveTitle={(v) => saveSetting.mutate({ key: TITLE_KEYS.cat4, value: v })}
            onSaveMemo={(v) => saveSetting.mutate({ key: MEMO_KEYS.cat4, value: v })}
          />
        </div>
      </div>

      <div className="border-2 border-emerald-700 rounded-lg bg-emerald-50 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-emerald-900">סך הכל הוצאות קבועות</span>
        <span className="text-2xl font-bold text-emerald-700">{fmtCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}
