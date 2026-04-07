import React, { useState } from 'react';
import { format } from 'date-fns';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import DepartmentPrintPreview from "./DepartmentPrintPreview";

const DEPARTMENTS = {
  hot_kitchen: 'מטבח חם',
  cold_kitchen: 'מטבח קר',
  pastry: 'קונדיטוריה',
  fish: 'דגים',
  fruits_vegetables: 'פירות וירקות'
};

const MAIN_DEPARTMENTS = ['hot_kitchen', 'cold_kitchen', 'pastry'];
const SUPPORT_DEPARTMENTS = ['fish', 'fruits_vegetables'];

// Map ingredient categories to support departments
const CATEGORY_TO_SUPPORT_DEPT = {
  'דגים': 'fish',
  'פירות וירקות': 'fruits_vegetables',
  'ירקות ופירות': 'fruits_vegetables',
  'ירקות': 'fruits_vegetables',
  'פירות': 'fruits_vegetables'
};

const formatNumber = (num) => {
  if (num === 0) return '0';
  if (Number.isInteger(num)) return num.toString();
  // Max 3 decimal places
  const fixed = Math.round(num * 1000) / 1000;
  return fixed.toFixed(3).replace(/\.?0+$/, '');
};

const formatUnit = (unit) => {
  if (!unit) return '';
  const unitLower = unit.toLowerCase();
  if (unitLower === 'kg' || unitLower === 'kilo') return 'ק״ג';
  if (unitLower === 'g' || unitLower === 'gr' || unitLower === 'gram') return 'גרם';
  if (unitLower === 'l' || unitLower === 'liter' || unitLower === 'litre') return 'ליטר';
  if (unitLower === 'ml') return 'מ״ל';
  if (unitLower === 'unit' || unitLower === 'units' || unitLower === 'pcs') return 'יחידות';
  return unit;
};

