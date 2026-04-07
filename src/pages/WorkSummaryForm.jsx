import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function WorkSummaryForm() {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await base44.functions.invoke('submitWorkSummary', {
      employee_name: name,
      summary_text: summary,
      issues_text: issues,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-stone-100 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-bold text-stone-900">הסיכום נשלח בהצלחה!</h2>
          <p className="text-stone-600">תודה {name}, הסיכום שלך נקלט במערכת.</p>
          <Button
            onClick={() => { setSubmitted(false); setName(""); setSummary(""); setIssues(""); }}
            variant="outline"
          >
            שלח סיכום נוסף
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-stone-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-stone-900">סיכום יום עבודה</h1>
          <p className="text-stone-500 text-sm">{format(new Date(), "dd/MM/yyyy · HH:mm")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">שם העובד</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הכנס את שמך המלא"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">סיכום העבודה</label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="ספר על מה עבדת היום..."
              rows={5}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">בעיות חריגות לטיפול</label>
            <Textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="תאר בעיות חריגות שדורשות טיפול (אם יש)..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || !name || !summary}
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-11"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
            {submitting ? "שולח..." : "שלח סיכום"}
          </Button>
        </form>
      </div>
    </div>
  );
}