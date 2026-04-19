import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function MovementDialog({ ingredient, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    type: 'adjust',
    qty: 0,
    notes: ''
  });

  const moveMutation = useMutation({
    mutationFn: async (data) => {
      const movement = {
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.name,
        type: data.type,
        qty: data.type === 'consume' ? -Math.abs(data.qty) : Math.abs(data.qty),
        unit: ingredient.unit,
        unit_cost: ingredient.price_per_unit || 0,
        total_cost: (ingredient.price_per_unit || 0) * Math.abs(data.qty),
        notes: data.notes,
        movement_date: new Date().toISOString().split('T')[0],
        source_type: 'Manual Adjustment'
      };

      await base44.entities.InventoryMovement.create(movement);

      const newQty = ingredient.on_hand_qty + movement.qty;
      await base44.entities.Ingredient.update(ingredient.id, {
        on_hand_qty: newQty
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success('המלאי הותאם בהצלחה');
      onClose();
    },
    onError: () => {
      toast.error('התאמת המלאי נכשלה');
    }
  });

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    moveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>התאמת מלאי - {ingredient?.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-stone-50 p-4 rounded-lg">
            <p className="text-sm text-stone-600">מלאי נוכחי</p>
            <p className="text-2xl font-bold text-stone-900">
              {ingredient?.on_hand_qty} {ingredient?.unit}
            </p>
          </div>

          <div>
            <Label>סוג תנועה</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({...formData, type: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receive">קבלה (הוספת מלאי)</SelectItem>
                <SelectItem value="consume">צריכה (שימוש במלאי)</SelectItem>
                <SelectItem value="adjust">התאמה (הגדרת כמות חדשה)</SelectItem>
                <SelectItem value="waste">בזבוז/אובדן</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>כמות</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={formData.qty || ''}
              onChange={(e) => setFormData({...formData, qty: parseFloat(e.target.value) || 0})}
              placeholder="0"
              required
            />
            <p className="text-xs text-stone-500 mt-1">
              {formData.type === 'adjust' ? 'כמות כוללת חדשה' : 
               formData.type === 'consume' || formData.type === 'waste' ? 'כמות לחיסור' : 
               'כמות להוספה'}
            </p>
          </div>

          <div>
            <Label>הערות</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={2}
              placeholder="סיבה להתאמה..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              ביצוע התאמה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}