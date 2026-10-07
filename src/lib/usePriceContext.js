import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { makeCostContext } from "@/lib/ingredientTerms";

export const INGREDIENT_CHANGES_QUERY = {
  queryKey: ["ingredient-price-changes"],
  queryFn: () => base44.entities.Ingredient_Price_History.list("effective_from"),
};

// Everything needed to price a dish / ingredient on a given date (see
// ingredientTerms.js). null until loaded — callers fall back to the stored
// unit_cost / current ingredient price meanwhile.
export function usePriceContext() {
  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => base44.entities.Ingredient.list(),
  });
  const { data: specialIngredients } = useQuery({
    queryKey: ["specialIngredients"],
    queryFn: () => base44.entities.SpecialIngredient.list(),
  });
  const { data: changes } = useQuery(INGREDIENT_CHANGES_QUERY);

  return useMemo(() => {
    if (!ingredients || !specialIngredients || !changes) return null;
    return makeCostContext({ ingredients, specialIngredients, changes });
  }, [ingredients, specialIngredients, changes]);
}
