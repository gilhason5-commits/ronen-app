import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Plus, Trash2, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { FORMAT_LABELS } from "@/lib/staffingEngine";

const todayStr = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ShiftRow({ shift, onUpdate, onDelete }) {
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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-slate-500">כניסה</span>
          <Input type="time" className="h-9" value={shift.clock_in || ""} onChange={(e) => onUpdate({ clock_in: e.target.value })} />
        </div>
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-slate-500">יציאה</span>
          <Input type="time" className="h-9" value={shift.clock_out || ""} onChange={(e) => onUpdate({ clock_out: e.target.value })} />
        </div>
        {!shift.clock_out && (
          <Button size="sm" variant="outline" className="h-9" onClick={() => onUpdate({ clock_out: nowTime() })}>
            <Clock className="w-3.5 h-3.5 ml-1" /> עכשיו
          </Button>
        )}
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

function AddWorkerForm({ event, agencies, workers, shifts, onAdded }) {
  const [agencyId, setAgencyId] = useState(agencies[0]?.id);
  const [name, setName] = useState("");
  const [isSubstitute, setIsSubstitute] = useState(false);
  const queryClient = useQueryClient();

  const agency = agencies.find((a) => a.id === agencyId);
  const existingNames = new Set(shifts.map((s) => (s.worker_id || `name:${s.worker_name}`)));
  const knownWorkers = workers.filter((w) => w.agency_id === agencyId && w.is_active && !existingNames.has(w.id));

  const addShift = useMutation({
    mutationFn: async ({ worker, freeName }) => {
      let workerId = worker?.id || null;
      let workerName = worker?.full_name || freeName.trim();
      if (!workerName) throw new Error("חסר שם עובד");
      // Remember new names for next events
      if (!worker && workerName) {
        const created = await base44.entities.AgencyWorker.create({
          agency_id: agencyId, agency_name: agency?.name, full_name: workerName,
        });
        workerId = created.id;
      }
      await base44.entities.EventShift.create({
        event_id: event.id,
        event_date: event.event_date,
        worker_id: workerId,
        worker_name: workerName,
        agency_id: agencyId,
        agency_name: agency?.name,
        clock_in: nowTime(),
        is_substitute: isSubstitute,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventShifts"] });
      queryClient.invalidateQueries({ queryKey: ["agencyWorkers"] });
      setName("");
      setIsSubstitute(false);
      onAdded?.();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" /> הוספת עובד</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={agencyId} onValueChange={setAgencyId}>
          <SelectTrigger className="h-10"><SelectValue placeholder="חברת כוח אדם" /></SelectTrigger>
          <SelectContent>
            {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {knownWorkers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {knownWorkers.map((w) => (
              <button
                key={w.id}
                className="rounded-full border px-3 py-1.5 text-sm bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 transition"
                onClick={() => addShift.mutate({ worker: w })}
              >
                {w.full_name}
              </button>
            ))}
          </div>
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
      </CardContent>
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

  const { data: shifts = [] } = useQuery({
    queryKey: ["eventShifts", event?.id],
    queryFn: () => base44.entities.EventShift.filter({ event_id: event.id }),
    enabled: !!event,
    initialData: [],
  });
  const { data: agencies = [] } = useQuery({ queryKey: ["staffingAgencies"], queryFn: () => base44.entities.StaffingAgency.list("sort_order"), initialData: [] });
  const { data: workers = [] } = useQuery({ queryKey: ["agencyWorkers"], queryFn: () => base44.entities.AgencyWorker.list("full_name"), initialData: [] });

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

  const byAgency = useMemo(() => {
    const groups = new Map();
    for (const s of shifts) {
      const key = s.agency_name || "ללא חברה";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    return [...groups.entries()];
  }, [shifts]);

  return (
    <div className="p-3 md:p-6 space-y-3 max-w-xl mx-auto" dir="rtl">
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

          <AddWorkerForm event={event} agencies={agencies} workers={workers} shifts={shifts} />

          {byAgency.map(([agencyName, agencyShifts]) => (
            <div key={agencyName} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-600 mt-2">{agencyName} ({agencyShifts.length})</h3>
              {agencyShifts.map((s) => (
                <ShiftRow
                  key={s.id}
                  shift={s}
                  onUpdate={(data) => updateShift.mutate({ id: s.id, data })}
                  onDelete={() => { if (confirm(`להסיר את ${s.worker_name}?`)) deleteShift.mutate(s.id); }}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
