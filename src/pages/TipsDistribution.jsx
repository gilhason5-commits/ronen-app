import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Lock, Unlock, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { computeTipAllocation, formatShekel } from "@/lib/tipsEngine";

const currentMonth = () => new Date().toLocaleDateString("sv-SE").slice(0, 7);

export default function TipsDistribution() {
  const [month, setMonth] = useState(currentMonth());
  const [amountInput, setAmountInput] = useState("");
  const queryClient = useQueryClient();

  const { data: pools = [] } = useQuery({
    queryKey: ["tipPools"],
    queryFn: () => base44.entities.TipPool.list("-month"),
    initialData: [],
  });
  const pool = pools.find((p) => p.month === month);

  const { data: tipRules = [] } = useQuery({
    queryKey: ["tipRules"],
    queryFn: () => base44.entities.TipRule.list("sort_order"),
    initialData: [],
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ["monthShifts", month],
    queryFn: async () => {
      const all = await base44.entities.EventShift.list("event_date", 10000);
      return all.filter((s) => (s.event_date || "").startsWith(month));
    },
    initialData: [],
  });
  const { data: allocations = [] } = useQuery({
    queryKey: ["tipAllocations", pool?.id],
    queryFn: () => base44.entities.TipAllocation.filter({ pool_id: pool.id }),
    enabled: !!pool && pool.status === "locked",
    initialData: [],
  });

  const amount = pool ? Number(pool.amount) : Number(amountInput) || 0;
  const isLocked = pool?.status === "locked";

  const result = useMemo(
    () => computeTipAllocation(amount, tipRules, shifts),
    [amount, tipRules, shifts]
  );

  const savePool = useMutation({
    mutationFn: async (value) => {
      if (pool) return base44.entities.TipPool.update(pool.id, { amount: value });
      return base44.entities.TipPool.create({ month, amount: value });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tipPools"] }); toast.success("סכום הקופה נשמר"); },
    onError: (e) => toast.error(e.message),
  });

  const lockPool = useMutation({
    mutationFn: async () => {
      let p = pool;
      if (!p) p = await base44.entities.TipPool.create({ month, amount });
      // snapshot allocations
      const old = await base44.entities.TipAllocation.filter({ pool_id: p.id });
      await Promise.all(old.map((a) => base44.entities.TipAllocation.delete(a.id)));
      await base44.entities.TipAllocation.bulkCreate(
        result.workers.map((w) => ({
          pool_id: p.id,
          month,
          worker_name: w.worker_name,
          agency_name: w.agency_name,
          shifts: w.shifts,
          runners: w.runners,
          closings: w.closings,
          breakdown: w.breakdown,
          total: Math.round(w.total * 100) / 100,
        }))
      );
      await base44.entities.TipPool.update(p.id, { status: "locked", amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipPools"] });
      queryClient.invalidateQueries({ queryKey: ["tipAllocations"] });
      toast.success("החלוקה ננעלה ונשמרה להיסטוריה");
    },
    onError: (e) => toast.error(e.message),
  });

  const unlockPool = useMutation({
    mutationFn: () => base44.entities.TipPool.update(pool.id, { status: "draft" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tipPools"] }); toast.success("החלוקה נפתחה לעריכה"); },
    onError: (e) => toast.error(e.message),
  });

  // When locked — show the snapshot; otherwise the live computation
  const rows = isLocked && allocations.length
    ? allocations.map((a) => ({
        worker_name: a.worker_name, agency_name: a.agency_name, shifts: a.shifts,
        runners: a.runners, closings: a.closings, total: Number(a.total),
        shiftPay: a.breakdown?.shift_pay ?? 0, runnerPay: a.breakdown?.runner_pay ?? 0, closingPay: a.breakdown?.closing_pay ?? 0,
      }))
    : result.workers;

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Coins className="w-6 h-6 text-emerald-700" /> חלוקת טיפים חודשית
        </h1>
        <Input type="month" className="h-9 w-44" value={month} onChange={(e) => { setMonth(e.target.value); setAmountInput(""); }} />
      </div>

      <Card className="bg-emerald-50/60 border-emerald-200">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <span className="font-medium">קופה חודשית:</span>
          {isLocked ? (
            <span className="text-xl font-bold">{formatShekel(pool.amount)}</span>
          ) : (
            <>
              <Input
                type="number"
                className="h-9 w-36 bg-white"
                placeholder="סכום בשקלים"
                value={pool ? pool.amount : amountInput}
                onChange={(e) => (pool ? savePool.mutate(Number(e.target.value) || 0) : setAmountInput(e.target.value))}
              />
              {!pool && amount > 0 && (
                <Button size="sm" variant="outline" onClick={() => savePool.mutate(amount)}>שמור סכום</Button>
              )}
            </>
          )}
          <div className="flex-1" />
          {isLocked ? (
            <Button variant="outline" onClick={() => unlockPool.mutate()}>
              <Unlock className="w-4 h-4 ml-1" /> פתח לעריכה
            </Button>
          ) : (
            <Button disabled={amount <= 0 || result.workers.length === 0 || lockPool.isPending} onClick={() => { if (confirm("לנעול את החלוקה? התוצאה תישמר להיסטוריה.")) lockPool.mutate(); }}>
              {lockPool.isPending ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Lock className="w-4 h-4 ml-1" />}
              נעל חלוקה
            </Button>
          )}
        </CardContent>
      </Card>

      {amount > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-500">ניכויי תפקידים</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {result.deductions.filter((d) => d.amount > 0).map((d, i) => (
                <div key={i} className="flex justify-between">
                  <span>{d.role_name} <span className="text-slate-400">({d.label})</span></span>
                  <span>{formatShekel(d.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>סה"כ</span><span>{formatShekel(result.deducted)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-500">תוספות ראנר וסגירה</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>סה"כ תוספות מהנוכחות</span><span>{formatShekel(result.perOccurrenceTotal)}</span></div>
              <div className="text-xs text-slate-400">מחושב אוטומטית מסימוני ראנר/סגירה במסך הנוכחות</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-500">יתרה למלצרים</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>יתרה</span><span className="font-semibold">{formatShekel(result.remainder)}</span></div>
              <div className="flex justify-between"><span>משמרות בפועל</span><span>{result.totalShifts}</span></div>
              <div className="flex justify-between font-semibold text-emerald-700"><span>T למשמרת</span><span>{formatShekel(result.perShift)}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            פירוט לכל עובד
            {isLocked && <Badge className="bg-slate-700 gap-1"><Lock className="w-3 h-3" /> נעול</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-slate-500">
                <th className="p-2 pr-4">עובד</th><th className="p-2">חברה</th>
                <th className="p-2">משמרות</th><th className="p-2">שכר משמרות</th>
                <th className="p-2">ראנרים</th><th className="p-2">סגירות</th>
                <th className="p-2">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2 pr-4 font-medium">{w.worker_name}</td>
                  <td className="p-2 text-slate-500">{w.agency_name}</td>
                  <td className="p-2">{w.shifts}</td>
                  <td className="p-2">{formatShekel(w.shiftPay)}</td>
                  <td className="p-2">{w.runners > 0 ? `${w.runners} · ${formatShekel(w.runnerPay)}` : "—"}</td>
                  <td className="p-2">{w.closings > 0 ? `${w.closings} · ${formatShekel(w.closingPay)}` : "—"}</td>
                  <td className="p-2 font-bold">{formatShekel(w.total)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-400">אין נתוני נוכחות בחודש הזה — החלוקה מחושבת מהמשמרות שנרשמו במסך הנוכחות</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* history */}
      {pools.filter((p) => p.status === "locked" && p.month !== month).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> היסטוריה</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pools.filter((p) => p.status === "locked" && p.month !== month).map((p) => (
              <Button key={p.id} variant="outline" size="sm" onClick={() => setMonth(p.month)}>
                {p.month} · {formatShekel(p.amount)}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
