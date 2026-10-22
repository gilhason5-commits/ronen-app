import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Change log for one employee card, read from TaskEmployeeHistory (written
// by a DB trigger on every insert/update/delete — see the migration).

const OP_LABEL = { INSERT: "נוצר", UPDATE: "עודכן", DELETE: "נמחק" };
const OP_COLOR = {
  INSERT: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

// Columns that are bookkeeping, or an id whose *_name twin is shown instead.
const SKIP = new Set(["id", "created_date", "updated_date", "created_by", "department_id", "role_id", "secondary_role_id", "agency_id", "backup_employee_id", "manager_id"]);

const FIELD_LABEL = {
  full_name: "שם", phone_e164: "נייד", department_name: "מחלקה", role_name: "תפקיד",
  secondary_role_name: "תפקיד נוסף", secondary_rate: "שכר בתפקיד הנוסף", backup_employee_name: "עובד חלופי",
  agency_name: "סוכנות", pay_type: "סוג שכר", hourly_rate: "שכר שעתי", global_rate: "שכר יומי / חודשי",
  salary_basis: "נטו / ברוטו", overtime_pay: "שעות נוספות", recuperation_pay: "הבראה", vacation_pay: "חופש",
  travel_pay: "נסיעות", travel_amount: "סכום נסיעות", note: "הערות נוספות",
  via_staffing_company: "חברת כח אדם", employer_cost_global: "עלות מעביד חודשית",
  employer_cost_hourly: "עלות מעביד שעתית", employer_cost_daily: "עלות מעביד יומית",
  agreement_signed: "חתם על הסכם עבודה", work_agreement: "קובץ הסכם", agreement_notes: "הערות הסכם",
  procedures_signed: "חתם על נהלי עבודה", procedures_notes: "הערות נהלים",
  is_active: "פעיל", whatsapp_enabled: "WhatsApp", certifications: "הסמכות",
};

const VALUE_LABEL = {
  hourly: "שעתי", global: "יומי", monthly: "חודשי", both: "שעתי + יומי",
  net: "נטו", gross: "ברוטו", included: "כלול", paid: "לשלם",
};

const show = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (v === true) return "כן";
  if (v === false) return "לא";
  return VALUE_LABEL[v] || String(v);
};

function describeChanges(entry) {
  if (entry.operation !== "UPDATE") return [];
  const o = entry.old_row || {};
  const n = entry.new_row || {};
  return Object.keys({ ...o, ...n })
    .filter((k) => !SKIP.has(k) && JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null))
    .map((k) => `${FIELD_LABEL[k] || k}: ${show(o[k])} ← ${show(n[k])}`);
}

export default function EmployeeHistoryDialog({ open, onOpenChange, employeeId, employeeName }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["employeeHistory", employeeId],
    queryFn: () => base44.entities.TaskEmployeeHistory.listWhere((q) => q.eq("employee_id", employeeId), "-changed_at"),
    enabled: open && !!employeeId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="pl-8">היסטוריית שינויים — {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pl-1">
          {isLoading ? (
            <p className="text-sm text-stone-400">טוען...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-stone-400">אין שינויים עדיין.</p>
          ) : entries.map((e) => {
            const lines = describeChanges(e);
            return (
              <div key={e.id} className="border border-stone-200 rounded-lg p-3 bg-white">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${OP_COLOR[e.operation] || ""}`}>
                    {OP_LABEL[e.operation] || e.operation}
                  </span>
                  <span className="text-stone-500">{format(new Date(e.changed_at), "dd/MM/yyyy HH:mm")}</span>
                  <span className="text-stone-500">· {e.changed_by_name || e.changed_by_email || "לא ידוע"}</span>
                </div>
                {lines.length > 0 && (
                  <ul className="mt-2 text-sm text-stone-700 list-disc pr-5 space-y-0.5">
                    {lines.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
