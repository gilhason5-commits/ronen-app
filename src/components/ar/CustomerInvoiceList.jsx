import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function CustomerInvoiceList({ invoices, isLoading, onEdit }) {
  const statusColors = {
    draft: "bg-stone-100 text-stone-700",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-stone-100 text-stone-700"
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Receipt className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">No invoices found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <Card 
          key={invoice.id}
          className="border-stone-200 hover:shadow-md transition-shadow"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-stone-900">
                    {invoice.customer_name || 'Customer'}
                  </h3>
                  <Badge className={statusColors[invoice.status]}>
                    {invoice.status}
                  </Badge>
                </div>
                {invoice.event_name && (
                  <p className="text-sm text-stone-600">Event: {invoice.event_name}</p>
                )}
                {invoice.invoice_number && (
                  <p className="text-xs text-stone-500">Invoice #{invoice.invoice_number}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-stone-600">
                  {invoice.due_date && (
                    <span>
                      Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-stone-500">Total</p>
                  <p className="font-semibold text-stone-900">
                    ${(invoice.total || 0).toFixed(2)}
                  </p>
                </div>
                {invoice.balance !== undefined && invoice.balance !== invoice.total && (
                  <div>
                    <p className="text-xs text-stone-500">Balance</p>
                    <p className="font-semibold text-orange-600">
                      ${(invoice.balance || 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(invoice)}
              >
                <Edit className="w-4 h-4 mr-2" />
                View/Edit
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}