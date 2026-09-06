import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Plus, Trash2, Clock, UserPlus, Users, Database, X, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { FORMAT_LABELS, computeStaffing, orderAgenciesForDisplay } from "@/lib/staffingEngine";

const todayStr = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Explicit hour/minute dropdowns instead of the native <input type="time">.
// The native picker's segment order (and which one gets focus first) depends
// on the device's regional format, which is what was causing hours and
// minutes to get entered into the wrong segment on the iPad — this makes the
// two fields unambiguous regardless of device locale.
function TimePicker({ value, onChange }) {
  const [h, m] = (value || "").split(":");
  return (
    <div className="flex items-center gap-1" dir="ltr">
      <select
        value={h || ""}
        onChange={(e) => onChange(`${e.target.value}:${m || "00"}`)}
        className="h-7 rounded-md border border-input bg-white px-1.5 text-sm"
      >
        <option value="" disabled>שעה</option>
        {HOURS.map((hh) => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-slate-400">:</span>
      <select
        value={m || ""}
        onChange={(e) => onChange(`${h || "00"}:${e.target.value}`)}
        className="h-7 rounded-md border border-input bg-white px-1.5 text-sm"
      >
        <option value="" disabled>דקה</option>
        {MINUTES.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  );
}

// Displayed label vs. the underlying StaffingRule role_name — the day-of
// sheet Ronen's team reads uses slightly different wording (סגן/עמדת יין)
// than the monthly staffing map (פלור/סומלייה) for the same positions, so
// only the label differs here; the data stays on the same role_name key.
const MANAGER_ROLES = [
  { label: "מנהל אירוע", roleName: "מנהל אירוע" },
  { label: "סגן 1", roleName: "פלור 1" },
  { label: "סגן 2", roleName: "פלור 2" },
  { label: "מרפסת", roleName: "מנהל מרפסת" },
  { label: "מזנונים", roleName: "מנהל מזונונים" },
  { label: "ניהול כניסה", roleName: "ניהול כניסה" },
  { label: "עמדת יין", roleName: "סומלייה" },
  { label: "משפחות", roleName: "מלצרית משפחה" },
  { label: "מארחת", roleName: "מארחת" },
];

function ManagerAttendanceSection({ event, rules, agencies, allEvents }) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery({
    queryKey: ["eventStaffingPlans", event.id],
    queryFn: () => base44.entities.EventStaffingPlan.filter({ event_id: event.id }),
    enabled: !!event,
    initialData: [],
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventStaffingPlan.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["eventStaffingPlans", event.id] }),
    onError: (e) => toast.error(e.message),
  });

  const waiterCount = useMemo(
    () => computeStaffing(event, rules, agencies, allEvents).waiterCount,
    [event, rules, agencies, allEvents]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> מנהלים נוכחים</span>
          <Badge variant="outline" className="bg-white">סה"כ מלצרים: {waiterCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 px-1.5 py-0.5 text-center w-6">#</th>
              <th className="border border-slate-200 px-1.5 py-0.5">עובד משובץ</th>
              <th className="border border-slate-200 px-1.5 py-0.5">תפקיד</th>
              <th className="border border-slate-200 px-1 py-0.5">התחלה</th>
              <th className="border border-slate-200 px-1 py-0.5">סיום</th>
              <th className="border border-slate-200 px-1.5 py-0.5">הערות</th>
            </tr>
          </thead>
          <tbody>
            {MANAGER_ROLES.map((role) => ({
              role,
              plan: plans.find((p) => p.role_name === role.roleName && (p.slot || 1) === 1),
            }))
              .filter(({ plan }) => !!plan)
              .map(({ role, plan }, i) => (
                <tr key={role.roleName}>
                  <td className="border border-slate-200 px-1.5 py-0.5 text-center text-slate-400">{i + 1}</td>
                  <td className="border border-slate-200 px-1.5 py-0.5 font-medium whitespace-nowrap">{plan.assigned_name || "—"}</td>
                  <td className="border border-slate-200 px-1.5 py-0.5 font-medium whitespace-nowrap">{role.label}</td>
                  <td className="border border-slate-200 p-0.5">
                    <TimePicker value={plan.clock_in} onChange={(v) => updatePlan.mutate({ id: plan.id, data: { clock_in: v } })} />
                  </td>
                  <td className="border border-slate-200 p-0.5">
                    <TimePicker value={plan.clock_out} onChange={(v) => updatePlan.mutate({ id: plan.id, data: { clock_out: v } })} />
                  </td>
                  <td className="border border-slate-200 p-0.5">
                    <Input
                      placeholder="הערה…"
                      className="h-7 text-xs border-0"
                      defaultValue={plan.note || ""}
                      onBlur={(e) => { if (e.target.value !== (plan.note || "")) updatePlan.mutate({ id: plan.id, data: { note: e.target.value } }); }}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// Clock-in/out are held as local draft state and only pushed to the server
// when "עדכון שעות" is pressed. They used to call onUpdate() directly on every
// hour/minute selection — since the row re-renders from the query cache (not
// local state) and each save is a separate async round trip, picking the hour
// then quickly picking the minute would fire two overlapping mutations, the
// second one reading a stale hour from props and reverting the first. Batching
// both fields into a single explicit save removes that race entirely.
function ShiftRow({ shift, onUpdate, onDelete }) {
  const [draftClockIn, setDraftClockIn] = useState(shift.clock_in || "");
  const [draftClockOut, setDraftClockOut] = useState(shift.clock_out || "");
  const dirty = draftClockIn !== (shift.clock_in || "") || draftClockOut !== (shift.clock_out || "");

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{shift.worker_name}</span>
          {shift.agency_name && <span className="text-xs text-slate-500 mr-2">· {shift.agency_name}</span>}
          {shift.is_substitute && <Badge variant="outline" className="mr-2 text-[10px]">מחליף</Badge>}
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">כניסה</span>
          <TimePicker value={draftClockIn} onChange={setDraftClockIn} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">יציאה</span>
          <TimePicker value={draftClockOut} onChange={setDraftClockOut} />
        </div>
        {!draftClockOut && (
          <Button size="sm" variant="outline" className="h-9" onClick={() => setDraftClockOut(nowTime())}>
            <Clock className="w-3.5 h-3.5 ml-1" /> עכשיו
          </Button>
        )}
        <Button
          size="sm"
          className="h-9"
          disabled={!dirty}
          onClick={() => onUpdate({ clock_in: draftClockIn || null, clock_out: draftClockOut || null })}
        >
          עדכון שעות
        </Button>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={shift.is_runner} onCheckedChange={(v) => onUpdate({ is_runner: !!v })} /> ראנר
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={shift.is_closing} onCheckedChange={(v) => onUpdate({ is_closing: !!v })} /> סגירה
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={shift.is_balcony} onCheckedChange={(v) => onUpdate({ is_balcony: !!v })} /> מרפסת
        </label>
      </div>
      <Input
        placeholder="הערה…"
        className="h-8 text-sm"
        defaultValue={shift.note || ""}
        onBlur={(e) => { if (e.target.value !== (shift.note || "")) onUpdate({ note: e.target.value }); }}
      />
    </div>
  );
}

// Popup opened from an agency section's "הוספת עובד" button — quick-pick from
// that agency's worker pool (מאגר עובדים), or type a name that isn't in the
// pool yet (which then also gets remembered there for next time).
function AddWorkerDialog({ event, agency, workers, shifts, open, onOpenChange }) {
  const [name, setName] = useState("");
  const [isSubstitute, setIsSubstitute] = useState(false);
  const queryClient = useQueryClient();

  const existingIds = new Set(shifts.map((s) => s.worker_id).filter(Boolean));
  const knownWorkers = workers.filter((w) => w.agency_id === agency.id && w.is_active && !existingIds.has(w.id));

  const addShift = useMutation({
    mutationFn: async ({ worker, freeName }) => {
      let workerId = worker?.id || null;
      let workerName = worker?.full_name || freeName?.trim();
      if (!workerName) throw new Error("חסר שם עובד");
      if (!worker && workerName) {
        const created = await base44.entities.AgencyWorker.create({
          agency_id: agency.id, agency_name: agency.name, full_name: workerName,
        });
        workerId = created.id;
      }
      await base44.entities.EventShift.create({
        event_id: event.id,
        event_date: event.event_date,
        worker_id: workerId,
        worker_name: workerName,
        agency_id: agency.id,
        agency_name: agency.name,
        clock_in: nowTime(),
        is_substitute: isSubstitute,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventShifts"] });
      queryClient.invalidateQueries({ queryKey: ["agencyWorkers"] });
      setName("");
      setIsSubstitute(false);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> הוספת עובד — {agency.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {knownWorkers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {knownWorkers.map((w) => (
                <button
                  key={w.id}
                  className="rounded-full border px-3 py-1.5 text-sm bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition"
                  disabled={addShift.isPending}
                  onClick={() => addShift.mutate({ worker: w })}
                >
                  {w.full_name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">כל עובדי {agency.name} מהמאגר כבר משובצים</div>
          )}

          <div className="flex gap-2">
            <Input placeholder="או שם חדש…" className="h-10" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) addShift.mutate({ freeName: name }); }} />
            <Button className="h-10" disabled={!name.trim() || addShift.isPending} onClick={() => addShift.mutate({ freeName: name })}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <Checkbox checked={isSubstitute} onCheckedChange={(v) => setIsSubstitute(!!v)} /> מחליף (מישהו לא הגיע)
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// One fixed section per staffing agency (קירה / עמי / איגור) — replaces the
// single cross-agency "add worker" form + grouped list with a dedicated list
// per supplier, each with its own add-worker popup.
function AgencySection({ event, agency, workers, shifts, plannedCount, updateShift, deleteShift }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const agencyShifts = shifts.filter((s) => s.agency_id === agency.id);
  const missing = Math.max(0, plannedCount - agencyShifts.length);

  return (
    <Card>
      <CardHeader className="pb-2">
        {missing > 0 && (
          <Badge className="bg-red-600 hover:bg-red-600 gap-1 mb-1 self-start">
            <AlertTriangle className="w-3.5 h-3.5" /> חסרים {missing} מלצרים ({agencyShifts.length}/{plannedCount})
          </Badge>
        )}
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span>{agency.name} ({agencyShifts.length})</span>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <UserPlus className="w-4 h-4 ml-1" /> הוספת עובד
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {agencyShifts.length === 0 && <div className="text-sm text-slate-400 text-center py-4">אין עובדים משובצים</div>}
        {agencyShifts.map((s) => (
          <ShiftRow
            key={s.id}
            shift={s}
            onUpdate={(data) => updateShift.mutate({ id: s.id, data })}
            onDelete={() => { if (confirm(`להסיר את ${s.worker_name}?`)) deleteShift.mutate(s.id); }}
          />
        ))}
      </CardContent>
      <AddWorkerDialog event={event} agency={agency} workers={workers} shifts={shifts} open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}

// Standalone worker-roster manager (מאגר עובדים) — registers people into
// AgencyWorker ahead of time so they show up as quick-pick chips in each
// agency's add-worker popup during the event, instead of being typed fresh
// every time. Collapsed by default so it stays out of the way of the
// on-the-day flow the event manager actually uses on their iPad.
function WorkerPoolSection({ agencies, workers }) {
  const [expanded, setExpanded] = useState(false);
  const [agencyId, setAgencyId] = useState(null);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const activeAgencyId = agencyId || agencies[0]?.id;
  const agency = agencies.find((a) => a.id === activeAgencyId);
  const agencyWorkers = workers.filter((w) => w.agency_id === activeAgencyId);

  const addWorker = useMutation({
    mutationFn: async () => {
      const full_name = name.trim();
      if (!full_name) throw new Error("חסר שם עובד");
      await base44.entities.AgencyWorker.create({ agency_id: activeAgencyId, agency_name: agency?.name, full_name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencyWorkers"] });
      setName("");
      toast.success("העובד נוסף למאגר");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeWorker = useMutation({
    mutationFn: (id) => base44.entities.AgencyWorker.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agencyWorkers"] }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5"><Database className="w-4 h-4" /> מאגר עובדים</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2">
          <Select value={activeAgencyId} onValueChange={setAgencyId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="חברת כוח אדם" /></SelectTrigger>
            <SelectContent>
              {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-1.5">
            {agencyWorkers.map((w) => (
              <span key={w.id} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm bg-slate-50">
                {w.full_name}
                <button
                  className="text-slate-400 hover:text-red-500"
                  onClick={() => { if (confirm(`להסיר את ${w.full_name} מהמאגר?`)) removeWorker.mutate(w.id); }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {agencyWorkers.length === 0 && <span className="text-sm text-slate-400">אין עובדים במאגר לחברה זו</span>}
          </div>

          <div className="flex gap-2">
            <Input placeholder="שם עובד חדש…" className="h-10" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) addWorker.mutate(); }} />
            <Button className="h-10" disabled={!name.trim() || addWorker.isPending} onClick={() => addWorker.mutate()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function EventAttendance() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ["attendanceEvents", selectedDate],
    queryFn: async () => {
      const all = await base44.entities.Event.filter({ event_date: selectedDate });
      return all.filter((e) => e.status !== "cancelled");
    },
  });
  const [selectedEventId, setSelectedEventId] = useState(null);
  const event = events.find((e) => e.id === selectedEventId) || events[0];

  // EventShift.filter() has no ORDER BY, so Postgres is free to return rows
  // in whatever order the scan finds them — which can change after an
  // UPDATE, since a modified row gets a new physical version. Sorting here
  // by creation time (a value that never changes) keeps a worker pinned to
  // the position they were added in, regardless of later edits.
  const { data: shifts = [] } = useQuery({
    queryKey: ["eventShifts", event?.id],
    queryFn: async () => {
      const rows = await base44.entities.EventShift.filter({ event_id: event.id });
      return [...rows].sort((a, b) => {
        const byDate = (a.created_date || "").localeCompare(b.created_date || "");
        return byDate !== 0 ? byDate : String(a.id).localeCompare(String(b.id));
      });
    },
    enabled: !!event,
    initialData: [],
  });
  const { data: agencies = [] } = useQuery({ queryKey: ["staffingAgencies"], queryFn: () => base44.entities.StaffingAgency.list("sort_order"), initialData: [] });
  const { data: workers = [] } = useQuery({ queryKey: ["agencyWorkers"], queryFn: () => base44.entities.AgencyWorker.list("full_name"), initialData: [] });
  const { data: rules = [] } = useQuery({ queryKey: ["staffingRules"], queryFn: () => base44.entities.StaffingRule.list("sort_order"), initialData: [] });
  const { data: agencySplits = [] } = useQuery({
    queryKey: ["eventAgencySplits", event?.id],
    queryFn: () => base44.entities.EventAgencySplit.filter({ event_id: event.id }),
    enabled: !!event,
    initialData: [],
  });

  const updateShift = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventShift.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["eventShifts"] }),
    onError: (e) => toast.error(e.message),
  });
  const deleteShift = useMutation({
    mutationFn: (id) => base44.entities.EventShift.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["eventShifts"] }),
    onError: (e) => toast.error(e.message),
  });

  const displayAgencies = useMemo(
    () => orderAgenciesForDisplay(agencies.filter((a) => a.is_active)),
    [agencies]
  );
  const displayAgencyIds = useMemo(() => new Set(displayAgencies.map((a) => a.id)), [displayAgencies]);
  const orphanShifts = useMemo(() => shifts.filter((s) => !displayAgencyIds.has(s.agency_id)), [shifts, displayAgencyIds]);

  // Planned waiter count per agency — an explicit EventAgencySplit override
  // if the office set one, otherwise the standards-book default split — same
  // source of truth the staffing map uses, so a shortage flag here matches
  // what was actually planned for this event, not just today's headcount.
  const plannedByAgencyId = useMemo(() => {
    if (!event) return new Map();
    const computed = computeStaffing(event, rules, agencies, events).split;
    const map = new Map(computed.map((s) => [s.agency_id, s.planned_count]));
    for (const s of agencySplits) map.set(s.agency_id, s.planned_count);
    return map;
  }, [event, rules, agencies, events, agencySplits]);

  return (
    <div className="p-3 md:p-6 space-y-3 max-w-6xl mx-auto" dir="rtl">
      <WorkerPoolSection agencies={displayAgencies} workers={workers} />

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-emerald-700" /> נוכחות אירוע
        </h1>
        <Input type="date" className="h-9 w-40" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      {events.length === 0 && (
        <div className="text-center text-slate-400 py-12">אין אירועים בתאריך הזה</div>
      )}

      {events.length > 1 && (
        <Select value={event?.id} onValueChange={setSelectedEventId}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {event && (
        <>
          <Card className="bg-emerald-50/60 border-emerald-200">
            <CardContent className="p-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-bold text-base">{event.event_name}</div>
                <div className="text-slate-600">
                  {event.guest_count || 0} סועדים · {FORMAT_LABELS[event.staffing_format] || ""}
                  {event.event_time ? ` · ${event.event_time}` : ""}
                </div>
              </div>
              <Badge variant="outline" className="bg-white">{shifts.length} נוכחים</Badge>
            </CardContent>
          </Card>

          <ManagerAttendanceSection event={event} rules={rules} agencies={agencies} allEvents={events} />

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-start">
            {displayAgencies.map((agency) => (
              <AgencySection
                key={agency.id}
                event={event}
                agency={agency}
                workers={workers}
                shifts={shifts}
                plannedCount={plannedByAgencyId.get(agency.id) || 0}
                updateShift={updateShift}
                deleteShift={deleteShift}
              />
            ))}
          </div>

          {orphanShifts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-600 mt-2">ללא חברה ({orphanShifts.length})</h3>
              {orphanShifts.map((s) => (
                <ShiftRow
                  key={s.id}
                  shift={s}
                  onUpdate={(data) => updateShift.mutate({ id: s.id, data })}
                  onDelete={() => { if (confirm(`להסיר את ${s.worker_name}?`)) deleteShift.mutate(s.id); }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
