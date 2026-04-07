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
import { Plus, Trash2, Upload, FileText, X, Info, ExternalLink } from "lucide-react";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import IngredientDetailsDialog from "./IngredientDetailsDialog";
import IngredientDialog from "../inventory/IngredientDialog";
import SpecialIngredientDialog from "../ingredients/SpecialIngredientDialog";

const SUB_MANA_CATEGORY_ID = '694ab43b7f41f262f932394d';

export default function DishDialog({ dish, eventType = 'serving', ingredients = [], specialIngredients = [], categories = [], subCategories = [], open, onClose, suppliers = [], ingredientCategories = [] }) {
  const queryClient = useQueryClient();
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [searchTerms, setSearchTerms] = useState({});
  const [ingredientDetailsOpen, setIngredientDetailsOpen] = useState(false);
  const [selectedIngredientForDetails, setSelectedIngredientForDetails] = useState(null);
  const [editIngredientDialogOpen, setEditIngredientDialogOpen] = useState(false);
  const [editSpecialIngredientDialogOpen, setEditSpecialIngredientDialogOpen] = useState(false);
  const [selectedIngredientForEdit, setSelectedIngredientForEdit] = useState(null);
  const [selectedSpecialIngredientForEdit, setSelectedSpecialIngredientForEdit] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    recipe: '',
    event_type: eventType,
    categories: [],
    sub_category_id: '',
    sub_category_name: '',
    serving_percentage: 100,
    operations_department: '',
    ingredients: [],
    unit_cost: 0,
    pdf_files: [],
    active: true
  });

  useEffect(() => {
    if (dish) {
      setFormData({
        ...dish,
        serving_percentage: dish.serving_percentage ?? 100,
        sub_category_id: dish.sub_category_id || '',
        sub_category_name: dish.sub_category_name || '',
        ingredients: dish.ingredients || [],
        pdf_files: dish.pdf_files || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        recipe: '',
        event_type: eventType,
        categories: [],
        sub_category_id: '',
        sub_category_name: '',
        serving_percentage: 100,
        operations_department: '',
        ingredients: [],
        unit_cost: 0,
        pdf_files: [],
        active: true
      });
    }
  }, [dish, eventType]);

  const calculateDishCost = (dishIngredients) => {
    let totalCost = 0;
    dishIngredients.forEach(item => {
      // Check if it's a special ingredient
      const specialIngredient = specialIngredients.find(ing => ing.id === item.ingredient_id);
      if (specialIngredient) {
        const qty = typeof item.qty === 'string' ? parseFloat(item.qty) || 0 : (item.qty || 0);
        const pricePerSystem = specialIngredient.price_per_system_unit || 0;
        totalCost += qty * pricePerSystem;
        return;
      }

      // Otherwise check regular ingredients
      const ingredient = ingredients.find(ing => ing.id === item.ingredient_id);
      if (ingredient) {
        const purchaseUnit = ingredient.purchase_unit || 1;
        const wastePct = ingredient.waste_pct || 0;
        
        // price_per_system is now stored WITHOUT waste (supplier price / purchase_unit)
        // For dish cost we need to account for waste: price / (1 - waste%)
        const basePricePerSystem = ingredient.price_per_system ?? 
          ((ingredient.base_price ?? 0) / (purchaseUnit || 1));
        const pricePerSystem = wastePct > 0 ? basePricePerSystem / (1 - wastePct / 100) : basePricePerSystem;
        
        const qty = typeof item.qty === 'string' ? parseFloat(item.qty) || 0 : (item.qty || 0);
        totalCost += qty * pricePerSystem;
      }
    });
    return totalCost;
  };

  const isFirstCourseCategory = () => {
    const selectedCategories = categories.filter(cat => formData.categories.includes(cat.id));
    return selectedCategories.some(cat => {
      const name = cat.name.toLowerCase();
      return name.includes('first course') || name.includes('מנה ראשונה') || name.includes('מנות ראשונות');
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const savedDish = dish?.id 
        ? await base44.entities.Dish.update(dish.id, data)
        : await base44.entities.Dish.create(data);

      if (dish?.id) {
        const eventDishes = await base44.entities.Events_Dish.filter({ dish_id: dish.id });
        for (const eventDish of eventDishes) {
          const event = await base44.entities.Event.filter({ id: eventDish.event_id });
          if (event[0]) {
            const guestCount = event[0].guest_count || 0;
            
            let plannedQty, plannedCost;
            if (isFirstCourseCategory()) {
              const servingPct = data.serving_percentage ?? 100;
              const rawQty = guestCount * (servingPct / 100) * (1 / 7);
              plannedQty = Math.ceil(rawQty);
              plannedCost = plannedQty * data.unit_cost;
            } else {
              const portionPerGuest = data.avg_portion_per_guest || 0;
              plannedQty = guestCount * portionPerGuest;
              plannedCost = plannedQty * data.unit_cost;
            }

            await base44.entities.Events_Dish.update(eventDish.id, {
              planned_qty: plannedQty,
              planned_cost: plannedCost
            });
          }
        }
      }

      return savedDish;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(dish ? 'המנה עודכנה' : 'המנה נוצרה');
      onClose();
    },
    onError: () => {
      toast.error('שמירת המנה נכשלה');
    }
  });

  // Filter out "תת מנה" category
  const filteredCategories = categories.filter(cat => cat.id !== SUB_MANA_CATEGORY_ID);

  // Get available sub-categories for selected categories
  const availableSubCategories = subCategories.filter(sc => 
    formData.categories.includes(sc.category_id)
  ).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  const handleCategoryToggle = (categoryId) => {
    const newCategories = formData.categories.includes(categoryId)
      ? formData.categories.filter(id => id !== categoryId)
      : [...formData.categories, categoryId];
    
    // Reset sub-category if the parent category is deselected
    const newSubCatId = formData.sub_category_id;
    const subCat = subCategories.find(sc => sc.id === newSubCatId);
    const shouldResetSubCat = subCat && !newCategories.includes(subCat.category_id);
    
    setFormData({ 
      ...formData, 
      categories: newCategories,
      ...(shouldResetSubCat ? { sub_category_id: '', sub_category_name: '' } : {})
    });
  };

  const handleAddIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [{ ingredient_id: '', ingredient_name: '', qty: '', unit: '' }, ...formData.ingredients]
    });
  };

  const handleRemoveIngredient = (index) => {
    const newIngredients = [...formData.ingredients];
    newIngredients.splice(index, 1);
    const unitCost = calculateDishCost(newIngredients);
    setFormData({ ...formData, ingredients: newIngredients, unit_cost: unitCost });
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...formData.ingredients];
    
    if (field === 'qty') {
      newIngredients[index][field] = value;
      newIngredients[index]['_displayQty'] = value;
    } else {
      newIngredients[index][field] = value;
    }

    if (field === 'ingredient_id') {
      // Check if it's a special ingredient
      const specialIngredient = specialIngredients.find(ing => ing.id === value);
      if (specialIngredient) {
        newIngredients[index].ingredient_name = specialIngredient.name;
        newIngredients[index].unit = specialIngredient.system_unit;
      } else {
        // Otherwise it's a regular ingredient
        const ingredient = ingredients.find(ing => ing.id === value);
        if (ingredient) {
          newIngredients[index].ingredient_name = ingredient.name;
          newIngredients[index].unit = ingredient.system_unit || ingredient.unit;
        }
      }
    }

    const unitCost = calculateDishCost(newIngredients);
    setFormData({ ...formData, ingredients: newIngredients, unit_cost: unitCost });
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('אנא העלה קובץ PDF');
      return;
    }

    setUploadingPdf(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newPdf = {
        name: file.name,
        url: file_url,
        uploaded_date: format(new Date(), 'yyyy-MM-dd')
      };
      
      setFormData({
        ...formData,
        pdf_files: [...(formData.pdf_files || []), newPdf]
      });
      
      toast.success('PDF הועלה');
    } catch (error) {
      toast.error('העלאת PDF נכשלה');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleRemovePdf = (index) => {
    const newPdfFiles = [...formData.pdf_files];
    newPdfFiles.splice(index, 1);
    setFormData({ ...formData, pdf_files: newPdfFiles });
  };

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Dish.delete(dish.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('המנה נמחקה');
      onClose();
    },
    onError: () => {
      toast.error('מחיקת המנה נכשלה');
    }
  });

  const handleDelete = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק מנה זו? פעולה זו לא ניתנת לביטול.')) {
      deleteMutation.mutate();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Filter out ingredients that no longer exist in the system
    const validIngredients = formData.ingredients.filter(item => {
      if (!item.ingredient_id) return false;
      const existsInRegular = ingredients.some(ing => ing.id === item.ingredient_id);
      const existsInSpecial = specialIngredients.some(ing => ing.id === item.ingredient_id);
      return existsInRegular || existsInSpecial;
    });
    
    const dataToSave = {
      ...formData,
      ingredients: validIngredients.map(ing => ({
        ...ing,
        qty: typeof ing.qty === 'string' ? parseFloat(ing.qty) || 0 : (ing.qty || 0)
      }))
    };
    
    saveMutation.mutate(dataToSave);
  };

  const displayUnit = (unit) => {
    if (!unit) return '';
    const u = unit.toLowerCase().trim();
    if (u === 'kg' || u === 'קילוגרם' || u === 'קילו') return 'ק"ג';
    if (u === 'g' || u === 'gr' || u === 'גרם') return 'גרם';
    if (u === 'l' || u === 'liter' || u === 'litre') return 'ליטר';
    if (u === 'unit' || u === 'units' || u === 'pcs') return 'יחידה';
    return unit;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? 'עריכת מנה' : 'מנה חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>שם המנה *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div className="col-span-2">
              <Label>תיאור</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={2}
              />
            </div>

            <div className="col-span-2">
              <Label>מחלקת תפעול</Label>
              <Select
                value={formData.operations_department || ''}
                onValueChange={(value) => setFormData({...formData, operations_department: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מחלקה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot_kitchen">מטבח חם</SelectItem>
                  <SelectItem value="cold_kitchen">מטבח קר</SelectItem>
                  <SelectItem value="pastry">קונדיטוריה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>אחוז מנות לכלל האורחים *</Label>
              <p className="text-xs text-stone-500 mb-1">
                {isFirstCourseCategory()
                  ? 'כמות הסועדים חלקי 7 כפול האחוזים שתגדיר למטה ייקבע את כמות המנות'
                  : 'דוגמא: 100% = מנות לכל הסועדים, 150% = פי 1.5 מהכמות'}
              </p>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formData.serving_percentage || ''}
                  onChange={(e) => setFormData({...formData, serving_percentage: parseFloat(e.target.value) || 0})}
                  placeholder="100"
                  className="pl-8"
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">%</span>
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">קטגוריות</Label>
            <div className="flex flex-wrap gap-2">
              {filteredCategories.map(category => (
                <div key={category.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.categories.includes(category.id)}
                    onCheckedChange={() => handleCategoryToggle(category.id)}
                  />
                  <span className="text-sm">{category.name}</span>
                </div>
              ))}
            </div>
          </div>

          {availableSubCategories.length > 0 && (
            <div>
              <Label className="mb-2 block">תת קטגוריה</Label>
              <Select
                value={formData.sub_category_id || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    setFormData({ ...formData, sub_category_id: '', sub_category_name: '' });
                  } else {
                    const sc = subCategories.find(s => s.id === value);
                    setFormData({ ...formData, sub_category_id: value, sub_category_name: sc?.name || '' });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תת קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא תת קטגוריה</SelectItem>
                  {availableSubCategories.map(sc => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>רכיבים</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddIngredient}
              >
                <Plus className="w-4 h-4 mr-2" />
                הוסף רכיב
              </Button>
            </div>

            <div className="space-y-2">
              {[...formData.ingredients]
                .map((item, originalIndex) => {
                  // Calculate cost for sorting
                  const specialIng = specialIngredients.find(ing => ing.id === item.ingredient_id);
                  const regularIng = ingredients.find(ing => ing.id === item.ingredient_id);
                  let itemCost = 0;
                  if (specialIng) {
                    itemCost = (parseFloat(item.qty) || 0) * (specialIng.price_per_system_unit || 0);
                  } else if (regularIng) {
                    const purchaseUnit = regularIng.purchase_unit || 1;
                    const wastePct = regularIng.waste_pct || 0;
                    const basePPS = regularIng.price_per_system ?? ((regularIng.base_price ?? 0) / (purchaseUnit || 1));
                    const pricePerSystem = wastePct > 0 ? basePPS / (1 - wastePct / 100) : basePPS;
                    itemCost = (parseFloat(item.qty) || 0) * pricePerSystem;
                  }
                  return { item, originalIndex, itemCost };
                })
                .sort((a, b) => b.itemCost - a.itemCost)
                .map(({ item, originalIndex: index }) => {
                // Check if it's a special ingredient first
                const specialIngredient = specialIngredients.find(ing => ing.id === item.ingredient_id);
                const ingredient = ingredients.find(ing => ing.id === item.ingredient_id);
                
                let pricePerSystem = 0;
                let displayIngredient = null;

                if (specialIngredient) {
                  pricePerSystem = specialIngredient.price_per_system_unit || 0;
                  displayIngredient = specialIngredient;
                } else if (ingredient) {
                  const purchaseUnit = ingredient.purchase_unit || 1;
                  const wastePct = ingredient.waste_pct || 0;
                  const basePPS = ingredient.price_per_system ?? 
                    ((ingredient.base_price ?? 0) / (purchaseUnit || 1));
                  pricePerSystem = wastePct > 0 ? basePPS / (1 - wastePct / 100) : basePPS;
                  displayIngredient = ingredient;
                }

                // Combine regular and special ingredients for search
                const allIngredients = [
                  ...specialIngredients.map(si => ({ ...si, isSpecial: true })),
                  ...ingredients.map(i => ({ ...i, isSpecial: false }))
                ];

                const currentSearch = (searchTerms[index] || '').toLowerCase();
                const filteredIngredients = currentSearch 
                  ? allIngredients.filter(ing => ing.name.toLowerCase().includes(currentSearch))
                  : allIngredients;

                return (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-stone-50 rounded-lg">
                    <div className="col-span-6">
                      <Label className="text-xs">רכיב</Label>
                      <div className="space-y-1">
                        {!item.ingredient_id && (
                          <div>
                            <Input
                              placeholder="חפש רכיב..."
                              value={searchTerms[index] || ''}
                              onChange={(e) => {
                                setSearchTerms(prev => ({ ...prev, [index]: e.target.value }));
                              }}
                              className="h-9"
                            />
                            <div className="max-h-40 overflow-y-auto border rounded-md bg-white mt-1">
                              {filteredIngredients.length > 0 ? (
                                filteredIngredients.map(ing => {
                                  let ingPricePerSystem = 0;
                                  
                                  if (ing.isSpecial) {
                                    ingPricePerSystem = ing.price_per_system_unit || 0;
                                  } else {
                                    const purchaseUnit = ing.purchase_unit || 1;
                                    const wastePct = ing.waste_pct || 0;
                                    const basePPS = ing.price_per_system ?? 
                                      ((ing.base_price ?? 0) / (purchaseUnit || 1));
                                    ingPricePerSystem = wastePct > 0 ? basePPS / (1 - wastePct / 100) : basePPS;
                                  }
                                  
                                  return (
                                    <button
                                      key={ing.id}
                                      type="button"
                                      className="w-full text-right px-3 py-2 hover:bg-stone-100 text-sm border-b last:border-b-0"
                                      onClick={() => {
                                        handleIngredientChange(index, 'ingredient_id', ing.id);
                                        setSearchTerms(prev => ({ ...prev, [index]: '' }));
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium">{ing.name}</div>
                                        {ing.isSpecial && (
                                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">תת מנה</span>
                                        )}
                                      </div>
                                      <div className="text-xs text-stone-500">
                                        ₪{ingPricePerSystem.toFixed(2)}/{displayUnit(ing.system_unit)}
                                      </div>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-3 py-2 text-sm text-stone-500">לא נמצאו רכיבים</div>
                              )}
                            </div>
                          </div>
                        )}
                        {item.ingredient_id && displayIngredient && (
                          <div className="px-3 py-2 bg-white border rounded-md text-sm">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{displayIngredient.name}</div>
                              {specialIngredient && (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">רכיב מיוחד</span>
                              )}
                            </div>
                            <div className="text-xs text-stone-500">
                              ₪{pricePerSystem.toFixed(2)}/{displayUnit(displayIngredient.system_unit)}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (specialIngredient) {
                                  setSelectedSpecialIngredientForEdit(specialIngredient);
                                  setEditSpecialIngredientDialogOpen(true);
                                } else if (ingredient) {
                                  setSelectedIngredientForEdit(ingredient);
                                  setEditIngredientDialogOpen(true);
                                }
                              }}
                              className="mt-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-300 text-xs font-semibold"
                            >
                              <ExternalLink className="w-3.5 h-3.5 ml-1" />
                              עריכת רכיב
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">כמות</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={item.qty ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || val === '0' || val === '0.' || /^0?\.\d*$/.test(val) || /^\d+\.?\d*$/.test(val)) {
                            handleIngredientChange(index, 'qty', val);
                          }
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">יחידה</Label>
                      <Input
                        value={displayUnit(item.unit)}
                        readOnly
                        className="bg-stone-100"
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">עלות</Label>
                      <p className="text-sm font-semibold">
                        ₪{((typeof item.qty === 'string' ? parseFloat(item.qty) || 0 : (item.qty || 0)) * pricePerSystem).toFixed(2)}
                      </p>
                    </div>
                    <div className="col-span-1 flex gap-1">
                      {displayIngredient && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedIngredientForDetails({
                              ingredient: specialIngredient ? null : ingredient,
                              specialIngredient: specialIngredient || null
                            });
                            setIngredientDetailsOpen(true);
                          }}
                          title="פרטי רכיב"
                        >
                          <Info className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveIngredient(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
                })}
                </div>

                <div className="mt-3 space-y-2">
              <div className="p-3 bg-stone-100 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-stone-900">עלות כוללת למנה:</span>
                  <span className="text-xl font-bold text-stone-600">₪{(formData.unit_cost || 0).toFixed(2)}</span>
                </div>
              </div>
              
              {isFirstCourseCategory() && (
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-stone-900">מחיר לסועד (÷7):</span>
                    <span className="text-xl font-bold text-emerald-600">₪{((formData.unit_cost || 0) / 7).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>מסמכי מתכון (PDFs)</Label>
            <p className="text-xs text-stone-500 mb-2">העלה קבצי מתכון, תמונות או הערות בישול</p>
            <div className="space-y-2">
              {formData.pdf_files?.map((pdf, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-stone-50 rounded border">
                  <FileText className="w-4 h-4 text-red-600" />
                  <a 
                    href={pdf.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-blue-600 hover:underline truncate"
                  >
                    {pdf.name}
                  </a>
                  <span className="text-xs text-stone-500">{pdf.uploaded_date}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemovePdf(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  disabled={uploadingPdf}
                  className="hidden"
                  id="dish-pdf-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('dish-pdf-upload')?.click()}
                  disabled={uploadingPdf}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingPdf ? 'מעלה...' : 'העלה PDF'}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>הוראות הכנה</Label>
            <Textarea
              value={formData.recipe}
              onChange={(e) => setFormData({...formData, recipe: e.target.value})}
              rows={4}
              placeholder="הוראות הכנה שלב אחר שלב..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({...formData, active: checked})}
            />
            <Label>פעיל (זמין לאירועים)</Label>
          </div>

          <DialogFooter className={dish?.id ? "sm:justify-between" : ""}>
            {dish?.id && (
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
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {dish ? 'עדכון' : 'יצירת'} מנה
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      <IngredientDetailsDialog
        ingredient={selectedIngredientForDetails?.ingredient}
        specialIngredient={selectedIngredientForDetails?.specialIngredient}
        open={ingredientDetailsOpen}
        onClose={() => {
          setIngredientDetailsOpen(false);
          setSelectedIngredientForDetails(null);
        }}
      />

      {editIngredientDialogOpen && (
        <IngredientDialog
          ingredient={selectedIngredientForEdit}
          suppliers={suppliers}
          ingredientCategories={ingredientCategories}
          open={editIngredientDialogOpen}
          onClose={() => {
            setEditIngredientDialogOpen(false);
            setSelectedIngredientForEdit(null);
          }}
        />
      )}

      {editSpecialIngredientDialogOpen && (
        <SpecialIngredientDialog
          ingredient={selectedSpecialIngredientForEdit}
          open={editSpecialIngredientDialogOpen}
          onClose={() => {
            setEditSpecialIngredientDialogOpen(false);
            setSelectedSpecialIngredientForEdit(null);
          }}
        />
      )}
    </Dialog>
  );
}