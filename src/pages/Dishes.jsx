import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Printer } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import DishesList from "../components/dishes/DishesList";
import DishDialog from "../components/dishes/DishDialog";
import CategoryDialog from "../components/dishes/CategoryDialog";

export default function Dishes() {
  const [showDishDialog, setShowDishDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("serving");
  const queryClient = useQueryClient();
  
  // Check URL params for edit mode
  const urlParams = new URLSearchParams(window.location.search);
  const editDishId = urlParams.get('edit');

  const { data: allDishes = [], isLoading } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: [],
  });

  // Filter dishes by event type and sort alphabetically
  const dishes = allDishes
    .filter(dish => dish.event_type === eventTypeFilter)
    .sort((a, b) => a.name?.localeCompare(b.name, 'he'));

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: [],
  });

  const { data: specialIngredients = [] } = useQuery({
    queryKey: ['specialIngredients'],
    queryFn: () => base44.entities.SpecialIngredient.list(),
    initialData: [],
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('display_order'),
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

  const { data: allSubCategories = [] } = useQuery({
    queryKey: ['subCategories'],
    queryFn: () => base44.entities.SubCategory.list('display_order'),
    initialData: [],
  });

  // Filter categories by event type
  const categories = allCategories.filter(cat => cat.event_type === eventTypeFilter);
  const subCategories = allSubCategories.filter(sc => sc.event_type === eventTypeFilter);

  // Auto-open edit dialog if edit param exists
  useEffect(() => {
    if (editDishId && allDishes.length > 0) {
      const dishToEdit = allDishes.find(d => d.id === editDishId);
      if (dishToEdit) {
        setEventTypeFilter(dishToEdit.event_type || 'serving');
        setSelectedDish(dishToEdit);
        setShowDishDialog(true);
      }
    }
  }, [editDishId, allDishes]);

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId) => base44.entities.Category.delete(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('הקטגוריה נמחקה');
    },
    onError: () => {
      toast.error('מחיקת הקטגוריה נכשלה');
    }
  });

  const filteredDishes = dishes.filter(dish => {
    const matchesSearch = dish.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || 
                           dish.categories?.includes(filterCategory);
    return matchesSearch && matchesCategory;
  });

  const handleCreateDish = () => {
    setSelectedDish(null);
    setShowDishDialog(true);
  };

  const handleEditDish = (dish) => {
    setSelectedDish(dish);
    setShowDishDialog(true);
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
    if (confirm(`למחוק קטגוריה "${categoryName}"? זה לא ימחק מנות, רק את הקטגוריה.`)) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  const handlePrint = () => {
    const eventTypeName = eventTypeFilter === 'serving' ? 'אירוע הגשה' : eventTypeFilter === 'wedding' ? 'אירוע הפוכה' : 'מסיבה';
    
    // Group dishes by category
    const dishesByCategory = categories.map(category => ({
      category,
      dishes: dishes.filter(dish => dish.categories?.includes(category.id))
    })).filter(group => group.dishes.length > 0);
    
    // Dishes without category
    const dishesWithoutCategory = dishes.filter(dish => 
      !dish.categories || dish.categories.length === 0
    );
    
    // Build print content
    let printHTML = `
      <html dir="rtl">
        <head>
          <title>מנות ותפריטים - ${eventTypeName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1c1917; margin-bottom: 10px; }
            h2 { color: #059669; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #059669; padding-bottom: 5px; font-size: 24px; font-weight: 900; text-decoration: underline; text-underline-offset: 6px; }
            .dish { margin-bottom: 15px; padding: 10px; border: 1px solid #e7e5e4; border-radius: 5px; }
            .dish-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .dish-cost { color: #059669; font-weight: bold; }
            .dish-description { color: #57534e; font-size: 14px; margin-top: 5px; }
            .date { color: #78716c; font-size: 14px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>מנות ותפריטים - ${eventTypeName}</h1>
          <div class="date">תאריך: ${new Date().toLocaleDateString('he-IL')}</div>
    `;
    
    dishesByCategory.forEach(({ category, dishes: categoryDishes }) => {
      printHTML += `<h2>${category.name}</h2>`;
      categoryDishes.forEach(dish => {
        printHTML += `
          <div class="dish">
            <div class="dish-name">${dish.name}</div>
            <div class="dish-cost">עלות: ₪${(dish.unit_cost || 0).toFixed(2)}</div>
            ${dish.description ? `<div class="dish-description">${dish.description}</div>` : ''}
          </div>
        `;
      });
    });
    
    if (dishesWithoutCategory.length > 0) {
      printHTML += `<h2>ללא קטגוריה</h2>`;
      dishesWithoutCategory.forEach(dish => {
        printHTML += `
          <div class="dish">
            <div class="dish-name">${dish.name}</div>
            <div class="dish-cost">עלות: ₪${(dish.unit_cost || 0).toFixed(2)}</div>
            ${dish.description ? `<div class="dish-description">${dish.description}</div>` : ''}
          </div>
        `;
      });
    }
    
    printHTML += `
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">מנות ותפריטים</h1>
          <p className="text-stone-500 mt-1">הגדרת מנות עם מנות, בזבוז וקטגוריות</p>
        </div>
        <div className="flex gap-2">
          <Tabs value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <TabsList>
              <TabsTrigger value="serving">אירוע הגשה</TabsTrigger>
              <TabsTrigger value="wedding">אירוע הפוכה</TabsTrigger>
              <TabsTrigger value="party">מסיבה</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button 
            variant="outline"
            onClick={handlePrint}
            className="print:hidden"
          >
            <Printer className="w-4 h-4 mr-2" />
            הדפסה
          </Button>
          <Button 
            onClick={handleCreateDish}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            מנה חדשה
          </Button>
        </div>
      </div>

      {categories.length > 0 && (
        <Card className="border-stone-200">
          <CardHeader className="border-b border-stone-200 p-4">
            <CardTitle className="text-sm font-medium">קטגוריות מנות</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCategory("all")}
                className={`px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  filterCategory === "all"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                }`}
              >
                הכל
              </button>
              {categories.map(category => (
                <div key={category.id} className="relative group">
                  <button
                    onClick={() => setFilterCategory(category.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleEditCategory(category);
                    }}
                    onDoubleClick={() => handleEditCategory(category)}
                    className={`px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${
                      filterCategory === category.id
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
          placeholder="חיפוש מנות..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <DishesList 
        dishes={filteredDishes}
        isLoading={isLoading}
        onEdit={handleEditDish}
        categories={categories}
        ingredients={ingredients}
        specialIngredients={specialIngredients}
      />

      {showDishDialog && (
        <DishDialog
          dish={selectedDish}
          eventType={eventTypeFilter}
          ingredients={ingredients}
          specialIngredients={specialIngredients}
          categories={categories}
          subCategories={subCategories}
          suppliers={suppliers}
          ingredientCategories={ingredientCategories}
          open={showDishDialog}
          onClose={() => setShowDishDialog(false)}
        />
      )}

      {showCategoryDialog && (
        <CategoryDialog
          category={selectedCategory}
          eventType={eventTypeFilter}
          open={showCategoryDialog}
          onClose={() => setShowCategoryDialog(false)}
        />
      )}
    </div>
  );
}