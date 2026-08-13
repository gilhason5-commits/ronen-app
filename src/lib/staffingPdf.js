import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { computeStaffing } from "@/lib/staffingEngine";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const FORMAT_LABELS = { serving: "הגשה", flipped: "הפוכה", connected: "מחוברת", party: "מסיבה", tasting: "טעימות" };

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
function dayName(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return DAY_NAMES[d.getDay()];
}

// Renders an off-screen HTML table into a real, downloadable multi-page PDF
// (same html2canvas + jsPDF pipeline already used by ProducerEventPrint.jsx),
// rather than a browser print dialog.
async function downloadTablePdf({ title, subtitle, columns, rows, filename, orientation = "l" }) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = orientation === "l" ? "1400px" : "900px";
  container.style.padding = "24px";
  container.style.background = "#ffffff";
  container.style.direction = "rtl";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.color = "#1c1917";

  const theadCells = columns.map((c) => `<th style="border:1px solid #d6d3d1;background:#f5f5f4;padding:6px 8px;font-size:12px;text-align:center;white-space:nowrap;">${c.label}</th>`).join("");
  const bodyRows = rows.map((row) => `
    <tr>
      ${columns.map((c) => `<td style="border:1px solid #e7e5e4;padding:5px 8px;font-size:11px;text-align:center;white-space:nowrap;">${row[c.key] ?? ""}</td>`).join("")}
    </tr>
  `).join("");

  container.innerHTML = `
    <div style="font-size:20px;font-weight:900;margin-bottom:4px;">${title}</div>
    ${subtitle ? `<div style="font-size:13px;color:#78716c;margin-bottom:16px;">${subtitle}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>${theadCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div style="margin-top:20px;font-size:10px;color:#a8a29e;">הופק בתאריך ${new Date().toLocaleDateString("he-IL")}</div>
  `;
  document.body.appendChild(container);

  const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  document.body.removeChild(container);

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF(orientation, "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth - 16;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let yOffset = 8;
  let remainingHeight = imgHeight;
  const pageContentHeight = pdfHeight - 16;

  pdf.addImage(imgData, "PNG", 8, yOffset, imgWidth, imgHeight);
  remainingHeight -= pageContentHeight;
  while (remainingHeight > 0) {
    pdf.addPage();
    yOffset = -(imgHeight - remainingHeight) + 8;
    pdf.addImage(imgData, "PNG", 8, yOffset, imgWidth, imgHeight);
    remainingHeight -= pageContentHeight;
  }

  pdf.save(filename);
}

function assignedLabel(roleName, event, rules, planRows) {
  const staffing = computeStaffing(event, rules, [], []);
  const req = staffing.requiredRoles.find((r) => r.role_name === roleName);
  if (!req) return "—";
  const names = [];
  for (let slot = 1; slot <= req.count; slot++) {
    const assigned = planRows.find((p) => p.event_id === event.id && p.role_name === roleName && (p.slot || 1) === slot);
    names.push(assigned?.assigned_name || "נדרש");
  }
  return names.join(", ");
}

// PDF #1 — "אילוצים": event / date / time + every required-role column, no
// agency or waiter-count columns. A bare requirements checklist.
export function exportConstraintsPdf({ events, rules, roleColumns, monthLabel, allPlans = [] }) {
  const columns = [
    { key: "event_name", label: "שם האירוע" },
    { key: "date", label: "תאריך" },
    { key: "time", label: "שעה" },
    ...roleColumns.map((r) => ({ key: r, label: r })),
  ];
  const rows = events
    .slice()
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .map((event) => {
      const row = {
        event_name: event.event_name,
        date: formatDate(event.event_date),
        time: event.event_time || "-",
      };
      roleColumns.forEach((roleName) => {
        row[roleName] = assignedLabel(roleName, event, rules, allPlans);
      });
      return row;
    });

  downloadTablePdf({
    title: "אילוצים",
    subtitle: monthLabel,
    columns,
    rows,
    filename: `אילוצים - ${monthLabel}.pdf`,
    orientation: "l",
  });
}

// PDF #2 — one separate PDF per active agency: event / date / day / brief
// time / headcount needed from that specific supplier.
export function exportSupplierOrdersPdf({ events, rules, agencies, monthLabel, allSplits = [] }) {
  const sortedEvents = events.slice().sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  const columns = [
    { key: "event_name", label: "שם האירוע" },
    { key: "date", label: "תאריך" },
    { key: "day", label: "יום" },
    { key: "brief", label: "שעת בריף" },
    { key: "count", label: "כמות אנשים" },
  ];

  agencies.forEach((agency) => {
    const rows = sortedEvents.map((event) => {
      const staffing = computeStaffing(event, rules, agencies, events);
      const override = allSplits.find((s) => s.event_id === event.id && s.agency_id === agency.id);
      const computed = staffing.split.find((s) => s.agency_id === agency.id)?.planned_count ?? 0;
      const count = override ? override.planned_count : computed;
      return {
        event_name: event.event_name,
        date: formatDate(event.event_date),
        day: dayName(event.event_date),
        brief: staffing.briefTime || "-",
        count,
      };
    }).filter((r) => Number(r.count) > 0);

    downloadTablePdf({
      title: `הזמנת רכש - ${agency.name}`,
      subtitle: monthLabel,
      columns,
      rows,
      filename: `הזמנת רכש - ${agency.name} - ${monthLabel}.pdf`,
      orientation: "p",
    });
  });
}

// PDF #3 — "דוח לפרסום פלור": everything the live map shows (event, date,
// day, event time, brief time, guest count, format, every role) EXCEPT the
// agency / waiter-count columns — for posting where the floor team sees it.
export function exportFloorReportPdf({ events, rules, roleColumns, monthLabel, allPlans = [] }) {
  const columns = [
    { key: "event_name", label: "שם האירוע" },
    { key: "date", label: "תאריך" },
    { key: "day", label: "יום" },
    { key: "time", label: "שעת אירוע" },
    { key: "brief", label: "שעת בריף" },
    { key: "guests", label: "כמות" },
    { key: "format", label: "פורמט" },
    ...roleColumns.map((r) => ({ key: r, label: r })),
  ];
  const rows = events
    .slice()
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .map((event) => {
      const staffing = computeStaffing(event, rules, [], events);
      const row = {
        event_name: event.event_name,
        date: formatDate(event.event_date),
        day: dayName(event.event_date),
        time: event.event_time || "-",
        brief: staffing.briefTime || "-",
        guests: event.guest_count || 0,
        format: FORMAT_LABELS[event.staffing_format] || "-",
      };
      roleColumns.forEach((roleName) => {
        row[roleName] = assignedLabel(roleName, event, rules, allPlans);
      });
      return row;
    });

  downloadTablePdf({
    title: "דוח לפרסום פלור",
    subtitle: monthLabel,
    columns,
    rows,
    filename: `דוח לפרסום פלור - ${monthLabel}.pdf`,
    orientation: "l",
  });
}
