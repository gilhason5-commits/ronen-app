import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, User, FileText, Copy, Check, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export default function WorkSummaries() {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ["workSummaries"],
    queryFn: () => base44.entities.WorkSummary.list("-created_date", 200),
    initialData: [],
  });

  const filtered = summaries.filter(s =>
    !search || s.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.summary_text?.toLowerCase().includes(search.toLowerCase())
  );

  const formLink = `${window.location.origin}/WorkSummaryForm`;

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkSummary.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workSummaries"] });
      toast.success("הסיכום נמחק");
    },
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(formLink);
    setCopied(true);
    toast.success("הקישור הועתק!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">סיכומי עובדים</h1>
          <p className="text-stone-500 text-sm">סיכומי יום עבודה שהוגשו על ידי העובדים</p>
        </div>
        <Button onClick={handleCopyLink} variant="outline" className="gap-2 shrink-0">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copied ? "הועתק!" : "העתק קישור לטופס"}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input
          placeholder="חיפוש לפי שם או תוכן..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-stone-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-stone-300" />
          <p>{search ? "לא נמצאו תוצאות" : "עדיין לא הוגשו סיכומים"}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold text-stone-900">{s.employee_name}</span>
                      </div>
                    </div>
                    <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{s.summary_text}</p>
                    {s.issues_text && (
                      <div className="flex items-start gap-1.5 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800 whitespace-pre-wrap">{s.issues_text}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-stone-400 whitespace-nowrap">
                      {s.created_date ? format(new Date(s.created_date), "dd/MM/yyyy HH:mm") : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-stone-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(s.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}