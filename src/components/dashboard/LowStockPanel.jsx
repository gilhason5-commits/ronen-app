import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function LowStockPanel({ items }) {
  return (
    <Card className="border-stone-200">
      <CardHeader className="border-b border-stone-200 p-5">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <CardTitle className="text-lg">התראות מלאי נמוך</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-10 h-10 text-green-300 mx-auto mb-2" />
            <p className="text-sm text-stone-500">כל הפריטים במלאי מספיק</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100"
              >
                <div className="flex-1">
                  <p className="font-medium text-stone-900 text-sm">{item.name}</p>
                  <p className="text-xs text-stone-500">
                    נותר {item.on_hand_qty} {item.unit} • מינימום: {item.min_qty}
                  </p>
                </div>
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
            ))}
            {items.length > 5 && (
              <p className="text-xs text-stone-500 text-center pt-2">
                +{items.length - 5} פריטים נוספים
              </p>
            )}
            <Link to={createPageUrl("Inventory")}>
              <Button variant="outline" size="sm" className="w-full mt-2">
                מעבר למלאי
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}