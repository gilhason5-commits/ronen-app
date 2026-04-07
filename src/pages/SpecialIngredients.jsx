import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Search, ArrowRight } from "lucide-react";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SpecialIngredientDialog from '../components/ingredients/SpecialIngredientDialog';
import SpecialIngredientsList from '../components/ingredients/SpecialIngredientsList';

export default function SpecialIngredientsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Check URL params for edit mode and return to dish
  const urlParams = new URLSearchParams(window.location.search);
  const editIngredientId = urlParams.get('edit');
  const returnToDishId = urlParams.get('returnToDish');

  const { data: specialIngredients = [] } = useQuery({
    queryKey: ['specialIngredients'],
    queryFn: async () => {
      const data = await base44.entities.SpecialIngredient.list();
      return data.sort((a, b) => a.name?.localeCompare(b.name, 'he'));
    },
    initialData: [],
  });

  const filteredIngredients = specialIngredients.filter(ing =>
    ing.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Auto-open edit dialog if edit param exists
  useEffect(() => {
    if (editIngredientId && specialIngredients.length > 0) {
      const ingredientToEdit = specialIngredients.find(i => i.id === editIngredientId);
      if (ingredientToEdit) {
        setSelectedIngredient(ingredientToEdit);
        setDialogOpen(true);
      }
    }
  }, [editIngredientId, specialIngredients]);

  const handleEdit = (ingredient) => {
    setSelectedIngredient(ingredient);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedIngredient(null);
  };

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col gap-3">
            {returnToDishId ? (
              <Link 
                to={createPageUrl(`Dishes?edit=${returnToDishId}`)}
                className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg text-sm font-semibold border border-emerald-300 transition-colors w-fit"
              >
                <ArrowRight className="w-5 h-5" />
                חזור לעריכת מנה
              </Link>
            ) : (
              <Link to={createPageUrl('Ingredients')}>
                <Button variant="ghost" size="sm">
                  <ArrowRight className="w-4 h-4 ml-2" />
                  חזרה לרכיבים
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-2xl font-bold text-stone-900">תת מנות</h1>
              <p className="text-stone-500 mt-1">רכיבים המורכבים מרכיבים אחרים</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedIngredient(null);
              setDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 ml-2" />
            תת מנה חדשה
          </Button>
        </div>

        <Card className="border-stone-200 mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="חפש תת מנה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>

        <SpecialIngredientsList
          ingredients={filteredIngredients}
          onEdit={handleEdit}
        />

        <SpecialIngredientDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          ingredient={selectedIngredient}
        />
      </div>
    </div>
  );
}