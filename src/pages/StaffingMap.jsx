import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronDown, Map as MapIcon, AlertTriangle, Clock, UtensilsCrossed, FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  computeStaffing,
  computeFlags,
  FORMAT_LABELS,
  FORMAT_OPTIONS,
} from "@/lib/staffingEngine";
import { exportConstraintsPdf, exportSupplierOrdersPdf, exportFloorReportPdf } from "@/lib/staffingPdf";
import { getStaffColor } from "@/lib/staffColors";

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Fixed display order for the flat table's role columns — matches the paper
// sheet Ronen's team reads. Roles that exist in the rule book but aren't in
// this list (e.g. future additions) just fall in at the end, still visible.
const ROLE_DISPLAY_ORDER = [
  "מנהל אירוע",
  "פלור 1",
  "פלור 2",
  "מלצרית משפחה",
  "מנהל מרפסת",
  "מנהל מזונונים",
  "ניהול כניסה",
  "מארחת",
  "סומלייה",
  "תאורנים",
];
function orderRoleColumns(roleColumns) {
  const known = ROLE_DISPLAY_ORDER.filter((r) => roleColumns.includes(r));
  const rest = roleColumns.filter((r) => !ROLE_DISPLAY_ORDER.includes(r));
  return [...known, ...rest];
}

// Agency display order (קירה, עמי, איגור) is independent from the fill
// priority order used by computeAgencySplit (which stays עמי → איגור →
// קירה-as-overflow) — reordering display must never change who absorbs
// the remainder.
const AGENCY_DISPLAY_ORDER = ["קירה", "עמי", "איגור"];
function orderAgenciesForDisplay(agencies) {
  const known = AGENCY_DISPLAY_ORDER.map((name) => agencies.find((a) => a.name === name)).filter(Boolean);
  const rest = agencies.filter((a) => !AGENCY_DISPLAY_ORDER.includes(a.name));
  return [...known, ...rest];
}

