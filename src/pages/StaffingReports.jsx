import React, { useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, FileText, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";

const todayStr = () => new Date().toLocaleDateString("sv-SE");

/** duration in hours between HH:MM strings (overnight-aware) */
function shiftHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const [h1, m1] = clockIn.split(":").map(Number);
  const [h2, m2] = clockOut.split(":").map(Number);
  if ([h1, m1, h2, m2].some(Number.isNaN)) return 0;
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // past midnight
  return Math.round((mins / 60) * 100) / 100;
}

const fmtHours = (h) => `${h.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ש'`;

// ---------- day summary + per-agency PDF ----------
function DaySummaryTab() {
  const [date, setDate] = useState(todayStr());
  const [exporting, setExporting] = useState(null);
  const printRef = useRef(null);
  const [printData, setPrintData] = useState(null);

  const { data: shifts = [] } = useQuery({
    queryKey: ["dayShifts", date],
    queryFn: () => base44.entities.EventShift.filter({ event_date: date }),
    initialData: [],
  });
  const { data: events = [] } = useQuery({
    queryKey: ["attendanceEvents", date],
    queryFn: () => base44.entities.Event.filter({ event_date: date }),
    initialData: [],
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

  const exportAgencyPdf = async (agencyName, agencyShifts) => {
    setExporting(agencyName);
    setPrintData({ agencyName, shifts: agencyShifts });
    await new Promise((r) => setTimeout(r, 80)); // let the hidden div render
    try {
      const el = printRef.current;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = pdf.internal.pageSize.getWidth() - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save(`דוח ${agencyName} ${date}.pdf`);
      toast.success(`דוח ${agencyName} נשמר`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(null);
      setPrintData(null);
    }
  };

  const eventNames = events.map((e) => e.event_name).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input type="date" className="h-9 w-44" value={date} onChange={(e) => setDate(e.target.value)} />
        {eventNames && <span className="text-sm text-slate-500">{eventNames}</span>}
      </div>

      {shifts.length === 0 && <div className="text-center text-slate-400 py-10">אין רישומי נוכחות בתאריך הזה</div>}

      {byAgency.map(([agencyName, agencyShifts]) => {
        const total = agencyShifts.reduce((s, x) => s + shiftHours(x.clock_in, x.clock_out), 0);
        return (
          <Card key={agencyName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{agencyName} — {agencyShifts.length} עובדים · {fmtHours(total)}</span>
                <Button size="sm" onClick={() => exportAgencyPdf(agencyName, agencyShifts)} disabled={exporting !== null}>
                  {exporting === agencyName ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <FileDown className="w-4 h-4 ml-1" />}
                  ייצוא PDF
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-slate-500">
                    <th className="p-2 pr-4">שם</th><th className="p-2">כניסה</th><th className="p-2">יציאה</th>
                    <th className="p-2">שעות</th><th className="p-2">תוספות</th><th className="p-2">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {agencyShifts.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="p-2 pr-4 font-medium">{s.worker_name}{s.is_substitute ? " (מחליף)" : ""}</td>
                      <td className="p-2 font-mono">{s.clock_in || "—"}</td>
                      <td className="p-2 font-mono">{s.clock_out || "—"}</td>
                      <td className="p-2">{fmtHours(shiftHours(s.clock_in, s.clock_out))}</td>
                      <td className="p-2 space-x-1 space-x-reverse">
                        {s.is_runner && <Badge variant="outline">ראנר</Badge>}
                        {s.is_closing && <Badge variant="outline">סגירה</Badge>}
                        {s.is_balcony && <Badge variant="outline">מרפסת</Badge>}
                      </td>
                      <td className="p-2 text-slate-500">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}

      {/* hidden print layout */}
      {printData && (
        <div ref={printRef} dir="rtl" style={{ position: "absolute", left: -9999, top: 0, width: 794, padding: 30, background: "#fff", fontFamily: "Arial, sans-serif", color: "#1c1917" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0b6e4f" }}>דוח נוכחות — {printData.agencyName}</h1>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>אולם אירועים ריי · תאריך: {date}{eventNames ? ` · ${eventNames}` : ""}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 12 }}>
            <thead>
              <tr>
                {["שם", "כניסה", "יציאה", "סה\"כ שעות", "הערות"].map((h) => (
                  <th key={h} style={{ background: "#0b4d3d", color: "#fff", padding: "6px 10px", textAlign: "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printData.shifts.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid #e5e5e5" }}>{s.worker_name}{s.is_substitute ? " (מחליף)" : ""}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid #e5e5e5" }}>{s.clock_in || "—"}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid #e5e5e5" }}>{s.clock_out || "—"}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid #e5e5e5" }}>{fmtHours(shiftHours(s.clock_in, s.clock_out))}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid #e5e5e5" }}>
                    {[s.is_runner && "ראנר", s.is_closing && "סגירה", s.note].filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "8px 10px", fontWeight: 700 }}>סה"כ</td>
                <td colSpan={2}></td>
                <td style={{ padding: "8px 10px", fontWeight: 700 }}>
                  {fmtHours(printData.shifts.reduce((s, x) => s + shiftHours(x.clock_in, x.clock_out), 0))}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- cumulative agency reports ----------
function AgencyReportsTab() {
  const [month, setMonth] = useState(() => todayStr().slice(0, 7)); // YYYY-MM

  const { data: shifts = [] } = useQuery({
    queryKey: ["monthShifts", month],
    queryFn: async () => {
      const all = await base44.entities.EventShift.list("event_date", 10000);
      return all.filter((s) => (s.event_date || "").startsWith(month));
    },
    initialData: [],
  });

  const report = useMemo(() => {
    const agencies = new Map();
    for (const s of shifts) {
      const key = s.agency_name || "ללא חברה";
      if (!agencies.has(key)) agencies.set(key, { days: new Map(), workers: new Map(), total: 0 });
      const a = agencies.get(key);
      const hours = shiftHours(s.clock_in, s.clock_out);
      a.total += hours;
      a.days.set(s.event_date, (a.days.get(s.event_date) || 0) + hours);
      const w = a.workers.get(s.worker_name) || { shifts: 0, hours: 0 };
      w.shifts += 1; w.hours += hours;
      a.workers.set(s.worker_name, w);
    }
    return [...agencies.entries()];
  }, [shifts]);

  return (
    <div className="space-y-4">
      <Input type="month" className="h-9 w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
      {report.length === 0 && <div className="text-center text-slate-400 py-10">אין נתוני נוכחות בחודש הזה</div>}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {report.map(([agencyName, data]) => (
          <Card key={agencyName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{agencyName} — סה"כ {fmtHours(data.total)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">לפי עובד</h4>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-right text-slate-500"><th className="p-1.5">שם</th><th className="p-1.5">משמרות</th><th className="p-1.5">שעות</th></tr></thead>
                  <tbody>
                    {[...data.workers.entries()].sort((a, b) => b[1].hours - a[1].hours).map(([name, w]) => (
                      <tr key={name} className="border-b last:border-0">
                        <td className="p-1.5 font-medium">{name}</td>
                        <td className="p-1.5">{w.shifts}</td>
                        <td className="p-1.5">{fmtHours(w.hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">לפי יום</h4>
                <div className="flex flex-wrap gap-1.5">
                  {[...data.days.entries()].sort().map(([d, h]) => (
                    <Badge key={d} variant="outline">{d.slice(8)}.{d.slice(5, 7)} · {fmtHours(h)}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function StaffingReports() {
  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <FileText className="w-6 h-6 text-emerald-700" /> סיכומי נוכחות ודוחות חברות
      </h1>
      <Tabs defaultValue="day" dir="rtl">
        <TabsList>
          <TabsTrigger value="day"><FileDown className="w-4 h-4 ml-1" /> סיכום יום</TabsTrigger>
          <TabsTrigger value="monthly"><BarChart3 className="w-4 h-4 ml-1" /> דוחות חודשיים</TabsTrigger>
        </TabsList>
        <TabsContent value="day"><DaySummaryTab /></TabsContent>
        <TabsContent value="monthly"><AgencyReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
