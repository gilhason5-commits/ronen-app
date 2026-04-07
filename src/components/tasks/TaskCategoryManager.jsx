import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import TaskCategoryDialog from "./TaskCategoryDialog";
import { toast } from "sonner";

export default function TaskCategoryManager({ categoryType }) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['taskCategories', categoryType],
    queryFn: async () => {
      const data = await base44.entities.TaskCategory.list();
      return data.filter(c => c.category_type === categoryType);
    },
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskCategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskCategories'] });
      toast.success('קטגוריה נמחקה');
    },
  });

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setShowDialog(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('האם למחוק קטגוריה זו?')) {
      deleteMutation.mutate(id);
    }
  };

  const departmentColors = {
    "שירות": "bg-blue-100 text-blue-700",
    "בר": "bg-purple-100 text-purple-700",
    "מטבח": "bg-orange-100 text-orange-700",
    "כספים": "bg-emerald-100 text-emerald-700",
    "הנהלה": "bg-red-100 text-red-700",
    "אחר": "bg-stone-100 text-stone-700"
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">קטגוריות משימות</h3>
        <Button onClick={() => setShowDialog(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          קטגוריה חדשה
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-stone-900">{category.name}</h4>
                  <div className="flex gap-2 mt-2">
                    <Badge className={departmentColors[category.department]}>
                      {category.department}
                    </Badge>
                    <Badge className={category.is_active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-700"}>
                      {category.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(category)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  ערוך
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(category.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  מחק
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-stone-500">אין קטגוריות. צור קטגוריה ראשונה</p>
          </CardContent>
        </Card>
      )}

      <TaskCategoryDialog
        category={selectedCategory}
        categoryType={categoryType}
        open={showDialog}
        onClose={handleClose}
      />
    </div>
  );
}