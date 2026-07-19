import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronDown, Map, AlertTriangle, Clock, Users, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import {
  computeStaffing,
  computeFlags,
  FORMAT_LABELS,
  FORMAT_OPTIONS,
} from "@/lib/staffingEngine";

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function EventRow({ event, rules, agencies, allEvents, planRows, splitRows, employees }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staffingPlans"] });
    queryClient.invalidateQueries({ queryKey: ["agencySplits"] });
    queryClient.invalidateQueries({ queryKey: ["staffingEvents"] });
  };

  const staffing = useMemo(
    () => computeStaffing(event, rules, agencies, allEvents),
    [event, rules, agencies, allEvents]
  );
  const flags = useMemo(
    () => computeFlags(event, staffing, planRows, splitRows),
    [event, staffing, planRows, splitRows]
  );

  const setFormat = useMutation({
    mutationFn: (staffing_format) => base44.entities.Event.update(event.id, { staffing_format }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const assignRole = useMutation({
    mutationFn: async ({ role_name, slot, employee }) => {
      const existing = planRows.find((p) => p.role_name === role_name && (p.slot || 1) === slot);
      if (employee === "__none__") {
        if (existing) await base44.entities.EventStaffingPlan.delete(existing.id);
        return;
      }
      const emp = employees.find((e) => e.id === employee);
      const data = {
        event_id: event.id,
        role_name,
        slot,
        assigned_employee_id: emp?.id || null,
        assigned_name: emp?.full_name || employee,
      };
      if (existing) await base44.entities.EventStaffingPlan.update(existing.id, data);
      else await base44.entities.EventStaffingPlan.create(data);
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const setSplit = useMutation({
    mutationFn: async ({ agency, count }) => {
      const existing = splitRows.find((s) => s.agency_id === agency.agency_id);
      const data = {
        event_id: event.id,
        agency_id: agency.agency_id,
        agency_name: agency.agency_name,
        planned_count: count,
        is_override: true,
      };
      if (existing) await base44.entities.EventAgencySplit.update(existing.id, data);
      else await base44.entities.EventAgencySplit.create(data);
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const date = new Date(`${event.event_date}T00:00:00`);
  const redCount = flags.filter((f) => f.severity === "red").length;
  const yellowCount = flags.length - redCount;

  // planned split: overrides if exist, else computed
  const effectiveSplit = staffing.split.map((s) => {
    const ov = splitRows.find((r) => r.agency_id === s.agency_id);
    return ov ? { ...s, planned_count: ov.planned_count, is_override: ov.is_override } : s;
  });
  const plannedWaiters = effectiveSplit.reduce((sum, s) => sum + (Number(s.planned_count) || 0), 0);

  return (
    <Card className={redCount ? "border-red-300" : ""}>
      <CardContent className="p-0">
        <button className="w-full flex items-center gap-3 p-3 text-right" onClick={() => setOpen(!open)}>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
          <div className="w-24 shrink-0">
            <div className="font-bold">{date.getDate()}.{date.getMonth() + 1}</div>
            <div className="text-xs text-slate-500">{DAY_NAMES[date.getDay()]}{event.event_time ? ` · ${event.event_time}` : ""}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{event.event_name}</div>
            <div className="text-xs text-slate-500">{event.guest_count || 0} סועדים · {FORMAT_LABELS[event.staffing_format] || "—"}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />{staffing.waiterCount} מלצרים</Badge>
            {staffing.briefTime && <Badge variant="outline" className="gap-1 hidden md:inline-flex"><Clock className="w-3 h-3" />בריף {staffing.briefTime}</Badge>}
            {redCount > 0 && <Badge className="bg-red-600 gap-1"><AlertTriangle className="w-3 h-3" />{redCount}</Badge>}
            {yellowCount > 0 && <Badge className="bg-amber-500 gap-1">{yellowCount}</Badge>}
          </div>
        </button>

        {open && (
          <div className="border-t p-4 space-y-4 bg-slate-50/50">
            {flags.length > 0 && (
              <div className="space-y-1">
                {flags.map((f, i) => (
                  <div key={i} className={`text-sm rounded px-3 py-1.5 flex items-center gap-2 ${f.severity === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {f.message}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">פורמט האירוע:</span>
              <Select value={event.staffing_format || "serving"} onValueChange={(v) => setFormat.mutate(v)}>
                <SelectTrigger className="h-8 w-32 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              {staffing.waitersRule?.explanation && <span className="text-xs text-slate-500">{staffing.waitersRule.explanation}</span>}
            </div>

            {/* role assignments */}
            <div>
              <h4 className="text-sm font-semibold mb-2">בעלי תפקידים ({staffing.requiredRoles.length})</h4>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {staffing.requiredRoles.flatMap((req) =>
                  Array.from({ length: req.count }, (_, i) => {
                    const slot = i + 1;
                    const assigned = planRows.find((p) => p.role_name === req.role_name && (p.slot || 1) === slot);
                    return (
                      <div key={`${req.role_name}-${slot}`} className={`rounded border p-2 bg-white ${!assigned ? "border-red-300" : ""}`}>
                        <div className="text-xs text-slate-500 flex justify-between">
                          <span>{req.role_name}{req.count > 1 ? ` #${slot}` : ""}</span>
                          {req.arrival_offset_minutes != null && <span>הגעה {-req.arrival_offset_minutes / 60} ש' לפני</span>}
                        </div>
                        <Select
                          value={assigned?.assigned_employee_id || "__none__"}
                          onValueChange={(v) => assignRole.mutate({ role_name: req.role_name, slot, employee: v })}
                        >
                          <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="לא משובץ" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— לא משובץ —</SelectItem>
                            {employees.filter((e) => e.is_active).map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* waiter split */}
            <div>
              <h4 className="text-sm font-semibold mb-2">
                מלצרים — נדרש {staffing.waiterCount}, מתוכנן {plannedWaiters}
              </h4>
              <div className="flex gap-3 flex-wrap">
                {effectiveSplit.map((s) => (
                  <div key={s.agency_id} className="flex items-center gap-2 rounded border bg-white px-3 py-1.5">
                    <span className="text-sm">{s.agency_name}</span>
                    <input
                      type="number"
                      className="w-14 h-7 border rounded text-center text-sm"
                      value={s.planned_count}
                      onChange={(e) => setSplit.mutate({ agency: s, count: Number(e.target.value) || 0 })}
                    />
                    {s.is_override && <Badge variant="outline" className="text-[10px]">ידני</Badge>}
                  </div>
                ))}
              </div>
            </div>

            {/* arrivals + ops */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> לוח הגעה</h4>
                <div className="rounded border bg-white divide-y text-sm">
                  {staffing.arrivals.map((a, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5">
                      <span>{a.role_name}</span><span className="font-mono">{a.arrival}</span>
                    </div>
                  ))}
                  {staffing.arrivals.length === 0 && <div className="px-3 py-2 text-slate-400">אין שעת אירוע — לא ניתן לחשב</div>}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><UtensilsCrossed className="w-4 h-4" /> תפעול וניקיון</h4>
                <div className="rounded border bg-white divide-y text-sm">
                  {[...staffing.ops, ...staffing.extras].map((o, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5">
                      <span>{o.role_name}{o.special ? " (תוספת יום)" : ""}</span>
                      <span>{o.count || ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StaffingMap() {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const mKey = monthKey(month);
  const monthStart = `${mKey}-01`;
  const monthEnd = `${mKey}-31`;

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["staffingEvents", mKey],
    queryFn: async () => {
      const all = await base44.entities.Event.list("event_date", 1000);
      return all.filter((e) => e.event_date >= monthStart && e.event_date <= monthEnd && e.status !== "cancelled");
    },
  });
  const { data: rules = [] } = useQuery({ queryKey: ["staffingRules"], queryFn: () => base44.entities.StaffingRule.list("sort_order"), initialData: [] });
  const { data: agencies = [] } = useQuery({ queryKey: ["staffingAgencies"], queryFn: () => base44.entities.StaffingAgency.list("sort_order"), initialData: [] });
  const { data: employees = [] } = useQuery({ queryKey: ["taskEmployees"], queryFn: () => base44.entities.TaskEmployee.list(), initialData: [] });
  const { data: allPlans = [] } = useQuery({ queryKey: ["staffingPlans"], queryFn: () => base44.entities.EventStaffingPlan.list("created_date", 5000), initialData: [] });
  const { data: allSplits = [] } = useQuery({ queryKey: ["agencySplits"], queryFn: () => base44.entities.EventAgencySplit.list("created_date", 5000), initialData: [] });

  const shift = (dir) => { const d = new Date(month); d.setMonth(d.getMonth() + dir); setMonth(d); };

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Map className="w-6 h-6 text-emerald-700" /> מפת כוח אדם
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="w-4 h-4" /></Button>
          <span className="font-medium w-32 text-center">
            {month.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        </div>
      </div>

      {isLoading && <div className="text-slate-500 py-8 text-center">טוען אירועים…</div>}
      {!isLoading && events.length === 0 && (
        <div className="text-slate-400 py-12 text-center">אין אירועים בחודש הזה</div>
      )}

      <div className="space-y-2">
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            rules={rules}
            agencies={agencies}
            allEvents={events}
            employees={employees}
            planRows={allPlans.filter((p) => p.event_id === event.id)}
            splitRows={allSplits.filter((s) => s.event_id === event.id)}
          />
        ))}
      </div>
    </div>
  );
}
