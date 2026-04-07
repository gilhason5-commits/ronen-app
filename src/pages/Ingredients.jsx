import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import IngredientsDataList from "../components/inventory/IngredientsDataList";
import IngredientDialog from "../components/inventory/IngredientDialog";
import IngredientCategoryDialog from "../components/inventory/IngredientCategoryDialog";


export default function Ingredients() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Check URL params for edit mode and return to dish
  const urlParams = new URLSearchParams(window.location.search);
  const editIngredientId = urlParams.get('edit');
  const returnToDishId = urlParams.get('returnToDish');
  
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => {
      const data = await base44.entities.Ingredient.list();
      return data.sort((a, b) => a.name?.localeCompare(b.name, 'he'));
    },
    initialData: [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: () => base44.entities.Ingredient_Category.list('display_order'),
    initialData: [],
  });

  // Auto-open edit dialog if edit param exists
  useEffect(() => {
    if (editIngredientId && ingredients.length > 0) {
      const ingredientToEdit = ingredients.find(i => i.id === editIngredientId);
      if (ingredientToEdit) {
        setSelectedIngredient(ingredientToEdit);
        setShowDialog(true);
      }
    }
  }, [editIngredientId, ingredients]);

  const deleteIngredientMutation = useMutation({
    mutationFn: (ingredientId) => base44.entities.Ingredient.delete(ingredientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success('הרכיב נמחק');
    },
    onError: () => {
      toast.error('מחיקת הרכיב נכשלה');
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId) => base44.entities.Ingredient_Category.delete(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredientCategories'] });
      toast.success('הקטגוריה נמחקה');
    },
    onError: () => {
      toast.error('מחיקת הקטגוריה נכשלה');
    }
  });

  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = ing.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || 
                           ing.ingredient_category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });



  const handleCreate = () => {
    setSelectedIngredient(null);
    setShowDialog(true);
  };

  const handleEdit = (ingredient) => {
    setSelectedIngredient(ingredient);
    setShowDialog(true);
  };

  const handleDelete = (ingredient) => {
    if (window.confirm(`למחוק את ${ingredient.name}? פעולה זו אינה ניתנת לביטול.`)) {
      deleteIngredientMutation.mutate(ingredient.id);
    }
  };

  const handleCreateCategory = () => {
    setSelectedCategory(null);
    setShowCategoryDialog(true);
  };

  const handleEditCategory = (category) => {
    setSelectedCategory(category);
    setShowCategoryDialog(true);
  };

  const handleDeleteCategory = (categoryId, categoryName) => {
    if (confirm(`למחוק קטגוריה "${categoryName}"? זה לא ימחק רכיבים, רק את הקטגוריה.`)) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };



  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          {returnToDishId && (
            <Link 
              to={createPageUrl(`Dishes?edit=${returnToDishId}`)}
              className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg mb-3 text-sm font-semibold border border-emerald-300 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              חזור לעריכת מנה
            </Link>
          )}
          <h1 className="text-3xl font-bold text-stone-900">רכיבים</h1>
          <p className="text-stone-500 mt-1">ניהול מאגר רכיבים ומחירים</p>
        </div>
        <Button 
          onClick={handleCreate}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          רכיב חדש
        </Button>
      </div>

      {ingredientCategories.length > 0 && (
        <Card className="border-stone-200">
          <CardHeader className="border-b border-stone-200 p-4">
            <CardTitle className="text-sm font-medium">קטגוריות רכיבים</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  categoryFilter === "all"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                }`}
              >
                הכל
              </button>
              {ingredientCategories.map(category => (
                <div key={category.id} className="relative group">
                  <button
                    onClick={() => setCategoryFilter(category.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleEditCategory(category);
                    }}
                    onDoubleClick={() => handleEditCategory(category)}
                    className={`px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${
                      categoryFilter === category.id
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    {category.name}
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateCategory}
              >
                <Plus className="w-3 h-3 mr-2" />
                קטגוריה חדשה
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input
          placeholder="חיפוש רכיבים..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <IngredientsDataList 
        ingredients={filteredIngredients}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showDialog && (
        <IngredientDialog
          ingredient={selectedIngredient}
          suppliers={suppliers}
          ingredientCategories={ingredientCategories}
          open={showDialog}
          onClose={() => setShowDialog(false)}
        />
      )}

      {showCategoryDialog && (
        <IngredientCategoryDialog
          category={selectedCategory}
          open={showCategoryDialog}
          onClose={() => setShowCategoryDialog(false)}
        />
      )}
    </div>
  );
}