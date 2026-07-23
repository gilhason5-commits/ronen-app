import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Printer, Send, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ManualPurchaseOrder() {
  const [supplierId, setSupplierId] = useState("");
  const [quantities, setQuantities] = useState({});

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ["ingredientCategories"],
    queryFn: () => base44.entities.Ingredient_Category.list(),
    initialData: [],
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ["supplierIngredients", supplierId],
    queryFn: () => base44.entities.Ingredient.filter({ current_supplier_id: supplierId }),
    enabled: !!supplierId,
    initialData: [],
  });

  const supplier = suppliers.find((s) => s.id === supplierId);

  const columns = useMemo(() => {
    if (ingredients.length === 0) return [];
    const byCategory = {};
    ingredients.forEach((ing) => {
      const key = ing.ingredient_category_id || "none";
      if (!byCategory[key]) {
        byCategory[key] = {
          id: key,
          name: ing.ingredient_category_name || "ללא קטגוריה",
          displayOrder: ingredientCategories.find((c) => c.id === ing.ingredient_category_id)?.display_order ?? 999,
          items: [],
        };
      }
      byCategory[key].items.push(ing);
    });
    return Object.values(byCategory)
      .map((col) => ({
        ...col,
        items: col.items.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "he")),
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "he"));
  }, [ingredients, ingredientCategories]);

  const setQty = (ingredientId, value) => {
    setQuantities((prev) => ({ ...prev, [ingredientId]: value }));
  };

  const buildItems = () =>
    ingredients
      .map((ing) => {
        const quantity = parseFloat(quantities[ing.id]) || 0;
        const unitPrice = ing.base_price || 0;
        return {
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          category_name: ing.ingredient_category_name || "",
          purchase_unit: ing.purchase_unit,
          unit: ing.system_unit || ing.unit || "",
          quantity,
          unit_price: unitPrice,
          line_total: quantity * unitPrice,
        };
      })
      .filter((item) => item.quantity > 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const items = buildItems();
      if (items.length === 0) {
        throw new Error("יש להזין כמות לפחות למוצר אחד לפני השמירה");
      }
      const total = items.reduce((sum, item) => sum + item.line_total, 0);
      return base44.entities.PurchaseOrder.create({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        supplier_type: supplier.supplier_type,
        order_date: format(new Date(), "yyyy-MM-dd"),
        items,
        subtotal: total,
        total,
        status: "pending",
      });
    },
    onSuccess: () => {
      toast.success("הזמנת הרכש נשמרה בהצלחה");
    },
    onError: (err) => {
      toast.error(err?.message || "שגיאה בשמירת ההזמנה");
    },
  });

  const handlePrint = () => {
    if (!supplier) return;
    const printWindow = window.open("", "_blank");
    const columnsHtml = columns
      .map(
        (col) => `
        <table>
          <thead>
            <tr><th colspan="2">${col.name}</th></tr>
            <tr><th>מוצר</th><th>כמות</th></tr>
          </thead>
          <tbody>
            ${col.items
              .map(
                (ing) => `
              <tr>
                <td>${ing.name}${ing.purchase_unit || ing.system_unit ? `<div class="unit">${ing.purchase_unit || ""} ${ing.system_unit || ing.unit || ""}</div>` : ""}</td>
                <td class="qty">${quantities[ing.id] || ""}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`
      )
      .join("");

    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>הזמנת רכש - ${supplier.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1c1917; }
          h1 { font-size: 20px; margin-bottom: 2px; }
          .meta { color: #78716c; font-size: 13px; margin-bottom: 16px; }
          .columns { display: flex; flex-wrap: wrap; gap: 16px; }
          table { border-collapse: collapse; width: 260px; font-size: 13px; }
          th { background: #f5f5f4; text-align: right; padding: 6px 8px; border: 1px solid #d6d3d1; }
          td { padding: 6px 8px; border: 1px solid #e7e5e4; }
          td.qty { text-align: center; width: 60px; }
          .unit { font-size: 11px; color: #a8a29e; }
          @media print { body { padding: 8px; } }
        </style>
      </head>
      <body>
        <h1>הזמנת רכש - ${supplier.name}</h1>
        <div class="meta">תאריך: ${format(new Date(), "dd/MM/yyyy")}</div>
        <div class="columns">${columnsHtml}</div>
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

  if (!supplierId) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">בחר ספק להזמנת רכש ידנית</h2>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="בחר ספק..." />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSupplierId("");
            setQuantities({});
          }}
        >
          ← בחר ספק אחר
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 ml-1" />
            הדפסה
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Send className="w-4 h-4 ml-1" />
            שמור הזמנה
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-bold text-stone-900 mb-1">{supplier?.name}</h2>
          <p className="text-sm text-stone-500 mb-4">{format(new Date(), "dd/MM/yyyy")}</p>

          {ingredients.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p>לספק זה אין מוצרים רשומים במערכת</p>
              <p className="text-xs mt-1">ניתן לקשר מוצרים לספק בעמוד רכיבים</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="min-w-[240px] max-w-[280px] flex-shrink-0 border border-stone-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-stone-100 px-3 py-2 border-b border-stone-200">
                    <h3 className="font-bold text-stone-800 text-sm">{col.name}</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500">
                        <th className="text-right px-3 py-1.5 font-medium">מוצר</th>
                        <th className="text-center px-2 py-1.5 font-medium w-20">כמות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {col.items.map((ing) => (
                        <tr key={ing.id} className="border-t border-stone-100">
                          <td className="px-3 py-1.5">
                            {ing.name}
                            {(ing.purchase_unit || ing.system_unit || ing.unit) && (
                              <span className="block text-[11px] text-stone-400">
                                {ing.purchase_unit ? `${ing.purchase_unit} ` : ""}
                                {ing.system_unit || ing.unit || ""}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={quantities[ing.id] || ""}
                              onChange={(e) => setQty(ing.id, e.target.value)}
                              className="h-8 text-center"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
