import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, Pencil } from "lucide-react";
import { toast } from "sonner";

export function WorkerChip({ worker, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(worker.full_name);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value.trim() !== worker.full_name) onRename(value);
    else setValue(worker.full_name);
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1 rounded-full border px-2 py-1 text-sm bg-white">
        <Input
          autoFocus
          className="h-7 w-32 text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setValue(worker.full_name); setEditing(false); }
          }}
        />
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm bg-slate-50">
      {worker.full_name}
      <button
        className="text-slate-400 hover:text-emerald-600"
        onClick={() => { setValue(worker.full_name); setEditing(true); }}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button className="text-slate-400 hover:text-red-500" onClick={onRemove}>
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// One card per agency ("ברובריקה משלהם" — each agency gets its own labeled
// section) for managing its AgencyWorker roster. This is the same pool
// EventAttendance's per-agency quick-add-worker popup reads from — adding,
// renaming, or removing a worker here changes who shows up there too.
function AgencyPoolCard({ agency, workers }) {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const agencyWorkers = workers.filter((w) => w.agency_id === agency.id);

  const addWorker = useMutation({
    mutationFn: async () => {
      const full_name = name.trim();
      if (!full_name) throw new Error("חסר שם עובד");
      await base44.entities.AgencyWorker.create({ agency_id: agency.id, agency_name: agency.name, full_name });
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

  // See the note on renameWorker in the original EventAttendance implementation:
  // this also fixes up EventShift.worker_name and matching TipAllocation rows
  // so a rename shows correctly everywhere, past and future.
  const renameWorker = useMutation({
    mutationFn: async ({ worker, newName }) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === worker.full_name) return;

      await base44.entities.AgencyWorker.update(worker.id, { full_name: trimmed });

      const relatedShifts = await base44.entities.EventShift.filter({ worker_id: worker.id });
      await Promise.all(relatedShifts.map((s) => base44.entities.EventShift.update(s.id, { worker_name: trimmed })));

      const relatedAllocations = await base44.entities.TipAllocation.filter({ worker_name: worker.full_name });
      await Promise.all(
        relatedAllocations
          .filter((a) => (a.agency_name || "") === (worker.agency_name || agency.name || ""))
          .map((a) => base44.entities.TipAllocation.update(a.id, { worker_name: trimmed }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencyWorkers"] });
      queryClient.invalidateQueries({ queryKey: ["eventShifts"] });
      queryClient.invalidateQueries({ queryKey: ["monthShifts"] });
      queryClient.invalidateQueries({ queryKey: ["tipAllocations"] });
      toast.success("שם העובד עודכן בכל המקומות, כולל טיפים קודמים");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{agency.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {agencyWorkers.map((w) => (
            <WorkerChip
              key={w.id}
              worker={w}
              onRename={(newName) => renameWorker.mutate({ worker: w, newName })}
              onRemove={() => { if (confirm(`להסיר את ${w.full_name} מהמאגר?`)) removeWorker.mutate(w.id); }}
            />
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
    </Card>
  );
}

export default function AgencyWorkerPool({ agencies, workers }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {agencies.map((agency) => (
        <AgencyPoolCard key={agency.id} agency={agency} workers={workers} />
      ))}
    </div>
  );
}
