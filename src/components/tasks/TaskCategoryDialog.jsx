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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function TaskCategoryDialog({ category, categoryType, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    category_type: categoryType,
    department: 'שירות',
    is_active: true
  });

  useEffect(() => {
    if (category) {
      setFormData(category);
    } else {
      setFormData({
        name: '',
        category_type: categoryType,
        department: 'שירות',
        is_active: true
      });
    }
  }, [category, categoryType]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (category?.id) {
        return base44.entities.TaskCategory.update(category.id, data);
      }
      return base44.entities.TaskCategory.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskCategories'] });
      toast.success(category ? 'קטגוריה עודכנה' : 'קטגוריה נוצרה');
      onClose();
    },
    onError: (error) => {
      console.error('TaskCategory save error:', error);
      toast.error('שמירת קטגוריה נכשלה: ' + (error?.message || 'שגיאה'));
    },
  });

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>שם הקטגוריה *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div>
            <Label>מחלקה *</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => setFormData({...formData, department: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="שירות">שירות</SelectItem>
                <SelectItem value="בר">בר</SelectItem>
                <SelectItem value="מטבח">מטבח</SelectItem>
                <SelectItem value="כספים">כספים</SelectItem>
                <SelectItem value="הנהלה">הנהלה</SelectItem>
                <SelectItem value="פטי וור">פטי וור</SelectItem>
                <SelectItem value="אחר">אחר</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
            />
            <Label>קטגוריה פעילה</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              {category ? 'עדכון' : 'יצירה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}