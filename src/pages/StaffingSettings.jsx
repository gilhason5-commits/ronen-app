import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Users, Coins, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FORMAT_LABELS } from "@/lib/staffingEngine";

const RULE_TYPE_LABELS = {
  WAITER_FORMULA: "נוסחאות מלצרים",
  REQUIRED_ROLE: "בעלי תפקידים חובה",
  OPS: "תפעול, מטבח וניקיון",
  SPECIAL_DAY: "חוקי ימים מיוחדים",
};

const TIP_RULE_TYPE_LABELS = {
  PERCENT: "אחוז מהקופה",
  FIXED: "סכום קבוע",
  PER_RUNNER: "לכל ראנר",
  PER_CLOSING: "לכל סגירה",
};

function useEntityCrud(entityName, queryKey, label) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });
  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities[entityName].update(id, data),
    onSuccess: () => { invalidate(); toast.success(`${label} עודכן`); },
    onError: (e) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: (data) => base44.entities[entityName].create(data),
    onSuccess: () => { invalidate(); toast.success(`${label} נוסף`); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => base44.entities[entityName].delete(id),
    onSuccess: () => { invalidate(); toast.success(`${label} נמחק`); },
    onError: (e) => toast.error(e.message),
  });
  return { update, create, remove };
}

function NumInput({ value, onChange, className = "w-20", placeholder }) {
  return (
    <Input
      type="number"
      className={`h-8 ${className}`}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

// ---------- staffing rules tab ----------
function StaffingRulesTab() {
  const { data: rules = [] } = useQuery({
    queryKey: ["staffingRules"],
    queryFn: () => base44.entities.StaffingRule.list("sort_order"),
    initialData: [],
  });
  const crud = useEntityCrud("StaffingRule", "staffingRules", "תקן");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

  const startEdit = (r) => { setEditingId(r.id); setForm({ ...r }); };
  const save = () => {
    const { id, created_date, updated_date, ...data } = form;
    crud.update.mutate({ id: editingId, data });
    setEditingId(null);
  };

  const groups = Object.keys(RULE_TYPE_LABELS).map((type) => ({
    type,
    rules: rules.filter((r) => r.rule_type === type),
  }));

  return (
    <div className="space-y-6">
      {groups.map(({ type, rules: groupRules }) => (
        <Card key={type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              {RULE_TYPE_LABELS[type]}
              <Button size="sm" variant="outline" onClick={() =>
                crud.create.mutate({ rule_type: type, role_name: "תפקיד חדש", quantity: 1, explanation: "", sort_order: 99 })
              }>
                <Plus className="w-4 h-4 ml-1" /> הוסף תקן
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-slate-500">
                  <th className="p-2 pr-4">תפקיד</th>
                  {type === "WAITER_FORMULA" && <th className="p-2">פורמט</th>}
                  {type !== "WAITER_FORMULA" && <th className="p-2">מסועדים</th>}
                  {type !== "WAITER_FORMULA" && <th className="p-2">עד</th>}
                  <th className="p-2">כמות</th>
                  <th className="p-2">הגעה (דק' לפני)</th>
                  <th className="p-2">הסבר</th>
                  <th className="p-2">פעיל</th>
                  <th className="p-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {groupRules.map((r) => {
                  const editing = editingId === r.id;
                  return (
                    <tr key={r.id} className={`border-b last:border-0 ${!r.is_active ? "opacity-50" : ""}`}>
                      <td className="p-2 pr-4 font-medium">
                        {editing ? <Input className="h-8 w-32" value={form.role_name || ""} onChange={(e) => setForm({ ...form, role_name: e.target.value })} /> : r.role_name}
                      </td>
                      {type === "WAITER_FORMULA" && (
                        <td className="p-2"><Badge variant="outline">{FORMAT_LABELS[r.event_format] || r.event_format}</Badge></td>
                      )}
                      {type !== "WAITER_FORMULA" && (
                        <td className="p-2">
                          {editing ? <NumInput value={form.min_guests} onChange={(v) => setForm({ ...form, min_guests: v })} /> : (r.min_guests ?? "—")}
                        </td>
                      )}
                      {type !== "WAITER_FORMULA" && (
                        <td className="p-2">
                          {editing ? <NumInput value={form.max_guests} onChange={(v) => setForm({ ...form, max_guests: v })} /> : (r.max_guests ?? "—")}
                        </td>
                      )}
                      <td className="p-2">
                        {editing ? <NumInput value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} /> : (r.quantity ?? "—")}
                      </td>
                      <td className="p-2">
                        {editing
                          ? <NumInput value={form.arrival_offset_minutes == null ? null : -form.arrival_offset_minutes} onChange={(v) => setForm({ ...form, arrival_offset_minutes: v == null ? null : -Math.abs(v) })} />
                          : (r.arrival_offset_minutes != null ? -r.arrival_offset_minutes : "—")}
                      </td>
                      <td className="p-2 text-slate-600 max-w-md">
                        {editing ? <Input className="h-8" value={form.explanation || ""} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /> : r.explanation}
                      </td>
                      <td className="p-2">
                        <Switch checked={r.is_active} onCheckedChange={(v) => crud.update.mutate({ id: r.id, data: { is_active: v } })} />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 justify-end">
                          {editing ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={save}><Check className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => { if (confirm(`למחוק את התקן "${r.role_name}"?`)) crud.remove.mutate(r.id); }}><Trash2 className="w-4 h-4" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- agencies tab ----------
function AgenciesTab() {
  const { data: agencies = [] } = useQuery({
    queryKey: ["staffingAgencies"],
    queryFn: () => base44.entities.StaffingAgency.list("sort_order"),
    initialData: [],
  });
  const { data: workers = [] } = useQuery({
    queryKey: ["agencyWorkers"],
    queryFn: () => base44.entities.AgencyWorker.list("full_name"),
    initialData: [],
  });
  const agencyCrud = useEntityCrud("StaffingAgency", "staffingAgencies", "חברה");
  const workerCrud = useEntityCrud("AgencyWorker", "agencyWorkers", "עובד");
  const [newWorkerName, setNewWorkerName] = useState({});

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      {agencies.map((a) => {
        const agencyWorkers = workers.filter((w) => w.agency_id === a.id);
        return (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2"><Users className="w-5 h-5 text-emerald-700" />{a.name}</span>
                <span className="flex items-center gap-2 text-sm font-normal">
                  מקס' מלצרים:
                  <NumInput className="w-16" value={a.max_waiters_per_event} onChange={(v) => agencyCrud.update.mutate({ id: a.id, data: { max_waiters_per_event: v } })} />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {agencyWorkers.map((w) => (
                  <div key={w.id} className={`flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50 ${!w.is_active ? "opacity-50" : ""}`}>
                    <span>{w.full_name}</span>
                    <span className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        טיפים
                        <Switch checked={w.include_in_tips} onCheckedChange={(v) => workerCrud.update.mutate({ id: w.id, data: { include_in_tips: v } })} />
                      </label>
                      <Switch checked={w.is_active} onCheckedChange={(v) => workerCrud.update.mutate({ id: w.id, data: { is_active: v } })} />
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => { if (confirm(`למחוק את ${w.full_name}?`)) workerCrud.remove.mutate(w.id); }}><Trash2 className="w-3 h-3" /></Button>
                    </span>
                  </div>
                ))}
                {agencyWorkers.length === 0 && <div className="text-sm text-slate-400 py-2">אין עובדים רשומים — יתווספו אוטומטית ממסך הנוכחות</div>}
              </div>
              <div className="flex gap-2 mt-3">
                <Input placeholder="שם עובד חדש" className="h-8" value={newWorkerName[a.id] || ""} onChange={(e) => setNewWorkerName({ ...newWorkerName, [a.id]: e.target.value })} />
                <Button size="sm" onClick={() => {
                  const name = (newWorkerName[a.id] || "").trim();
                  if (!name) return;
                  workerCrud.create.mutate({ agency_id: a.id, agency_name: a.name, full_name: name });
                  setNewWorkerName({ ...newWorkerName, [a.id]: "" });
                }}><Plus className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <Button variant="outline" className="w-full" onClick={() => {
            const name = prompt("שם חברת כוח האדם החדשה:");
            if (name) agencyCrud.create.mutate({ name, max_waiters_per_event: 10, sort_order: agencies.length + 1 });
          }}>
            <Plus className="w-4 h-4 ml-1" /> הוסף חברת כוח אדם
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- tip rules tab ----------
function TipRulesTab() {
  const { data: tipRules = [] } = useQuery({
    queryKey: ["tipRules"],
    queryFn: () => base44.entities.TipRule.list("sort_order"),
    initialData: [],
  });
  const crud = useEntityCrud("TipRule", "tipRules", "חוק חלוקה");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          חוקי חלוקת הטיפים
          <Button size="sm" variant="outline" onClick={() => crud.create.mutate({ role_name: "תפקיד חדש", rule_type: "FIXED", value: 0, sort_order: 99 })}>
            <Plus className="w-4 h-4 ml-1" /> הוסף חוק
          </Button>
        </CardTitle>
        <p className="text-sm text-slate-500">היתרה אחרי כל החוקים מתחלקת למלצרים לפי משמרות בפועל.</p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-slate-500">
              <th className="p-2 pr-4">תפקיד</th>
              <th className="p-2">סוג</th>
              <th className="p-2">ערך</th>
              <th className="p-2">הסבר</th>
              <th className="p-2">פעיל</th>
              <th className="p-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {tipRules.map((r) => {
              const editing = editingId === r.id;
              return (
                <tr key={r.id} className={`border-b last:border-0 ${!r.is_active ? "opacity-50" : ""}`}>
                  <td className="p-2 pr-4 font-medium">
                    {editing ? <Input className="h-8 w-32" value={form.role_name || ""} onChange={(e) => setForm({ ...form, role_name: e.target.value })} /> : r.role_name}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <Select value={form.rule_type} onValueChange={(v) => setForm({ ...form, rule_type: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIP_RULE_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <Badge variant="outline">{TIP_RULE_TYPE_LABELS[r.rule_type]}</Badge>}
                  </td>
                  <td className="p-2">
                    {editing
                      ? <NumInput value={form.value} onChange={(v) => setForm({ ...form, value: v })} />
                      : (r.rule_type === "PERCENT" ? `${r.value}%` : `${Number(r.value).toLocaleString()} ₪`)}
                  </td>
                  <td className="p-2 text-slate-600 max-w-md">
                    {editing ? <Input className="h-8" value={form.explanation || ""} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /> : r.explanation}
                  </td>
                  <td className="p-2">
                    <Switch checked={r.is_active} onCheckedChange={(v) => crud.update.mutate({ id: r.id, data: { is_active: v } })} />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      {editing ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => {
                            const { id, created_date, updated_date, ...data } = form;
                            crud.update.mutate({ id: r.id, data });
                            setEditingId(null);
                          }}><Check className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(r.id); setForm({ ...r }); }}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => { if (confirm(`למחוק את החוק של "${r.role_name}"?`)) crud.remove.mutate(r.id); }}><Trash2 className="w-4 h-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function StaffingSettings() {
  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-700" /> ספר התקנים והגדרות כוח אדם
        </h1>
        <p className="text-slate-500 text-sm mt-1">כל תקן, תקרה, אחוז וסכום — ניתנים לעריכה כאן. שינוי משפיע מיידית על כל החישובים.</p>
      </div>
      <Tabs defaultValue="rules" dir="rtl">
        <TabsList>
          <TabsTrigger value="rules"><BookOpen className="w-4 h-4 ml-1" /> תקנים</TabsTrigger>
          <TabsTrigger value="agencies"><Users className="w-4 h-4 ml-1" /> חברות כוח אדם</TabsTrigger>
          <TabsTrigger value="tips"><Coins className="w-4 h-4 ml-1" /> חוקי טיפים</TabsTrigger>
        </TabsList>
        <TabsContent value="rules"><StaffingRulesTab /></TabsContent>
        <TabsContent value="agencies"><AgenciesTab /></TabsContent>
        <TabsContent value="tips"><TipRulesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
