import { useState } from "react";

// The reports page's shared period filter: a whole year or a single month.
// The P&L tiles and the food-cost chart both follow it.
export default function useReportPeriod() {
  const [mode, setMode] = useState("year");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date());
  const shift = (dir) =>
    mode === "year"
      ? setYear((y) => y + dir)
      : setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));
  const label = mode === "year" ? String(year) : month.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  return { mode, setMode, year, month, shift, label };
}