// One column per role in the rule book (ordered by sort_order), stable across
// every row — a role a given event doesn't need just renders as a disabled
// "—" cell instead of a red gap.
function useRoleColumns(rules) {
  return useMemo(() => {
    const order = new Map();
    rules
      .filter((r) => r.is_active && r.rule_type === "REQUIRED_ROLE")
      .forEach((r) => {
        if (!order.has(r.role_name)) order.set(r.role_name, r.sort_order ?? 0);
      });
    return [...order.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  }, [rules]);
}

function RoleCell({ roleName, requiredRoles, planRows, employees, onAssign }) {
  const req = requiredRoles.find((r) => r.role_name === roleName);
  if (!req) {
    return <div className="h-8 flex items-center justify-center text-stone-300 text-xs">—</div>;
  }
  const slots = Array.from({ length: req.count }, (_, i) => i + 1);
  return (
    <div className="flex flex-col h-full divide-y divide-white">
      {slots.map((slot) => {
        const assigned = planRows.find((p) => p.role_name === roleName && (p.slot || 1) === slot);
        const filled = !!(assigned?.assigned_employee_id || assigned?.assigned_name);
        const color = filled ? getStaffColor(assigned?.assigned_name) : null;
        return (
          <select
            key={slot}
            value={assigned?.assigned_employee_id || "__none__"}
            onChange={(e) => onAssign({ role_name: roleName, slot, employee: e.target.value })}
            className={`w-full max-w-full h-8 text-[11px] border-0 px-1 text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 ${
              filled
                ? `${color.bg} ${color.text} font-semibold`
                : "bg-red-100 text-red-900"
            }`}
          >
            <option value="__none__">— לא משובץ —</option>
            {employees.filter((e) => e.is_active).map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        );
      })}
    </div>
  );
}

function EventTableRow({ event, rules, agencies, displayAgencies, displayRoleColumns, allEvents, employees, planRows, splitRows, onChange }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staffingPlans"] });
    queryClient.invalidateQueries({ queryKey: ["agencySplits"] });
    queryClient.invalidateQueries({ queryKey: ["staffingEvents"] });
  };

  const staffing = useMemo(() => computeStaffing(event, rules, agencies, allEvents), [event, rules, agencies, allEvents]);
  const flags = useMemo(() => computeFlags(event, staffing, planRows, splitRows), [event, staffing, planRows, splitRows]);

  const setFormat = useMutation({
    mutationFn: (staffing_format) => base44.entities.Event.update(event.id, { staffing_format }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const assignRole = useMutation({
    mutationFn: async ({ role_name, slot, employee }) => {
      const existing = planRows.find((p) => p.role_name === role_name && (p.slot || 1) === slot);
      const emp = employees.find((e) => e.id === employee);
      const prevName = existing?.assigned_name || null;
      if (employee === "__none__") {
        if (existing) await base44.entities.EventStaffingPlan.delete(existing.id);
        onChange?.({ event, role_name, from: prevName, to: null });
        return;
      }
      const data = {
        event_id: event.id,
        role_name,
        slot,
        assigned_employee_id: emp?.id || null,
        assigned_name: emp?.full_name || employee,
      };
      if (existing) await base44.entities.EventStaffingPlan.update(existing.id, data);
      else await base44.entities.EventStaffingPlan.create(data);
      onChange?.({ event, role_name, from: prevName, to: data.assigned_name });
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const setSplit = useMutation({
    mutationFn: async ({ agency, count }) => {
      const existing = splitRows.find((s) => s.agency_id === agency.id);
      const prevCount = existing ? existing.planned_count : null;
      const data = {
        event_id: event.id,
        agency_id: agency.id,
        agency_name: agency.name,
        planned_count: count,
        is_override: true,
      };
      if (existing) await base44.entities.EventAgencySplit.update(existing.id, data);
      else await base44.entities.EventAgencySplit.create(data);
      onChange?.({ event, role_name: `כמות מלצרים — ${agency.name}`, from: prevCount, to: count, agency_name: agency.name });
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const date = new Date(`${event.event_date}T00:00:00`);
  const redCount = flags.filter((f) => f.severity === "red").length;
  const yellowCount = flags.length - redCount;

  const plannedByAgency = new Map(splitRows.map((s) => [s.agency_id, s.planned_count]));
  const computedByAgency = new Map(staffing.split.map((s) => [s.agency_id, s.planned_count]));
  const plannedWaiters = agencies.reduce(
    (sum, a) => sum + (plannedByAgency.has(a.id) ? Number(plannedByAgency.get(a.id)) || 0 : Number(computedByAgency.get(a.id)) || 0),
    0
  );

  const colSpan = 10 + displayRoleColumns.length + displayAgencies.length;

  return (
    <>
      <tr className="hover:bg-stone-50/70">
        <td className="border border-stone-300 px-0.5 py-1 text-center">
          <button onClick={() => setOpen((o) => !o)} className="p-0.5 hover:bg-stone-100 rounded">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
          </button>
        </td>
        <td className="border border-stone-300 px-1.5 py-1 font-medium text-stone-900 truncate text-xs" title={event.event_name}>
          {event.event_name}
        </td>
        <td className="border border-stone-300 px-1 py-1 text-stone-600 text-xs text-center">
          {date.getDate()}.{date.getMonth() + 1}
        </td>
        <td className="border border-stone-300 px-1 py-1 text-stone-600 text-xs text-center truncate">
          {DAY_NAMES[date.getDay()]}
        </td>
        <td className="border border-stone-300 px-1 py-1 text-stone-600 text-xs text-center">
          {event.event_time || "-"}
        </td>
        <td className="border border-stone-300 px-1 py-1 text-stone-600 text-xs text-center font-mono">
          {staffing.briefTime || "-"}
        </td>
        <td className="border border-stone-300 px-1 py-1 text-stone-600 text-xs text-center">
          {event.guest_count || 0}
        </td>
        <td className="border border-stone-300 p-0.5">
          <Select value={event.staffing_format || "serving"} onValueChange={(v) => setFormat.mutate(v)}>
            <SelectTrigger className="h-8 text-[11px] px-1.5 bg-white w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{FORMAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        {displayAgencies.map((agency) => {
          const value = plannedByAgency.has(agency.id) ? plannedByAgency.get(agency.id) : (computedByAgency.get(agency.id) ?? 0);
          const isOverride = splitRows.find((s) => s.agency_id === agency.id)?.is_override;
          return (
            <td key={agency.id} className="border border-stone-300 p-0.5">
              <input
                type="number"
                className={`w-full h-8 text-[11px] text-center rounded border px-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isOverride ? "bg-amber-50 border-amber-300" : "bg-white border-stone-200"
                }`}
                value={value}
                onChange={(e) => setSplit.mutate({ agency, count: Number(e.target.value) || 0 })}
              />
            </td>
          );
        })}
        <td className="border border-stone-300 px-1 py-1 text-center text-xs whitespace-nowrap">
          <span className={plannedWaiters === staffing.waiterCount ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>
            {plannedWaiters}
          </span>
          <span className="text-stone-400">/{staffing.waiterCount}</span>
        </td>
        {displayRoleColumns.map((roleName) => (
          <td key={roleName} className="border border-stone-300 p-0">
            <RoleCell
              roleName={roleName}
              requiredRoles={staffing.requiredRoles}
              planRows={planRows}
              employees={employees}
              onAssign={(payload) => assignRole.mutate(payload)}
            />
          </td>
        ))}
        <td className="border border-stone-300 px-1 py-1 text-center">
          <div className="flex items-center justify-center gap-1 flex-wrap" title={flags.map((f) => f.message).join("\n")}>
            {redCount > 0 && <Badge className="bg-red-600 gap-1 text-[10px] px-1.5">{redCount}</Badge>}
            {yellowCount > 0 && <Badge className="bg-amber-500 gap-1 text-[10px] px-1.5">{yellowCount}</Badge>}
            {flags.length === 0 && <Badge variant="outline" className="text-[10px] px-1.5 text-emerald-700 border-emerald-300">תקין</Badge>}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={colSpan} className="border border-stone-300 bg-slate-50/60 p-4">
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
            {flags.length > 0 && (
              <div className="space-y-1 mt-4">
                {flags.map((f, i) => (
                  <div key={i} className={`text-sm rounded px-3 py-1.5 flex items-center gap-2 ${f.severity === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {f.message}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ChangeLog({ month }) {
  const mKey = monthKey(month);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["staffingChangeLog", mKey],
    queryFn: () => base44.entities.StaffingChangeLog.filter({ month: mKey }),
    initialData: [],
  });
  const sorted = [...logs].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="bg-white border border-stone-300 rounded-lg">
      <div className="px-4 py-3 border-b border-stone-200">
        <h2 className="text-sm font-bold text-stone-800">רשימת שינויי כוח אדם</h2>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
        {isLoading && <div className="p-4 text-sm text-slate-400">טוען…</div>}
        {!isLoading && sorted.length === 0 && <div className="p-4 text-sm text-slate-400">אין שינויים החודש</div>}
        {sorted.map((log) => (
          <div key={log.id} className="px-4 py-2 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-stone-400 font-mono">
              {log.created_date ? new Date(log.created_date).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
            <span className="font-medium text-stone-800">{log.event_name}</span>
            <span className="text-stone-500">·</span>
            <span className="text-stone-700">{log.role_name}</span>
            {log.agency_name && <span className="text-stone-500">({log.agency_name})</span>}
            <span className="text-stone-500">:</span>
            <span className="text-red-600">{log.from_value || "ריק"}</span>
            <span className="text-stone-400">←</span>
            <span className="text-emerald-700 font-medium">{log.to_value || "ריק"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StaffingMap() {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const mKey = monthKey(month);
  const monthStart = `${mKey}-01`;
  const monthEnd = `${mKey}-31`;
  const queryClient = useQueryClient();

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

  const roleColumns = useRoleColumns(rules);
  const displayRoleColumns = useMemo(() => orderRoleColumns(roleColumns), [roleColumns]);
  const activeAgencies = useMemo(
    () => agencies.filter((a) => a.is_active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [agencies]
  );
  const displayAgencies = useMemo(() => orderAgenciesForDisplay(activeAgencies), [activeAgencies]);

  // Fixed columns eat a known % budget; whatever's left is split evenly
  // across role + agency columns so the table always spans exactly 100% of
  // its container, however many rules or agencies exist — no horizontal
  // scroll on a normal screen.
  const FIXED_PCT_BUDGET = 9 + 3.5 + 3.5 + 3.5 + 3.5 + 3 + 5.5 + 4.5 + 4; // name,date,day,event-time,brief-time,count,format,waiters,flags
  const dynamicCount = displayRoleColumns.length + displayAgencies.length;
  const dynamicColPct = dynamicCount > 0 ? (100 - FIXED_PCT_BUDGET) / dynamicCount : 0;

  const shift = (dir) => { const d = new Date(month); d.setMonth(d.getMonth() + dir); setMonth(d); };

  const logChange = useMutation({
    mutationFn: ({ event, role_name, from, to, agency_name }) =>
      base44.entities.StaffingChangeLog.create({
        month: mKey,
        event_id: event.id,
        event_name: event.event_name,
        role_name,
        agency_name: agency_name || null,
        from_value: from ? String(from) : null,
        to_value: to !== null && to !== undefined ? String(to) : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staffingChangeLog", mKey] }),
  });

  const monthLabel = month.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MapIcon className="w-6 h-6 text-emerald-700" /> מפת כוח אדם
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportConstraintsPdf({ events, rules, roleColumns: displayRoleColumns, monthLabel, allPlans })}>
            <FileDown className="w-3.5 h-3.5 ml-1.5" /> אילוצים
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportSupplierOrdersPdf({ events, rules, agencies: activeAgencies, monthLabel, allSplits })}>
            <FileDown className="w-3.5 h-3.5 ml-1.5" /> הזמנת רכש
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportFloorReportPdf({ events, rules, roleColumns: displayRoleColumns, monthLabel, allPlans })}>
            <FileDown className="w-3.5 h-3.5 ml-1.5" /> דוח לפרסום פלור
          </Button>
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight className="w-4 h-4" /></Button>
            <span className="font-medium w-32 text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {isLoading && <div className="text-slate-500 py-8 text-center">טוען אירועים…</div>}
      {!isLoading && events.length === 0 && (
        <div className="text-slate-400 py-12 text-center">אין אירועים בחודש הזה</div>
      )}

      {!isLoading && events.length > 0 && (
        <>
          <div className="flex items-center gap-4 text-xs text-stone-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gradient-to-br from-orange-200 via-blue-200 to-pink-200 border border-stone-300 inline-block" />
              מאויש (צבע קבוע לכל איש צוות)
            </span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" /> חסר</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-100 border border-stone-300 inline-block" /> לא נדרש</span>
          </div>
          <div className="bg-white border border-stone-300 overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse">
              <colgroup>
                <col style={{ width: "24px" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "3.5%" }} />
                <col style={{ width: "3.5%" }} />
                <col style={{ width: "3.5%" }} />
                <col style={{ width: "3.5%" }} />
                <col style={{ width: "3%" }} />
                <col style={{ width: "5.5%" }} />
                {displayAgencies.map((agency) => (
                  <col key={agency.id} style={{ width: `${dynamicColPct}%` }} />
                ))}
                <col style={{ width: "4.5%" }} />
                {displayRoleColumns.map((roleName) => (
                  <col key={roleName} style={{ width: `${dynamicColPct}%` }} />
                ))}
                <col style={{ width: "4%" }} />
              </colgroup>
              <thead>
                <tr className="bg-stone-200">
                  <th className="border border-stone-300 px-0.5 py-2" />
                  <th className="border border-stone-300 px-1.5 py-2 text-center font-bold text-stone-800 text-xs">שם האירוע</th>
                  <th className="border border-stone-300 px-1 py-2 text-center font-bold text-stone-800 text-[10px]">תאריך</th>
                  <th className="border border-stone-300 px-1 py-2 text-center font-bold text-stone-800 text-[10px]">יום</th>
                  <th className="border border-stone-300 px-1 py-2 text-center font-bold text-stone-800 text-[10px]">שעת אירוע</th>
                  <th className="border border-stone-300 px-1 py-2 text-center font-bold text-stone-800 text-[10px]">שעת בריף</th>
                  <th className="border border-stone-300 px-1 py-2 text-center font-bold text-stone-800 text-[10px]">כמות</th>
                  <th className="border border-stone-300 px-1 py-2 text-center font-bold text-stone-800 text-[10px]">פורמט</th>
                  {displayAgencies.map((agency) => (
                    <th key={agency.id} className="border border-stone-300 px-0.5 py-2 text-center font-bold text-stone-800 text-[10px] leading-tight break-words">
                      {agency.name}
                    </th>
                  ))}
                  <th className="border border-stone-300 px-0.5 py-2 text-center font-bold text-stone-800 text-[10px] leading-tight break-words">מלצרים</th>
                  {displayRoleColumns.map((roleName) => (
                    <th key={roleName} className="border border-stone-300 px-0.5 py-2 text-center font-bold text-stone-800 text-[10px] leading-tight break-words">
                      {roleName}
                    </th>
                  ))}
                  <th className="border border-stone-300 px-0.5 py-2 text-center font-bold text-stone-800 text-[10px]">פערים</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <EventTableRow
                    key={event.id}
                    event={event}
                    rules={rules}
                    agencies={activeAgencies}
                    displayAgencies={displayAgencies}
                    displayRoleColumns={displayRoleColumns}
                    allEvents={events}
                    employees={employees}
                    planRows={allPlans.filter((p) => p.event_id === event.id)}
                    splitRows={allSplits.filter((s) => s.event_id === event.id)}
                    onChange={(change) => logChange.mutate(change)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <ChangeLog month={month} />
        </>
      )}
    </div>
  );
}
