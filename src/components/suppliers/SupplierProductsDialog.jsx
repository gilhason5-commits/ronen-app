import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package, Printer } from "lucide-react";
import { format } from "date-fns";

export default function SupplierProductsDialog({ supplier, open, onClose }) {
  const { data: ingredients = [] } = useQuery({
    queryKey: ['supplier-ingredients', supplier?.id],
    queryFn: () => supplier?.id 
      ? base44.entities.Ingredient.filter({ current_supplier_id: supplier.id })
      : Promise.resolve([]),
    enabled: !!supplier?.id && open
  });

  const handlePrint = () => {
    const printContent = document.getElementById('supplier-products-print');
    const originalContent = document.body.innerHTML;
    
    if (printContent) {
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              מוצרים של {supplier?.name}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="w-4 h-4 mr-2" />
              הדפסה
            </Button>
          </div>
        </DialogHeader>

        <div id="supplier-products-print">
          <div className="mb-4 print:block">
            <h2 className="text-xl font-bold">מוצרים של {supplier?.name}</h2>
            <p className="text-sm text-stone-500">תאריך: {format(new Date(), 'dd/MM/yyyy')}</p>
          </div>

        {ingredients.length === 0 ? (
          <div className="p-8 text-center text-stone-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-stone-300" />
            <p>אין מוצרים רשומים לספק זה</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם המוצר</TableHead>
                  <TableHead className="text-center">כמות ליחידת רכישה</TableHead>
                  <TableHead className="text-center">יחידת מערכת</TableHead>
                  <TableHead className="text-right">מחיר רכישה</TableHead>
                  <TableHead className="text-right">מחיר ליחידה</TableHead>
                  <TableHead className="text-center">תאריך עדכון</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient) => (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">{ingredient.name}</TableCell>
                    <TableCell className="text-center">
                      {ingredient.purchase_unit}
                    </TableCell>
                    <TableCell className="text-center">
                      {ingredient.system_unit}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ₪{ingredient.base_price?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 font-semibold">
                      ₪{ingredient.price_per_system?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-stone-500">
                      {ingredient.last_price_update 
                        ? format(new Date(ingredient.last_price_update), 'dd/MM/yyyy')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 p-4 bg-stone-50 rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone-600">סה"כ מוצרים:</span>
            <span className="font-semibold">{ingredients.length}</span>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}