import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProtocolContent } from "@/components/protocols/ProtocolRichText";
import { ChevronDown, ChevronLeft, RotateCcw } from "lucide-react";

// Change log for the protocols tree, read from ProtocolNodeHistory (written
// by a DB trigger on every insert/update/delete — see the migration). With a
// nodeId it shows that node's history; without, every change on the page,
// including nodes that were deleted since.

const OP_LABEL = { INSERT: "נוצר", UPDATE: "עודכן", DELETE: "נמחק", SNAPSHOT: "מצב התחלתי" };
const OP_COLOR = {
  INSERT: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  SNAPSHOT: "bg-stone-100 text-stone-600",
};

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Human-readable list of what one history row changed.
function describeChanges(entry, titleOf) {
  const o = entry.old_row || {};
  const n = entry.new_row || {};
  if (entry.operation !== "UPDATE") return [];
  const lines = [];
  if (o.title !== n.title) lines.push(`שם: "${o.title}" ← "${n.title}"`);
  if ((o.content || "") !== (n.content || "")) lines.push("תוכן הפרוטוקול שונה");
  if (!sameJson(o.attachments || [], n.attachments || [])) {
    const oldPaths = new Set((o.attachments || []).map((a) => a.path || a.url));
    const newPaths = new Set((n.attachments || []).map((a) => a.path || a.url));
    (n.attachments || []).filter((a) => !oldPaths.has(a.path || a.url)).forEach((a) => lines.push(`נוסף קובץ: ${a.name}`));
    (o.attachments || []).filter((a) => !newPaths.has(a.path || a.url)).forEach((a) => lines.push(`הוסר קובץ: ${a.name}`));
  }
  if (o.parent_id !== n.parent_id) lines.push(`הועבר אל: ${n.parent_id ? titleOf(n.parent_id) : "רמה עליונה"}`);
  if (o.sort_order !== n.sort_order) lines.push(`סדר: ${o.sort_order ?? 0} ← ${n.sort_order ?? 0}`);
  return lines;
}

function HistoryEntry({ entry, titleOf, showNodeTitle, onRestoreContent, canRestore }) {
  const [open, setOpen] = useState(false);
  const o = entry.old_row || {};
  const n = entry.new_row || {};
  const row = entry.new_row || entry.old_row || {};
  const contentChanged = entry.operation === "UPDATE" && (o.content || "") !== (n.content || "");
  const lines = describeChanges(entry, titleOf);

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-white">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${OP_COLOR[entry.operation] || ""}`}>
          {OP_LABEL[entry.operation] || entry.operation}
        </span>
        {showNodeTitle && <span className="font-semibold text-stone-900">{row.title}</span>}
        <span className="text-stone-500">{format(new Date(entry.changed_at), "dd/MM/yyyy HH:mm:ss")}</span>
        <span className="text-stone-500">· {entry.changed_by_name || entry.changed_by_email || "לא ידוע"}</span>
      </div>
      {lines.length > 0 && (
        <ul className="mt-2 text-sm text-stone-700 list-disc pr-5 space-y-0.5">
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      {contentChanged && (
        <div className="mt-2">
          <button className="flex items-center gap-1 text-sm text-emerald-700 hover:underline" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {open ? "הסתר גרסאות" : "הצג לפני / אחרי"}
          </button>
          {open && (
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              {[["לפני", o.content], ["אחרי", n.content]].map(([label, content]) => (
                <div key={label} className="rounded border border-stone-200 p-3 bg-stone-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-stone-500">{label}</span>
                    {canRestore && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onRestoreContent(row.id, content || "")}>
                        <RotateCcw className="w-3.5 h-3.5 ml-1" />
                        שחזר גרסה זו
                      </Button>
                    )}
                  </div>
                  {content ? <ProtocolContent content={content} /> : <p className="text-sm text-stone-400">ריק</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProtocolHistoryDialog({ open, onOpenChange, nodeId, nodeTitle, byId, onRestoreContent }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["protocolHistory", nodeId || "all"],
    queryFn: () => (nodeId
      ? base44.entities.ProtocolNodeHistory.listWhere((q) => q.eq("node_id", nodeId), "-changed_at")
      : base44.entities.ProtocolNodeHistory.list("-changed_at")),
    enabled: open,
  });

  const titleOf = (id) => byId[id]?.title || "(נמחק)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="pl-8">{nodeId ? `היסטוריית שינויים — ${nodeTitle}` : "היסטוריית שינויים — כל הפרוטוקולים"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pl-1">
          {isLoading ? (
            <p className="text-sm text-stone-400">טוען...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-stone-400">אין שינויים עדיין.</p>
          ) : entries.map((e) => (
            <HistoryEntry
              key={e.id}
              entry={e}
              titleOf={titleOf}
              showNodeTitle={!nodeId}
              canRestore={!!byId[e.node_id]}
              onRestoreContent={onRestoreContent}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
