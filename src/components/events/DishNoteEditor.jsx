import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function DishNoteEditor({ eventDish, onNoteSaved }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftNote, setDraftNote] = useState("");

  const eventDishId = eventDish?.id;

  // Fetch note record for this event dish
  const { data: noteRecords = [], isLoading } = useQuery({
    queryKey: ["dish_note", eventDishId],
    queryFn: () => base44.entities.EventDishNote.filter({ event_dish_id: eventDishId }),
    enabled: !!eventDishId,
  });

  const noteRecord = noteRecords[0] || null;
  const savedNote = noteRecord?.note || "";

  useEffect(() => {
    if (!editing) {
      setDraftNote(savedNote);
    }
  }, [savedNote, editing]);

  const handleSave = async () => {
    setSaving(true);
    if (noteRecord) {
      // Update existing note
      await base44.entities.EventDishNote.update(noteRecord.id, { note: draftNote });
    } else {
      // Create new note
      await base44.entities.EventDishNote.create({
        event_dish_id: eventDishId,
        event_id: eventDish?.event_id || "",
        dish_id: eventDish?.dish_id || "",
        note: draftNote,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["dish_note", eventDishId] });
    queryClient.invalidateQueries({ queryKey: ["all_dish_notes"] });
    if (onNoteSaved) onNoteSaved(eventDishId, draftNote);
    toast.success("הערה נשמרה");
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraftNote(savedNote);
    setEditing(false);
  };

  if (!eventDish) return null;

  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-1 text-xs text-stone-400">
        <Loader2 className="w-3 h-3 animate-spin" /> טוען הערה...
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-1.5">
        <Textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          placeholder="כתוב הערה..."
          className="text-xs min-h-[48px] resize-none"
          autoFocus
        />
        <div className="flex gap-1 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-stone-500"
            onClick={handleCancel}
            disabled={saving}
          >
            <X className="w-3 h-3 ml-0.5" />
            ביטול
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSave}
            disabled={saving}
          >
            <Check className="w-3 h-3 ml-0.5" />
            {saving ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-start gap-1">
      {savedNote ? (
        <div className="flex-1 flex items-start gap-1.5 text-xs text-stone-600 bg-stone-100 rounded px-2 py-1">
          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-stone-400" />
          <span className="flex-1">{savedNote}</span>
          <button
            onClick={() => setEditing(true)}
            className="p-0.5 rounded hover:bg-stone-200 shrink-0"
            title="ערוך הערה"
          >
            <Pencil className="w-3 h-3 text-stone-400" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded px-2 py-1 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          הוסף הערה
        </button>
      )}
    </div>
  );
}