export default function DepartmentPrintDialog({ 
  open, 
  onOpenChange, 
  event, 
  eventDishes, 
  dishes, 
  categories, 
  ingredients, 
  ingredientCategories,
  specialIngredients = [],
  subCategories = []
}) {
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewHeaderInfo, setPreviewHeaderInfo] = useState(null);

  // Helper to get category display_order for sorting
  const getCategoryOrder = (dish) => {
    const cat = (categories || []).find(c => dish.categories?.includes(c.id));
    return cat?.display_order ?? 999;
  };

  const getCategoryName = (dish) => {
    const cat = (categories || []).find(c => dish.categories?.includes(c.id));
    return cat?.name || '';
  };

  const getCategoryId = (dish) => {
    const cat = (categories || []).find(c => dish.categories?.includes(c.id));
    return cat?.id || '';
  };

  const getSubCategoryOrder = (dish) => {
    if (!dish.sub_category_id) return 999;
    const sc = (subCategories || []).find(s => s.id === dish.sub_category_id);
    return sc?.display_order ?? 999;
  };

  const getSubCategoryName = (dish) => {
    return dish.sub_category_name || '';
  };

  const isFirstCourseDish = (dish) => {
    const dishCategories = (categories || []).filter(cat => dish.categories?.includes(cat.id));
    return dishCategories.some(cat => {
      const name = cat.name.toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
  };

  const getEffectivePlannedQty = (eventDish) => {
    if (eventDish.planned_qty && eventDish.planned_qty > 0) return eventDish.planned_qty;
    // If planned_qty is 0, calculate suggested quantity (same logic as EventStages)
    const dish = dishes.find(d => d.id === eventDish.dish_id);
    if (!dish) return 0;
    const guestCount = event?.guest_count || 0;
    const servingPercentage = dish.serving_percentage ?? 100;
    if (dish.preparation_mass_grams && dish.portion_size_grams) {
      const portionsPerPreparation = dish.preparation_mass_grams / dish.portion_size_grams;
      const totalPortionsNeeded = guestCount * (servingPercentage / 100);
      return Math.ceil(totalPortionsNeeded / portionsPerPreparation);
    }
    const portionFactor = isFirstCourseDish(dish) ? 1/7 : (dish.portion_factor ?? 1);
    const rawQuantity = guestCount * (servingPercentage / 100) * portionFactor;
    return Math.ceil(rawQuantity);
  };

  const getIngredientSupportDept = (ingredient) => {
    const catName = ingredient?.ingredient_category_name || ingredient?.category || '';
    for (const [key, dept] of Object.entries(CATEGORY_TO_SUPPORT_DEPT)) {
      if (catName.includes(key)) {
        return dept;
      }
    }
    return null;
  };

  const getDepartmentData = (deptKey) => {
    const isMainDept = MAIN_DEPARTMENTS.includes(deptKey);
    const isSupportDept = SUPPORT_DEPARTMENTS.includes(deptKey);
    
    const deptDishes = [];
    const ingredientTotals = {};

    // Step 1: Collect all special ingredient needs across all dishes in this department
    const specialIngredientNeeds = {}; // specialIngId -> { totalQtyNeeded, batchSize, dishes: [{dishName, qtyNeeded}] }

    // First pass: gather all special ingredient demands
    // Also check if special ingredients have components relevant to support departments
    const siHasRelevantComponents = (si) => {
      if (!isSupportDept) return false;
      return (si.components || []).some(comp => {
        const compIngredient = ingredients.find(i => i.id === comp.ingredient_id);
        return getIngredientSupportDept(compIngredient) === deptKey;
      });
    };

    eventDishes.forEach(eventDish => {
      const effectiveQty = getEffectivePlannedQty(eventDish);
      if (!effectiveQty || effectiveQty <= 0) return;
      const dish = dishes.find(d => d.id === eventDish.dish_id);
      if (!dish) return;

      let includeDish = false;
      if (isMainDept) {
        if (dish.operations_department === deptKey) includeDish = true;
      }
      if (isSupportDept && dish.ingredients) {
        const hasRelevantIngredient = dish.ingredients.some(ing => {
          const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
          if (getIngredientSupportDept(ingredient) === deptKey) return true;
          // Also check if a special ingredient has components in this dept
          const si = specialIngredients.find(s => s.id === ing.ingredient_id);
          if (si && siHasRelevantComponents(si)) return true;
          return false;
        });
        if (hasRelevantIngredient) includeDish = true;
      }
      if (!includeDish) return;

      (dish.ingredients || []).forEach(ing => {
        const si = specialIngredients.find(s => s.id === ing.ingredient_id);
        if (!si) return;
        
        // For support departments, filter special ingredient components to only those relevant to this dept
        const allComponents = si.components || [];
        const filteredComponents = isSupportDept
          ? allComponents.filter(comp => {
              const compIngredient = ingredients.find(i => i.id === comp.ingredient_id);
              return getIngredientSupportDept(compIngredient) === deptKey;
            })
          : allComponents;
        
        // For support departments, skip this special ingredient if none of its components belong to this dept
        if (isSupportDept && filteredComponents.length === 0) return;

        const qtyNeeded = (ing.qty || 0) * effectiveQty;
        if (qtyNeeded <= 0) return;
        if (!specialIngredientNeeds[si.id]) {
          specialIngredientNeeds[si.id] = {
            name: si.name,
            system_unit: si.system_unit,
            batchSize: si.total_quantity || 1,
            components: filteredComponents,
            totalQtyNeeded: 0,
            dishes: []
          };
        }
        specialIngredientNeeds[si.id].totalQtyNeeded += qtyNeeded;
        specialIngredientNeeds[si.id].dishes.push({
          dishName: dish.name,
          qtyNeeded,
          operations_department: dish.operations_department
        });
      });
    });

    // Step 2: Calculate batches for each special ingredient (rounded up)
    const specialIngredientBatches = {};
    for (const [siId, siData] of Object.entries(specialIngredientNeeds)) {
      const batches = Math.ceil(siData.totalQtyNeeded / siData.batchSize);
      const totalProduced = batches * siData.batchSize;
      specialIngredientBatches[siId] = {
        ...siData,
        batches,
        totalProduced,
        leftover: totalProduced - siData.totalQtyNeeded
      };
    }

    // Second pass: build dish data
    eventDishes.forEach(eventDish => {
      const effectiveQty = getEffectivePlannedQty(eventDish);
      if (!effectiveQty || effectiveQty <= 0) return;
      
      const dish = dishes.find(d => d.id === eventDish.dish_id);
      if (!dish) return;

      let includeDish = false;
      if (isMainDept) {
        if (dish.operations_department === deptKey) includeDish = true;
      }
      if (isSupportDept && dish.ingredients) {
        const hasRelevantIngredient = dish.ingredients.some(ing => {
          const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
          if (getIngredientSupportDept(ingredient) === deptKey) return true;
          const si = specialIngredients.find(s => s.id === ing.ingredient_id);
          if (si && siHasRelevantComponents(si)) return true;
          return false;
        });
        if (hasRelevantIngredient) includeDish = true;
      }
      if (!includeDish) return;

      const dishIngredients = [];
      const dishSpecialIngredients = [];
      
      (dish.ingredients || []).forEach(ing => {
        // Check if this is a special ingredient
        const si = specialIngredients.find(s => s.id === ing.ingredient_id);
        if (si) {
          const qtyNeeded = (ing.qty || 0) * effectiveQty;
          if (qtyNeeded <= 0) return;

          // For support departments, expand special ingredient components into individual ingredients
          if (isSupportDept) {
            const siData = specialIngredientBatches[si.id];
            if (!siData) return;
            const filteredComps = (si.components || []).filter(comp => {
              const compIngredient = ingredients.find(i => i.id === comp.ingredient_id);
              return getIngredientSupportDept(compIngredient) === deptKey;
            });
            filteredComps.forEach(comp => {
              const compIngredient = ingredients.find(i => i.id === comp.ingredient_id);
              if (!compIngredient) return;
              const rawCompQty = (comp.qty || 0) * siData.batches;
              const compWastePct = compIngredient.waste_pct || 0;
              const compQty = compWastePct > 0 ? rawCompQty / (1 - compWastePct / 100) : rawCompQty;
              // Calculate per-unit: component qty per batch * batches / effectiveQty
              const perUnit = compQty / effectiveQty;

              dishIngredients.push({
                ingredient_id: comp.ingredient_id,
                ingredient_name: `${compIngredient.name} (${si.name})`,
                unit: compIngredient.system_unit || comp.unit,
                qty_per_unit: perUnit,
                total_qty: compQty,
                waste_pct: compWastePct,
                support_dept: deptKey,
                support_dept_name: DEPARTMENTS[deptKey],
                from_special_ingredient: true
              });

              const key = `${comp.ingredient_id}_si_${si.id}`;
              if (!ingredientTotals[key]) {
                ingredientTotals[key] = {
                  ingredient_id: comp.ingredient_id,
                  ingredient_name: `${compIngredient.name} (${si.name})`,
                  unit: compIngredient.system_unit || comp.unit,
                  total_qty: 0,
                  support_dept: deptKey,
                  support_dept_name: DEPARTMENTS[deptKey]
                };
              }
              ingredientTotals[key].total_qty += compQty;
            });
          } else {
            // For main departments, show special ingredient as-is
            dishSpecialIngredients.push({
              ingredient_id: si.id,
              ingredient_name: si.name,
              unit: si.system_unit,
              qty_per_unit: ing.qty || 0,
              total_qty: qtyNeeded,
              is_special: true
            });
          }
          return;
        }

        const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
        if (!ingredient) return;

        const supportDept = getIngredientSupportDept(ingredient);
        
        if (isMainDept || (isSupportDept && supportDept === deptKey)) {
          const rawQtyNeeded = (ing.qty || 0) * effectiveQty;
          const wastePct = ingredient.waste_pct || 0;
          const qtyNeeded = wastePct > 0 ? rawQtyNeeded / (1 - wastePct / 100) : rawQtyNeeded;
          
          dishIngredients.push({
            ingredient_id: ing.ingredient_id,
            ingredient_name: ingredient.name || ing.ingredient_name,
            unit: ingredient.system_unit || ing.unit,
            qty_per_unit: ing.qty || 0,
            total_qty: qtyNeeded,
            waste_pct: wastePct,
            support_dept: supportDept,
            support_dept_name: supportDept ? DEPARTMENTS[supportDept] : null
          });

          const key = ing.ingredient_id;
          if (!ingredientTotals[key]) {
            ingredientTotals[key] = {
              ingredient_id: ing.ingredient_id,
              ingredient_name: ingredient.name || ing.ingredient_name,
              unit: ingredient.system_unit || ing.unit,
              total_qty: 0,
              support_dept: supportDept,
              support_dept_name: supportDept ? DEPARTMENTS[supportDept] : null
            };
          }
          ingredientTotals[key].total_qty += qtyNeeded;
        }
      });

      // Build calculation breakdown string
      const guestCount = event?.guest_count || 0;
      const servingPct = dish.serving_percentage ?? 100;
      let calcBreakdown = '';
      if (dish.preparation_mass_grams && dish.portion_size_grams) {
        const portionsPerPrep = dish.preparation_mass_grams / dish.portion_size_grams;
        const totalPortions = guestCount * (servingPct / 100);
        calcBreakdown = `${guestCount} סועדים × ${servingPct}% = ${formatNumber(totalPortions)} מנות ÷ ${formatNumber(portionsPerPrep)} מנות למסה = ${effectiveQty}`;
      } else {
        const portionFactor = isFirstCourseDish(dish) ? 1/6 : (dish.portion_factor ?? 1);
        const raw = guestCount * (servingPct / 100) * portionFactor;
        if (portionFactor !== 1) {
          calcBreakdown = `${guestCount} סועדים × ${servingPct}% × ${formatNumber(portionFactor)} = ${formatNumber(raw)} ⇒ ${effectiveQty}`;
        } else {
          calcBreakdown = `${guestCount} סועדים × ${servingPct}% = ${formatNumber(raw)} ⇒ ${effectiveQty}`;
        }
      }

      deptDishes.push({
        dish_id: dish.id,
        dish_name: dish.name,
        planned_qty: effectiveQty,
        calcBreakdown,
        ingredients: dishIngredients,
        specialIngredients: dishSpecialIngredients,
        operations_department: dish.operations_department,
        category_id: getCategoryId(dish),
        category_name: getCategoryName(dish),
        category_order: getCategoryOrder(dish),
        sub_category_name: getSubCategoryName(dish),
        sub_category_order: getSubCategoryOrder(dish)
      });
    });

    return {
      dishes: deptDishes,
      ingredientTotals: Object.values(ingredientTotals),
      specialIngredientBatches
    };
  };

  const generatePrintContent = (deptKeys) => {
    const pages = [];
    
    deptKeys.forEach(deptKey => {
      const deptData = getDepartmentData(deptKey);
      if (deptData.dishes.length === 0) return;

      pages.push({
        deptKey,
        deptName: DEPARTMENTS[deptKey],
        ...deptData
      });
    });

    return pages;
  };

  const handlePrint = (deptKeys) => {
    let keysToProcess = Array.isArray(deptKeys) ? deptKeys : [deptKeys];
    
    const pages = generatePrintContent(keysToProcess);
    if (pages.length === 0) return;

    const htmlContent = buildPrintHtml(pages);
    const deptNames = pages.map(p => p.deptName).join(' | ');
    const eventDate = event.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy') : '-';
    const now = new Date();
    const ts = `${now.toLocaleDateString('he-IL')} ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    
    setPreviewTitle(`דוח ${deptNames} | ${event.event_name} | ${eventDate}`);
    setPreviewHtml(htmlContent);
    setPreviewHeaderInfo({
      deptName: deptNames,
      eventName: event.event_name,
      eventDate,
      eventTime: event.event_time || '-',
      guestCount: event.guest_count || 0,
      printTimestamp: ts
    });
    setPreviewOpen(true);
  };

  const buildPrintHtml = (pages) => {

    const renderSpecialIngredientsHtml = (siBatchList, label) => {
      const siDishesHtml = siBatchList.map(si => {
        const dishBreakdown = si.dishes.map(d => 
          `${d.dishName}: ${formatNumber(d.qtyNeeded)} ${formatUnit(si.system_unit)}`
        ).join(' | ');

        const comps = si.components || [];
        const compRows = [];
        for (let i = 0; i < comps.length; i += 2) {
          const c1 = comps[i];
          const c2 = comps[i + 1];
          const qtyPerBatch1 = c1.qty || 0;
          const comp1Ingredient = ingredients.find(i => i.id === c1.ingredient_id);
          const comp1WastePct = comp1Ingredient?.waste_pct || 0;
          const totalQty1Raw = qtyPerBatch1 * si.batches;
          const totalQty1 = comp1WastePct > 0 ? totalQty1Raw / (1 - comp1WastePct / 100) : totalQty1Raw;
          
          let rightCells = '<td colspan="3"></td>';
          if (c2) {
            const qtyPerBatch2 = c2.qty || 0;
            const comp2Ingredient = ingredients.find(i => i.id === c2.ingredient_id);
            const comp2WastePct = comp2Ingredient?.waste_pct || 0;
            const totalQty2Raw = qtyPerBatch2 * si.batches;
            const totalQty2 = comp2WastePct > 0 ? totalQty2Raw / (1 - comp2WastePct / 100) : totalQty2Raw;
            rightCells = `
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd;">
                ${c2.ingredient_name || 'רכיב'}${comp2WastePct > 0 ? `<span style="color: #d32f2f; font-size: 9px; font-weight: bold;"> (פחת ${comp2WastePct}%)</span>` : ''}
              </td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center;">${formatNumber(qtyPerBatch2)} ${formatUnit(c2.unit)}</td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;">${formatNumber(totalQty2)} ${formatUnit(c2.unit)}</td>
            `;
          }

          compRows.push(`
            <tr>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd;">
                ${c1.ingredient_name || 'רכיב'}${comp1WastePct > 0 ? `<span style="color: #d32f2f; font-size: 9px; font-weight: bold;"> (פחת ${comp1WastePct}%)</span>` : ''}
              </td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center;">${formatNumber(qtyPerBatch1)} ${formatUnit(c1.unit)}</td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;">${formatNumber(totalQty1)} ${formatUnit(c1.unit)}</td>
              <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; border-right: 3px solid #333; width: 2px;"></td>
              ${rightCells}
            </tr>
          `);
        }

        const leftoverText = si.leftover > 0.001 
          ? ` | עודף: ${formatNumber(si.leftover)} ${formatUnit(si.system_unit)}`
          : '';

        return `
          <div style="margin-bottom: 20px; page-break-inside: avoid;">
            <div style="background-color: #2e7d32; color: white; padding: 8px 12px; font-weight: bold; font-size: 14px; border-radius: 4px;">
              ${si.name} - ${si.batches} מסות (נדרש ${formatNumber(si.totalQtyNeeded)} ${formatUnit(si.system_unit)}, מסה = ${formatNumber(si.batchSize)} ${formatUnit(si.system_unit)}${leftoverText})
            </div>
            <div style="padding: 4px 12px; font-size: 11px; color: #555; background-color: #f1f8e9; border: 1px solid #c8e6c9; border-top: none;">
              ${dishBreakdown}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 0;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 80px;">למסה</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">סה״כ</th>
                  <th style="border-bottom: 2px solid #333; border-right: 3px solid #333; width: 2px;"></th>
                  <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 80px;">למסה</th>
                  <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">סה״כ</th>
                </tr>
              </thead>
              <tbody>
                ${compRows.join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-top: 15px; border-top: 3px solid #2e7d32; padding-top: 10px;">
          <h3 style="margin: 0 0 10px 0; font-size: 20px; background-color: #2e7d32; color: white; padding: 10px; text-align: center; font-weight: 900; text-decoration: underline; text-underline-offset: 5px;">תת מנות - ${label}</h3>
          ${siDishesHtml}
        </div>
      `;
    };

    const renderDishHtml = (dishData) => {
      const allItems = [
        ...dishData.ingredients.map(ing => {
          const ingData = ingredients.find(i => i.id === ing.ingredient_id);
          const totalCost = (ingData?.price_per_system || 0) * ing.total_qty;
          return { ...ing, is_special: false, _sortCost: totalCost };
        }),
        ...(dishData.specialIngredients || []).map(si => {
          const siData = specialIngredients.find(s => s.id === si.ingredient_id);
          const totalCost = (siData?.price_per_system_unit || siData?.total_cost || 0) * si.total_qty;
          return { ...si, is_special: true, _sortCost: totalCost };
        })
      ].sort((a, b) => b._sortCost - a._sortCost);

      const ingredientRows = [];
      for (let i = 0; i < allItems.length; i += 2) {
        const ing1 = allItems[i];
        const ing2 = allItems[i + 1];

        const renderCell = (ing) => {
          if (!ing) return '<td colspan="3"></td>';
          const bgStyle = ing.is_special ? 'background-color: #f1f8e9;' : '';
          const nameExtra = ing.is_special 
            ? '<span style="color: #2e7d32; font-size: 9px; font-weight: bold;"> (תת מנה)</span>'
            : '';
          const wasteLabel = (ing.waste_pct && ing.waste_pct > 0)
            ? `<span style="color: #d32f2f; font-size: 9px; font-weight: bold;"> (פחת ${ing.waste_pct}%)</span>`
            : '';
          return `
            <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; ${bgStyle}">
              ${ing.ingredient_name}${nameExtra}${wasteLabel}
            </td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center; ${bgStyle}">${formatNumber(ing.qty_per_unit)} ${formatUnit(ing.unit)}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; ${bgStyle}">${formatNumber(ing.total_qty)} ${formatUnit(ing.unit)}</td>
          `;
        };
        
        ingredientRows.push(`
          <tr>
            ${renderCell(ing1)}
            <td style="padding: 4px 8px; border-bottom: 1px solid #ddd; border-right: 3px solid #333; width: 2px;"></td>
            ${renderCell(ing2)}
          </tr>
        `);
      }

      return `
        <div style="margin-bottom: 20px; page-break-inside: avoid;">
          <div style="background-color: #e0e0e0; padding: 8px 12px; font-weight: bold; font-size: 14px; border-radius: 4px;">
            ${dishData.dish_name} - ${dishData.planned_qty} מנות
            <span style="font-weight: normal; font-size: 11px; color: #555; margin-right: 10px;">(${dishData.calcBreakdown || ''})</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 80px;">למנה</th>
                <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">סה״כ</th>
                <th style="border-bottom: 2px solid #333; border-right: 3px solid #333; width: 2px;"></th>
                <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 80px;">למנה</th>
                <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #333; width: 100px;">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              ${ingredientRows.join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    // Helper to render dishes grouped by category and sub-category
    const renderDishesGrouped = (dishList) => {
      // Sort by category_order then sub_category_order
      const sorted = [...dishList].sort((a, b) => {
        if (a.category_order !== b.category_order) return a.category_order - b.category_order;
        return a.sub_category_order - b.sub_category_order;
      });

      let html = '';
      let lastCatId = null;
      let lastSubCatName = null;

      sorted.forEach(dishData => {
        if (dishData.category_id && dishData.category_id !== lastCatId) {
          lastCatId = dishData.category_id;
          lastSubCatName = null;
          html += `<div style="background-color: #795548; color: white; padding: 12px 16px; font-weight: 900; font-size: 22px; border-radius: 4px; margin-top: 24px; margin-bottom: 4px; text-decoration: underline; text-underline-offset: 6px; page-break-after: avoid;">${dishData.category_name}</div>`;
        }
        if (dishData.sub_category_name && dishData.sub_category_name !== lastSubCatName) {
          lastSubCatName = dishData.sub_category_name;
          html += `<div style="background-color: #a1887f; color: white; padding: 10px 16px; font-weight: 900; font-size: 19px; border-radius: 3px; margin-top: 12px; margin-bottom: 6px; margin-right: 15px; text-decoration: underline; text-underline-offset: 5px; page-break-after: avoid;">${dishData.sub_category_name}</div>`;
        }
        html += renderDishHtml(dishData);
      });

      return html;
    };

    const pagesHtml = pages.map((page, pageIndex) => {
      let dishesHtml = renderDishesGrouped(page.dishes);

      // Create two-column totals (only for non-main departments)
      const showIngredientSummary = !MAIN_DEPARTMENTS.includes(page.deptKey);
      
      let totalsSectionHtml = '';
      if (showIngredientSummary) {
        const totalRows = [];
        for (let i = 0; i < page.ingredientTotals.length; i += 2) {
          const ing1 = page.ingredientTotals[i];
          const ing2 = page.ingredientTotals[i + 1];
          
          totalRows.push(`
            <tr>
              <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">
                ${ing1.ingredient_name}
              </td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; font-weight: bold;">${formatNumber(ing1.total_qty)} ${formatUnit(ing1.unit)}</td>
              <td style="border-bottom: 1px solid #ddd; border-right: 3px solid #333; width: 2px;"></td>
              ${ing2 ? `
                <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">
                  ${ing2.ingredient_name}
                </td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; font-weight: bold;">${formatNumber(ing2.total_qty)} ${formatUnit(ing2.unit)}</td>
              ` : '<td colspan="2"></td>'}
            </tr>
          `);
        }
        
        totalsSectionHtml = `
          <div style="margin-top: 30px; border-top: 3px solid #333; padding-top: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 22px; background-color: #333; color: white; padding: 12px; text-align: center; font-weight: 900; text-decoration: underline; text-underline-offset: 6px;">סיכום רכיבים - ${page.deptName}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="padding: 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #333; width: 120px;">כמות כוללת</th>
                  <th style="border-bottom: 2px solid #333; border-right: 3px solid #333; width: 2px;"></th>
                  <th style="padding: 8px; text-align: right; border-bottom: 2px solid #333;">רכיב</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #333; width: 120px;">כמות כוללת</th>
                </tr>
              </thead>
              <tbody>
                ${totalRows.join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      let specialSummaryHtml = '';
      const siBatches = Object.values(page.specialIngredientBatches || {});
      if (siBatches.length > 0) {
        specialSummaryHtml = renderSpecialIngredientsHtml(siBatches, page.deptName);
      }

      return `
        <div style="${pageIndex > 0 ? 'page-break-before: always;' : ''}">
          ${dishesHtml}

          ${totalsSectionHtml}

          ${specialSummaryHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="report-content">
        ${pagesHtml}
      </div>
    `;
  };

  if (!event) return null;

  const allDepartments = [...MAIN_DEPARTMENTS, ...SUPPORT_DEPARTMENTS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">הדפסת דוחות מחלקות</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-stone-600 mb-4">
            <strong>{event.event_name}</strong> | {event.event_date ? format(new Date(event.event_date), 'dd/MM/yyyy') : '-'} | {event.guest_count} סועדים
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-stone-700">מחלקות תפעול ראשיות:</h4>
            <div className="grid grid-cols-1 gap-2">
              {MAIN_DEPARTMENTS.map(deptKey => {
                const deptData = getDepartmentData(deptKey);
                const hasDishes = deptData.dishes.length > 0;
                return (
                  <Button
                    key={deptKey}
                    variant="outline"
                    className={`justify-start ${!hasDishes ? 'opacity-50' : ''}`}
                    onClick={() => handlePrint(deptKey)}
                    disabled={!hasDishes}
                  >
                    <Printer className="w-4 h-4 ml-2" />
                    {DEPARTMENTS[deptKey]}
                    {!hasDishes && <span className="text-xs text-stone-400 mr-2">(אין מנות)</span>}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-stone-700">מחלקות תמיכה:</h4>
            <div className="grid grid-cols-1 gap-2">
              {SUPPORT_DEPARTMENTS.map(deptKey => {
                const deptData = getDepartmentData(deptKey);
                const hasDishes = deptData.dishes.length > 0;
                return (
                  <Button
                    key={deptKey}
                    variant="outline"
                    className={`justify-start ${!hasDishes ? 'opacity-50' : ''}`}
                    onClick={() => handlePrint(deptKey)}
                    disabled={!hasDishes}
                  >
                    <Printer className="w-4 h-4 ml-2" />
                    {DEPARTMENTS[deptKey]}
                    {!hasDishes && <span className="text-xs text-stone-400 mr-2">(אין רכיבים)</span>}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handlePrint(allDepartments)}
            >
              <Printer className="w-4 h-4 ml-2" />
              הדפס את כל המחלקות
            </Button>
          </div>
        </div>
      </DialogContent>

      <DepartmentPrintPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        htmlContent={previewHtml}
        title={previewTitle}
        headerInfo={previewHeaderInfo}
      />
    </Dialog>
  );
}