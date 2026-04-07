import React, { useState, useEffect } from 'react';
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
import { toast } from "sonner";

export default function CategoryDialog({ category, eventType = 'serving', open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0,
    event_type: eventType
  });

  useEffect(() => {
    if (category) {
      setFormData(category);
    } else {
      setFormData({
        name: '',
        description: '',
        display_order: 0,
        event_type: eventType
      });
    }
  }, [category, eventType]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (category?.id) {
        return base44.entities.Category.update(category.id, data);
      } else {
        return base44.entities.Category.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(category ? 'הקטגוריה עודכנה' : 'הקטגוריה נוצרה');
      onClose();
    },
    onError: () => {
      toast.error('שמירת הקטגוריה נכשלה');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>שם קטגוריה *</Label>
            <Input
              placeholder="e.g., Appetizers - Waiters"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div>
            <Label>תיאור</Label>
            <Textarea
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label>סדר תצוגה</Label>
            <Input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value) || 0})}
            />
            <p className="text-xs text-stone-500 mt-1">Lower numbers appear first</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              {category ? 'עדכון' : 'יצירת'} קטגוריה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}