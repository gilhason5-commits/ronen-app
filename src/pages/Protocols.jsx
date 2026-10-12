import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Library, Folder, FileText, ChevronDown, ChevronLeft, ChevronUp, Plus, Pencil, Trash2, Check, X, Search, Eye, Paperclip, Upload,
} from "lucide-react";
import { toast } from "sonner";

// Modular knowledge base: ProtocolNode rows form one tree. Top-level nodes are
// knowledge bases, their children sub-categories at any depth, and every node
// may carry body text. Only admins edit (titles, text, order, structure).

const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.created_date || "").localeCompare(b.created_date || "");

function InlineTitleEditor({ initial, onSave, onCancel, placeholder }) {
  const [draft, setDraft] = useState(initial || "");
  const commit = () => {
    const v = draft.trim();
    if (v) onSave(v);
    else onCancel();
  };
  return (
    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        value={draft}
        placeholder={placeholder}
        className="h-8 text-sm"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-700" onClick={commit}>
        <Check className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function TreeNode({ node, depth, ctx }) {
  const { childrenOf, selectedId, setSelectedId, expanded, toggle, editMode, renamingId, setRenamingId,
    addingUnder, setAddingUnder, actions, visibleIds } = ctx;
  if (visibleIds && !visibleIds.has(node.id)) return null;
  const children = childrenOf(node.id);
  const isOpen = expanded.has(node.id) || !!visibleIds;
  const isSelected = selectedId === node.id;
  const siblings = childrenOf(node.parent_id);
  const idx = siblings.findIndex((s) => s.id === node.id);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer ${
          isSelected ? "bg-emerald-100 text-emerald-900" : "hover:bg-stone-100 text-stone-800"
        }`}
        style={{ paddingRight: 8 + depth * 16 }}
        onClick={() => setSelectedId(node.id)}
      >
        <button
          className={`w-5 h-5 flex items-center justify-center shrink-0 ${children.length ? "" : "invisible"}`}
          onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {depth === 0
          ? <Library className="w-4 h-4 shrink-0 text-emerald-700" />
          : children.length
            ? <Folder className="w-4 h-4 shrink-0 text-amber-600" />
            : <FileText className="w-4 h-4 shrink-0 text-stone-500" />}
        {renamingId === node.id ? (
          <InlineTitleEditor
            initial={node.title}
            onSave={(title) => { actions.rename(node, title); setRenamingId(null); }}
            onCancel={() => setRenamingId(null)}
          />
        ) : (
          <span className={`flex-1 truncate text-sm ${depth === 0 ? "font-bold" : ""}`}>{node.title}</span>
        )}
        {editMode && renamingId !== node.id && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx <= 0} onClick={() => actions.move(node, -1)} title="הזז למעלה">
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx >= siblings.length - 1} onClick={() => actions.move(node, 1)} title="הזז למטה">
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddingUnder(node.id)} title="הוסף תת קטגוריה">
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRenamingId(node.id)} title="שנה שם">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => actions.askDelete(node)} title="מחק">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      {(isOpen || addingUnder === node.id) && (
        <div>
          {children.map((c) => <TreeNode key={c.id} node={c} depth={depth + 1} ctx={ctx} />)}
          {addingUnder === node.id && (
            <div className="py-1" style={{ paddingRight: 8 + (depth + 1) * 16 + 24 }}>
              <InlineTitleEditor
                placeholder="שם תת הקטגוריה"
                onSave={(title) => { actions.create(node.id, title); setAddingUnder(null); }}
                onCancel={() => setAddingUnder(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ATTACHMENTS_BUCKET = "protocol-files";

// Upload one PDF: the API hands back a signed upload URL (admins only), the
// browser uploads straight to Storage.
async function uploadProtocolPdf(file) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/protocol-upload-url", {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token || ""}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).uploadToSignedUrl(body.path, body.token, file, { contentType: "application/pdf" });
  if (error) throw error;
  return { name: file.name, url: body.publicUrl, path: body.path };
}

// PDF attachments on any node: everyone can open them (in a popup viewer),
// admins in edit mode can add and remove.
function ProtocolAttachments({ node, canEdit, onSave, saving }) {
  const attachments = node.attachments || [];
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const inputId = `protocol-pdf-${node.id}`;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (files.some((f) => f.type !== "application/pdf")) {
      toast.error("אפשר להעלות רק קבצי PDF");
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const f of files) uploaded.push(await uploadProtocolPdf(f));
      onSave([...attachments, ...uploaded]);
    } catch (err) {
      toast.error(`העלאת PDF נכשלה: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (!attachments.length && !canEdit) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-stone-500 mb-2">קבצים מצורפים</h3>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a, i) => (
          <div key={a.path || a.url} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white pr-3 pl-1 py-1">
            <button className="flex items-center gap-2 text-sm text-stone-800 hover:text-emerald-700" onClick={() => setViewing(a)}>
              <Paperclip className="w-4 h-4 text-red-600" />
              <span className="max-w-[16rem] truncate">{a.name}</span>
            </button>
            {canEdit && (
              <Button
                variant="ghost" size="icon" className="h-6 w-6" title="הסר קובץ" disabled={saving}
                onClick={() => onSave(attachments.filter((_, k) => k !== i))}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
        {canEdit && (
          <>
            <input id={inputId} type="file" accept="application/pdf" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
            <Button variant="outline" size="sm" disabled={uploading || saving} onClick={() => document.getElementById(inputId)?.click()}>
              <Upload className="w-4 h-4 ml-1" />
              {uploading ? "מעלה..." : "הוסף PDF"}
            </Button>
          </>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4" dir="rtl">
          <DialogHeader>
            <DialogTitle className="truncate pl-8">{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing && <iframe src={viewing.url} title={viewing.name} className="flex-1 w-full rounded border border-stone-200" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Protocols() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [addingUnder, setAddingUnder] = useState(null); // node id, or "root"
  const [toDelete, setToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState("");

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["protocolNodes"],
    queryFn: () => base44.entities.ProtocolNode.list("sort_order"),
  });

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const childrenMap = useMemo(() => {
    const m = {};
    nodes.forEach((n) => { (m[n.parent_id || "root"] ||= []).push(n); });
    Object.values(m).forEach((arr) => arr.sort(bySort));
    return m;
  }, [nodes]);
  const childrenOf = (id) => childrenMap[id || "root"] || [];

  const pathTo = (id) => {
    const path = [];
    let cur = byId[id];
    while (cur) { path.unshift(cur); cur = byId[cur.parent_id]; }
    return path;
  };

  // Search: keep matches plus their ancestors so the tree stays navigable.
  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set();
    nodes.forEach((n) => {
      if (n.title.toLowerCase().includes(q) || (n.content || "").toLowerCase().includes(q)) {
        let cur = n;
        while (cur && !ids.has(cur.id)) { ids.add(cur.id); cur = byId[cur.parent_id]; }
      }
    });
    return ids;
  }, [search, nodes, byId]);

  const selected = selectedId ? byId[selectedId] : null;
  useEffect(() => {
    if (selectedId && !byId[selectedId] && !isLoading) setSelectedId(null);
  }, [selectedId, byId, isLoading]);
  useEffect(() => { setEditingContent(false); }, [selectedId]);

  const selectNode = (id) => {
    setSelectedId(id);
    // Opening a node reveals its path in the tree.
    setExpanded((prev) => {
      const next = new Set(prev);
      pathTo(id).forEach((n) => next.add(n.id));
      return next;
    });
  };

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["protocolNodes"] });
  const onError = (e) => toast.error(`שגיאה: ${e.message}`);

  const createMutation = useMutation({
    mutationFn: ({ parentId, title }) => {
      const siblings = childrenOf(parentId);
      const sort_order = siblings.length ? Math.max(...siblings.map((s) => s.sort_order ?? 0)) + 1 : 0;
      return base44.entities.ProtocolNode.create({ parent_id: parentId || null, title, sort_order });
    },
    onSuccess: (created) => {
      invalidate();
      if (created?.parent_id) setExpanded((prev) => new Set(prev).add(created.parent_id));
    },
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProtocolNode.update(id, data),
    onSuccess: invalidate,
    onError,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ node, dir }) => {
      const siblings = [...childrenOf(node.parent_id)];
      const i = siblings.findIndex((s) => s.id === node.id);
      const j = i + dir;
      if (j < 0 || j >= siblings.length) return;
      [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
      await Promise.all(
        siblings
          .map((s, k) => (s.sort_order !== k ? base44.entities.ProtocolNode.update(s.id, { sort_order: k }) : null))
          .filter(Boolean)
      );
    },
    onSuccess: invalidate,
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProtocolNode.delete(id), // children cascade in the DB
    onSuccess: () => { invalidate(); toast.success("נמחק"); },
    onError,
  });

  const actions = {
    create: (parentId, title) => createMutation.mutate({ parentId, title }),
    rename: (node, title) => title !== node.title && updateMutation.mutate({ id: node.id, data: { title } }),
    move: (node, dir) => moveMutation.mutate({ node, dir }),
    askDelete: (node) => setToDelete(node),
  };

  const countDescendants = (id) => childrenOf(id).reduce((sum, c) => sum + 1 + countDescendants(c.id), 0);

  const ctx = {
    childrenOf, selectedId, setSelectedId: selectNode, expanded, toggle,
    editMode: isAdmin && editMode, renamingId, setRenamingId, addingUnder, setAddingUnder, actions, visibleIds,
  };

  const roots = childrenOf(null);
  const canEdit = isAdmin && editMode;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Library className="w-7 h-7 text-emerald-700" />
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900">פרוטוקולים</h1>
        </div>
        {isAdmin && (
          <Button
            variant={editMode ? "default" : "outline"}
            className={editMode ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            onClick={() => { setEditMode(!editMode); setRenamingId(null); setAddingUnder(null); }}
          >
            {editMode ? <Eye className="w-4 h-4 ml-1" /> : <Pencil className="w-4 h-4 ml-1" />}
            {editMode ? "מעבר למצב צפייה" : "מעבר למצב עריכה"}
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Tree */}
        <Card className="w-full md:w-80 shrink-0 border-stone-200">
          <CardContent className="p-3">
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש..." className="h-9 pr-8 text-sm" />
            </div>

            {isLoading ? (
              <p className="text-sm text-stone-400 p-2">טוען...</p>
            ) : roots.length === 0 && addingUnder !== "root" ? (
              <p className="text-sm text-stone-400 p-2">
                {isAdmin ? "אין עדיין מאגרי ידע. הפעל מצב עריכה והוסף מאגר." : "אין עדיין פרוטוקולים."}
              </p>
            ) : (
              <div className="space-y-0.5">
                {roots.map((n) => <TreeNode key={n.id} node={n} depth={0} ctx={ctx} />)}
                {visibleIds && visibleIds.size === 0 && <p className="text-sm text-stone-400 p-2">לא נמצאו תוצאות</p>}
              </div>
            )}

            {canEdit && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                {addingUnder === "root" ? (
                  <InlineTitleEditor
                    placeholder="שם מאגר הידע"
                    onSave={(title) => { actions.create(null, title); setAddingUnder(null); }}
                    onCancel={() => setAddingUnder(null)}
                  />
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingUnder("root")}>
                    <Plus className="w-4 h-4 ml-1" />
                    מאגר ידע חדש
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content */}
        <Card className="flex-1 w-full border-stone-200 min-h-[50vh]">
          <CardContent className="p-5 md:p-8">
            {!selected ? (
              <div className="text-center text-stone-400 py-16">
                <Library className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                בחר מאגר ידע או תת קטגוריה מהרשימה
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-1 text-sm text-stone-500 mb-2">
                  {pathTo(selected.id).slice(0, -1).map((p) => (
                    <React.Fragment key={p.id}>
                      <button className="hover:text-emerald-700 hover:underline" onClick={() => selectNode(p.id)}>{p.title}</button>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </React.Fragment>
                  ))}
                </div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 className="text-2xl font-bold text-stone-900">{selected.title}</h2>
                  {canEdit && !editingContent && (
                    <Button variant="outline" size="sm" onClick={() => { setContentDraft(selected.content || ""); setEditingContent(true); }}>
                      <Pencil className="w-4 h-4 ml-1" />
                      ערוך תוכן
                    </Button>
                  )}
                </div>

                {editingContent ? (
                  <div className="space-y-3">
                    <Textarea
                      autoFocus
                      value={contentDraft}
                      onChange={(e) => setContentDraft(e.target.value)}
                      className="min-h-[300px] text-base leading-relaxed"
                      placeholder="כתוב כאן את תוכן הפרוטוקול..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingContent(false)}>ביטול</Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate(
                          { id: selected.id, data: { content: contentDraft } },
                          { onSuccess: () => { setEditingContent(false); toast.success("נשמר"); } }
                        )}
                      >
                        שמור
                      </Button>
                    </div>
                  </div>
                ) : selected.content ? (
                  <div className="whitespace-pre-wrap text-stone-800 leading-relaxed text-base">{selected.content}</div>
                ) : childrenOf(selected.id).length === 0 ? (
                  <p className="text-stone-400 text-sm">{canEdit ? "אין תוכן עדיין. לחץ על ״ערוך תוכן״." : "אין תוכן עדיין."}</p>
                ) : null}

                <ProtocolAttachments
                  key={selected.id}
                  node={selected}
                  canEdit={canEdit}
                  saving={updateMutation.isPending}
                  onSave={(attachments) => updateMutation.mutate({ id: selected.id, data: { attachments } })}
                />

                {childrenOf(selected.id).length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-stone-500 mb-2">תתי קטגוריות</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {childrenOf(selected.id).map((c) => {
                        const n = childrenOf(c.id).length;
                        return (
                          <button
                            key={c.id}
                            onClick={() => selectNode(c.id)}
                            className="text-right p-4 rounded-xl border border-stone-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 font-semibold text-stone-900">
                              {n ? <Folder className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-stone-500" />}
                              <span className="truncate">{c.title}</span>
                            </div>
                            {n > 0 && <div className="text-xs text-stone-500 mt-1">{n} תתי קטגוריות</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && countDescendants(toDelete.id) > 0
                ? `יימחקו גם ${countDescendants(toDelete.id)} תתי הקטגוריות שבתוכו. לא ניתן לבטל.`
                : "לא ניתן לבטל."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { deleteMutation.mutate(toDelete.id); setToDelete(null); }}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
