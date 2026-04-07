import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import InventoryTrackingList from "../components/inventory/InventoryTrackingList";
import MovementDialog from "../components/inventory/MovementDialog";
import IngredientEventNeedDialog from "../components/inventory/IngredientEventNeedDialog";

export default function Inventory() {
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showEventNeedDialog, setShowEventNeedDialog] = useState(false);
  const [eventNeeds, setEventNeeds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => base44.entities.Ingredient.list(),
    initialData: [],
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
    initialData: [],
  });

  const { data: eventsDishes = [] } = useQuery({
    queryKey: ['eventsDishes'],
    queryFn: () => base44.entities.Events_Dish.list(),
    initialData: [],
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ['dishes'],
    queryFn: () => base44.entities.Dish.list(),
    initialData: [],
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    initialData: [],
  });

  const { data: ingredientCategories = [] } = useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: () => base44.entities.Ingredient_Category.list('display_order'),
    initialData: []
  });

  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = ing.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || ing.ingredient_category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAdjustInventory = (ingredient) => {
    setSelectedIngredient(ingredient);
    setShowMovementDialog(true);
  };

  const handleShowEventNeeds = (ingredient, needs) => {
    setSelectedIngredient(ingredient);
    setEventNeeds(needs);
    setShowEventNeedDialog(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">מלאי</h1>
          <p className="text-stone-500 mt-1">מעקב כמויות והזמנות</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="חיפוש רכיבים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-500" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="סינון לפי קטגוריה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הקטגוריות</SelectItem>
              {ingredientCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <InventoryTrackingList 
        ingredients={filteredIngredients}
        events={events}
        eventsDishes={eventsDishes}
        dishes={dishes}
        purchaseOrders={purchaseOrders}
        isLoading={isLoading}
        onAdjust={handleAdjustInventory}
        onShowEventNeeds={handleShowEventNeeds}
      />

      {showMovementDialog && (
        <MovementDialog
          ingredient={selectedIngredient}
          open={showMovementDialog}
          onClose={() => setShowMovementDialog(false)}
        />
      )}

      {showEventNeedDialog && (
        <IngredientEventNeedDialog
          ingredient={selectedIngredient}
          eventNeeds={eventNeeds}
          systemUnit={selectedIngredient?.system_unit || selectedIngredient?.unit || ''}
          open={showEventNeedDialog}
          onClose={() => setShowEventNeedDialog(false)}
        />
      )}
    </div>
  );
}