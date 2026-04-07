import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all dishes
    const dishes = await base44.asServiceRole.entities.Dish.list();
    
    // Get all ingredients
    const ingredients = await base44.asServiceRole.entities.Ingredient.list();
    const ingredientsMap = {};
    ingredients.forEach(ing => {
      ingredientsMap[ing.id] = ing;
    });

    // Get all special ingredients
    const specialIngredients = await base44.asServiceRole.entities.SpecialIngredient.list();
    const specialIngredientsMap = {};
    specialIngredients.forEach(ing => {
      specialIngredientsMap[ing.id] = ing;
    });

    let updatedCount = 0;
    const updates = [];

    for (const dish of dishes) {
      const dishIngredients = dish.ingredients || [];
      
      // Calculate total mass from ingredients (in grams)
      let totalMassGrams = 0;
      
      for (const item of dishIngredients) {
        const qty = typeof item.qty === 'string' ? parseFloat(item.qty) || 0 : (item.qty || 0);
        const unit = (item.unit || '').toLowerCase();
        
        // Convert to grams based on unit
        if (unit.includes('קילו') || unit === 'kg' || unit === 'ק״ג' || unit === 'ק"ג') {
          totalMassGrams += qty * 1000; // kg to grams
        } else if (unit.includes('גרם') || unit === 'g' || unit === 'gr') {
          totalMassGrams += qty; // already in grams
        } else if (unit.includes('ליטר') || unit === 'l') {
          totalMassGrams += qty * 1000; // assuming 1L = 1kg = 1000g for liquids
        }
        // For other units (יחידות, etc.) we don't add to mass
      }

      // Round to whole grams
      totalMassGrams = Math.round(totalMassGrams);

      // Update dish: set preparation_mass_grams to calculated value, reset portion_size_grams to null
      await base44.asServiceRole.entities.Dish.update(dish.id, {
        preparation_mass_grams: totalMassGrams > 0 ? totalMassGrams : null,
        portion_size_grams: null
      });

      updates.push({
        id: dish.id,
        name: dish.name,
        old_preparation_mass: dish.preparation_mass_grams,
        new_preparation_mass: totalMassGrams > 0 ? totalMassGrams : null,
        portion_size_grams_reset: true
      });

      updatedCount++;
    }

    return Response.json({
      success: true,
      message: `Updated ${updatedCount} dishes`,
      updates
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});