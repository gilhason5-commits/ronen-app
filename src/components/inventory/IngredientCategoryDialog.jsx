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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function IngredientCategoryDialog({ category, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0
  });

  useEffect(() => {
    if (category) {
      setFormData(category);
    } else {
      setFormData({
        name: '',
        description: '',
        display_order: 0
      });
    }
  }, [category]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (category?.id) {
        return await base44.entities.Ingredient_Category.update(category.id, data);
      } else {
        return await base44.entities.Ingredient_Category.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredientCategories'] });
      toast.success(category ? 'הקטגוריה עודכנה' : 'הקטגוריה נוצרה');
      onClose();
    },
    onError: () => {
      toast.error('שמירת הקטגוריה נכשלה');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Ingredient_Category.delete(category.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredientCategories'] });
      toast.success('הקטגוריה נמחקה');
      onClose();
    },
    onError: () => {
      toast.error('מחיקת הקטגוריה נכשלה');
    }
  });

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו?')) {
      deleteMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>שם הקטגוריה *</Label>
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

          <DialogFooter className={category?.id ? "sm:justify-between" : ""}>
            {category?.id && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                מחיקה
              </Button>
            )}
            <div className="flex gap-2 justify-end w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                ביטול
              </Button>
              <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
                {category ? 'עדכון' : 'יצירה'}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}