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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function DepartmentDialog({ department, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    if (department) {
      setFormData(department);
    } else {
      setFormData({
        name: '',
        description: '',
        is_active: true,
        display_order: 0
      });
    }
  }, [department]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (department?.id) {
        return base44.entities.Department.update(department.id, data);
      }
      return base44.entities.Department.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(department ? 'מחלקה עודכנה' : 'מחלקה נוצרה');
      onClose();
    },
    onError: (error) => {
      console.error('Department save error:', error);
      toast.error('שמירת מחלקה נכשלה: ' + (error?.message || 'שגיאה'));
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
          <DialogTitle>{department ? 'עריכת מחלקה' : 'מחלקה חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>שם המחלקה *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div>
            <Label>תיאור</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={2}
            />
          </div>

          <div>
            <Label>סדר תצוגה</Label>
            <Input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value) || 0})}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
            />
            <Label>מחלקה פעילה</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              {department ? 'עדכון' : 'יצירה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}