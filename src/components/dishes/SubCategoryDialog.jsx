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

export default function SubCategoryDialog({ subCategory, categoryId, eventType = 'serving', open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0,
    event_type: eventType,
    category_id: categoryId,
  });

  useEffect(() => {
    if (subCategory) {
      setFormData(subCategory);
    } else {
      setFormData({
        name: '',
        description: '',
        display_order: 0,
        event_type: eventType,
        category_id: categoryId,
      });
    }
  }, [subCategory, categoryId, eventType]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (subCategory?.id) {
        return base44.entities.SubCategory.update(subCategory.id, data);
      } else {
        return base44.entities.SubCategory.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subCategories'] });
      toast.success(subCategory ? 'תת הקטגוריה עודכנה' : 'תת הקטגוריה נוצרה');
      onClose();
    },
    onError: () => {
      toast.error('שמירת תת הקטגוריה נכשלה');
    }
  });

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{subCategory ? 'עריכת תת קטגוריה' : 'תת קטגוריה חדשה'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>שם תת קטגוריה *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>תיאור</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div>
            <Label>סדר תצוגה</Label>
            <Input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              {subCategory ? 'עדכון' : 'יצירת'} תת קטגוריה
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
