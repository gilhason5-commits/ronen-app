import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { fmtCurrency } from "../components/utils/formatNumbers";

// The categories are fixed slots cat1..cat8 (FixedExpense.category CHECK).
// Their titles are user-editable — stored as AppSetting key/value rows rather
// than a new table, matching the existing pattern (see RoleEditDialog.jsx's
// paused-employee flags) — and "deleting" one hides its slot until it's
// added back.
const CATEGORY_COUNT = 8;
const CATEGORIES = Array.from({ length: CATEGORY_COUNT }, (_, i) => `cat${i + 1}`);
const TITLE_KEYS = Object.fromEntries(CATEGORIES.map((c) => [c, `fixed_expenses_title_${c}`]));
const DEFAULT_TITLES = Object.fromEntries(CATEGORIES.map((c, i) => [c, `קטגוריה ${i + 1}`]));
const HIDDEN_KEYS = Object.fromEntries(CATEGORIES.map((c) => [c, `fixed_expenses_hidden_${c}`]));
// Right column holds the first half, left column the second (RTL).
const COLUMNS = [CATEGORIES.slice(0, CATEGORY_COUNT / 2), CATEGORIES.slice(CATEGORY_COUNT / 2)];
const SETTING_KEYS = [...Object.values(TITLE_KEYS), ...Object.values(HIDDEN_KEYS)];

// Category title with a pencil to rename it in place and an X to delete it.
function CategoryTitle({ title, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  useEffect(() => { if (!editing) setDraft(title); }, [title, editing]);
  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== title) onRename(v);
    else setDraft(title);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={draft}
          className="h-8 font-bold text-base"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(title); setEditing(false); }
          }}
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-700" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
          <Check className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-bold text-stone-900 text-base">{title}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-400 hover:text-emerald-700" title="שינוי שם" onClick={() => setEditing(true)}>
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-400 hover:text-red-600" title="מחיקת קטגוריה" onClick={onDelete}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

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

function ExpenseTable({ title, category, expenses, onSaveTitle, onDeleteCategory, onAdd, onUpdate, onRemove }) {
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const rows = expenses.filter((e) => (e.category || "cat1") === category);
  const subtotal = rows.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="border border-stone-300 rounded-lg overflow-hidden bg-white">
      <div className="border-b border-stone-300 bg-stone-50 px-4 py-2">
        <CategoryTitle title={title} onRename={onSaveTitle} onDelete={() => onDeleteCategory(rows)} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-stone-500 text-xs">
            <th className="text-right font-medium px-4 py-2">שם</th>
            <th className="text-right font-medium px-2 py-2 w-32 whitespace-nowrap">סכום <span className="font-normal text-stone-400">(ללא מע״מ)</span></th>
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
  const isHidden = (cat) => settingByKey[HIDDEN_KEYS[cat]]?.value === "true";
  const hiddenCats = Object.keys(TITLE_KEYS).filter(isHidden);

  // Deleting a category removes its expenses too (they'd otherwise still
  // count in the grand total while invisible) and resets its title.
  const deleteCategory = useMutation({
    mutationFn: async ({ cat, rows }) => {
      await Promise.all(rows.map((r) => base44.entities.FixedExpense.delete(r.id)));
      for (const [key, value] of [[HIDDEN_KEYS[cat], "true"], [TITLE_KEYS[cat], DEFAULT_TITLES[cat]]]) {
        const existing = settingByKey[key];
        if (existing) await base44.entities.AppSetting.update(existing.id, { value });
        else await base44.entities.AppSetting.create({ key, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] });
      queryClient.invalidateQueries({ queryKey: ["fixedExpensesSettings"] });
      toast.success("הקטגוריה נמחקה");
    },
    onError: (e) => toast.error(e.message),
  });
  const handleDeleteCategory = (cat, rows) => {
    const msg = rows.length
      ? `למחוק את הקטגוריה "${titleOf(cat)}" ואת ${rows.length} ההוצאות שבה?`
      : `למחוק את הקטגוריה "${titleOf(cat)}"?`;
    if (window.confirm(msg)) deleteCategory.mutate({ cat, rows });
  };

  const renderTable = (cat) => !isHidden(cat) && (
    <ExpenseTable
      title={titleOf(cat)}
      category={cat}
      expenses={expenses}
      onSaveTitle={(v) => saveSetting.mutate({ key: TITLE_KEYS[cat], value: v })}
      onDeleteCategory={(rows) => handleDeleteCategory(cat, rows)}
      onAdd={(data) => addExpense.mutate(data)}
      onUpdate={(id, data) => updateExpense.mutate({ id, data })}
      onRemove={(id) => removeExpense.mutate(id)}
    />
  );

  const grandTotal = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6" dir="rtl">
      <div className="border-2 border-stone-800 rounded-lg py-4 text-center bg-white">
        <h1 className="text-3xl font-bold text-stone-900">הוצאות קבועות</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {COLUMNS.map((column, i) => (
          <div key={i} className="space-y-6">
            {column.map((cat) => <React.Fragment key={cat}>{renderTable(cat)}</React.Fragment>)}
          </div>
        ))}
      </div>

      {hiddenCats.length > 0 && (
        <Button
          variant="outline"
          onClick={() => saveSetting.mutate({ key: HIDDEN_KEYS[hiddenCats[0]], value: "false" })}
        >
          <Plus className="w-4 h-4 ml-1" /> הוספת קטגוריה
        </Button>
      )}

      <div className="border-2 border-emerald-700 rounded-lg bg-emerald-50 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-emerald-900">סך הכל הוצאות קבועות <span className="text-base font-medium text-emerald-700">(ללא מע״מ)</span></span>
        <span className="text-2xl font-bold text-emerald-700">{fmtCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}
