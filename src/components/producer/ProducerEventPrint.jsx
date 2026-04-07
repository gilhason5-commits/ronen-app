import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const eventTypeLabels = {
  serving: "אירוע הגשה",
  wedding: "אירוע הפוכה",
  party: "מסיבה"
};

export default function ProducerEventPrint({ event, open, onClose, savePdfMode = false }) {
  const printRef = useRef(null);
  const [savingPdf, setSavingPdf] = useState(false);

  const { data: eventDishes = [] } = useQuery({
    queryKey: ["event_dishes_print", event?.id],
    queryFn: () => base44.entities.Events_Dish.filter({ event_id: event.id }),
    enabled: !!event?.id && open,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: dishNotes = [] } = useQuery({
    queryKey: ["all_dish_notes", event?.id],
    queryFn: () => base44.entities.EventDishNote.filter({ event_id: event.id }),
    enabled: !!event?.id && open,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories_print"],
    queryFn: () => base44.entities.Category.list("display_order"),
    enabled: open,
    initialData: [],
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ["dishes_print"],
    queryFn: () => base44.entities.Dish.list(),
    enabled: open,
    initialData: [],
  });

  const { data: subCategories = [] } = useQuery({
    queryKey: ["subCategories_print"],
    queryFn: () => base44.entities.SubCategory.list("display_order"),
    enabled: open,
    initialData: [],
  });

  const dishesByCategory = categories
    .filter(cat => eventDishes.some(ed => ed.category_id === cat.id))
    .map(cat => {
      const catDishes = eventDishes.filter(ed => ed.category_id === cat.id);
      // Enrich with sub_category_id from Dish entity
      const enriched = catDishes.map(ed => {
        const dish = dishes.find(d => d.id === ed.dish_id);
        return { ...ed, sub_category_id: dish?.sub_category_id };
      });
      // Group by sub-category NAME (not ID) to merge duplicates like Raw Bar
      const subGroups = [];
      const subNameMap = {};
      for (const d of enriched) {
        const sub = d.sub_category_id ? subCategories.find(sc => sc.id === d.sub_category_id) : null;
        const name = sub?.name || "";
        const order = sub?.display_order ?? 999;
        if (!subNameMap[name]) {
          subNameMap[name] = { subName: name, order, dishes: [] };
        }
        subNameMap[name].dishes.push(d);
        if (order < subNameMap[name].order) subNameMap[name].order = order;
      }
      const sorted = Object.values(subNameMap).sort((a, b) => a.order - b.order);
      for (const group of sorted) {
        subGroups.push({ subName: group.subName, dishes: group.dishes });
      }
      return { category: cat, subGroups };
    });

  const uncategorized = eventDishes.filter(ed => !categories.some(c => c.id === ed.category_id));

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>סיכום אירוע - ${event.event_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #1c1917; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #10b981; padding-bottom: 4px; color: #065f46; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 16px 0; font-size: 14px; }
          .info-label { color: #78716c; }
          .info-value { font-weight: 600; }
          .notes { background: #f5f5f4; padding: 12px; border-radius: 8px; margin: 12px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
          th { background: #f5f5f4; text-align: right; padding: 8px 12px; border: 1px solid #d6d3d1; }
          td { padding: 8px 12px; border: 1px solid #e7e5e4; }
          .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #a8a29e; border-top: 1px solid #e7e5e4; padding-top: 12px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>${content.innerHTML}
        <div class="footer">הודפס בתאריך ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleSavePdf = async () => {
    const content = printRef.current;
    if (!content) return;
    setSavingPdf(true);
    
    // Create a temporary container for rendering
    const clone = content.cloneNode(true);
    clone.style.position = "absolute";
    clone.style.left = "-9999px";
    clone.style.top = "0";
    clone.style.width = "794px"; // A4 width at 96dpi
    clone.style.padding = "30px";
    clone.style.background = "white";
    clone.style.direction = "rtl";
    clone.style.fontFamily = "Arial, sans-serif";
    clone.style.color = "#1c1917";
    document.body.appendChild(clone);

    const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    document.body.removeChild(clone);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let yOffset = 10;
    let remainingHeight = imgHeight;
    const pageContentHeight = pdfHeight - 20;

    // First page
    pdf.addImage(imgData, "PNG", 10, yOffset, imgWidth, imgHeight);
    remainingHeight -= pageContentHeight;

    // Additional pages if content is tall
    while (remainingHeight > 0) {
      pdf.addPage();
      yOffset = -(imgHeight - remainingHeight) + 10;
      pdf.addImage(imgData, "PNG", 10, yOffset, imgWidth, imgHeight);
      remainingHeight -= pageContentHeight;
    }

    pdf.save(`${event.event_name || "אירוע"}.pdf`);
    setSavingPdf(false);
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{savePdfMode ? "שמירת PDF" : "סיכום אירוע להדפסה"}</DialogTitle>
            <div className="flex gap-2">
              {savePdfMode ? (
                <Button onClick={handleSavePdf} disabled={savingPdf} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingPdf ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Download className="w-4 h-4 ml-2" />}
                  {savingPdf ? "מייצר PDF..." : "שמור כ-PDF"}
                </Button>
              ) : (
                <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700">
                  <Printer className="w-4 h-4 ml-2" />
                  הדפס
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div ref={printRef}>
          <h1>{event.event_name}</h1>
          <div className="info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", margin: "16px 0", fontSize: "14px" }}>
            <div>
              <span style={{ color: "#78716c" }}>תאריך: </span>
              <strong>{event.event_date ? format(new Date(event.event_date), "dd/MM/yyyy") : "-"}</strong>
            </div>
            <div>
              <span style={{ color: "#78716c" }}>שעה: </span>
              <strong>{event.event_time || "-"}</strong>
            </div>
            <div>
              <span style={{ color: "#78716c" }}>סוג אירוע: </span>
              <strong>{eventTypeLabels[event.event_type] || event.event_type}</strong>
            </div>
            <div>
              <span style={{ color: "#78716c" }}>מספר סועדים: </span>
              <strong>{event.guest_count || 0}</strong>
            </div>
            {event.price_per_plate > 0 && (
              <div>
                <span style={{ color: "#78716c" }}>מחיר לצלחת: </span>
                <strong>₪{event.price_per_plate}</strong>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "24px", margin: "16px 0", direction: "rtl" }}>
            {(event.children_count > 0 || event.vegan_count > 0 || event.glatt_count > 0) && (
              <div style={{ marginRight: "auto", marginLeft: "0" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "6px", color: "#065f46" }}>מיוחדים</h3>
                <table style={{ borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "#f5f5f4", textAlign: "right", padding: "4px 10px", border: "1px solid #d6d3d1" }}>סוג</th>
                      <th style={{ background: "#f5f5f4", textAlign: "center", padding: "4px 10px", border: "1px solid #d6d3d1" }}>כמות</th>
                      <th style={{ background: "#f5f5f4", textAlign: "right", padding: "4px 10px", border: "1px solid #d6d3d1" }}>הערה</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4" }}>ילדים</td>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4", textAlign: "center" }}>{event.children_count || 0}</td>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4", color: "#a8a29e" }}>-</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4" }}>טבעונים</td>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4", textAlign: "center" }}>{event.vegan_count || 0}</td>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4", color: "#a8a29e" }}>-</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4" }}>גלאט</td>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4", textAlign: "center" }}>{event.glatt_count || 0}</td>
                      <td style={{ padding: "4px 10px", border: "1px solid #e7e5e4", color: event.kashrut_note ? "#92400e" : "#a8a29e" }}>{event.kashrut_note || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {event.notes && (
            <div style={{ background: "#f5f5f4", padding: "12px", borderRadius: "8px", margin: "12px 0", fontSize: "14px" }}>
              <strong>הערות: </strong>{event.notes}
            </div>
          )}

          <h2 style={{ fontSize: "18px", marginTop: "24px", borderBottom: "2px solid #10b981", paddingBottom: "4px", color: "#065f46" }}>
            מנות ({eventDishes.length})
          </h2>

          {dishesByCategory.length === 0 && uncategorized.length === 0 ? (
            <p style={{ color: "#78716c", fontSize: "14px" }}>לא נבחרו מנות לאירוע זה</p>
          ) : (
            <>
              {dishesByCategory.map(({ category, subGroups }) => (
                <div key={category.id} style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: "bold", margin: "12px 0 6px", color: "#44403c" }}>{category.name}</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr>
                        <th style={{ background: "#f5f5f4", textAlign: "right", padding: "8px 12px", border: "1px solid #d6d3d1" }}>מנה</th>
                        <th style={{ background: "#f5f5f4", textAlign: "right", padding: "8px 12px", border: "1px solid #d6d3d1" }}>הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subGroups.map((group, gi) => (
                        <React.Fragment key={gi}>
                          {group.subName && (
                            <tr>
                              <td colSpan={2} style={{ background: "#e7e5e4", padding: "4px 12px", fontWeight: "600", fontSize: "13px", color: "#57534e" }}>
                                {group.subName}
                              </td>
                            </tr>
                          )}
                          {group.dishes.map(d => {
                            const noteRec = dishNotes.find(n => n.event_dish_id === d.id);
                            const noteText = noteRec?.note || "";
                            return (
                              <tr key={d.id}>
                                <td style={{ padding: "8px 12px", border: "1px solid #e7e5e4" }}>{d.dish_name}</td>
                                <td style={{ padding: "8px 12px", border: "1px solid #e7e5e4", fontSize: "13px", color: noteText ? "#92400e" : "#a8a29e" }}>{noteText || "-"}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: "bold", margin: "12px 0 6px", color: "#44403c" }}>אחר</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr>
                        <th style={{ background: "#f5f5f4", textAlign: "right", padding: "8px 12px", border: "1px solid #d6d3d1" }}>מנה</th>
                        <th style={{ background: "#f5f5f4", textAlign: "right", padding: "8px 12px", border: "1px solid #d6d3d1" }}>הערות</th>
                        </tr>
                        </thead>
                        <tbody>
                        {uncategorized.map(d => {
                        const noteRec = dishNotes.find(n => n.event_dish_id === d.id);
                        const noteText = noteRec?.note || "";
                        return (
                          <tr key={d.id}>
                           <td style={{ padding: "8px 12px", border: "1px solid #e7e5e4" }}>{d.dish_name}</td>
                           <td style={{ padding: "8px 12px", border: "1px solid #e7e5e4", fontSize: "13px", color: noteText ? "#92400e" : "#a8a29e" }}>{noteText || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}