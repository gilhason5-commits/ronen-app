import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";

export default function IngredientEventNeedDialog({ ingredient, eventNeeds = [], systemUnit, open, onClose }) {
  if (!ingredient) {
    return null;
  }

  const totalNeeded = eventNeeds.reduce((sum, need) => sum + need.needed_qty, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            צורך ברכיב: {ingredient.name}
          </DialogTitle>
          <DialogDescription>
            פירוט הצורך ברכיב עבור אירועים עתידיים השבוע.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {eventNeeds.length === 0 ? (
            <p className="text-center text-stone-500">אין צורך ברכיב זה לאירועים קרובים.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>אירוע</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead className="text-right">כמות נדרשת</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventNeeds.map((need, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{need.event_name}</TableCell>
                      <TableCell>{format(new Date(need.event_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {need.needed_qty.toFixed(2)} {systemUnit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-900">סה"כ נדרש:</span>
                  <span className="text-xl font-bold text-emerald-700">
                    {totalNeeded.toFixed(2)} {systemUnit}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}