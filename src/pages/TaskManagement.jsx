import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Settings } from "lucide-react";
import TaskCategoryManager from "../components/tasks/TaskCategoryManager";
import TaskTemplateManager from "../components/tasks/TaskTemplateManager";
import TaskCategoryDialog from "../components/tasks/TaskCategoryDialog";
import TaskTemplateDialog from "../components/tasks/TaskTemplateDialog";

export default function TaskManagement() {
  const [recurringSearch, setRecurringSearch] = useState("");
  const [perEventSearch, setPerEventSearch] = useState("");
  const [selectedRecurringCategory, setSelectedRecurringCategory] = useState(null);
  const [selectedPerEventCategory, setSelectedPerEventCategory] = useState(null);
  const [showRecurringCategoryDialog, setShowRecurringCategoryDialog] = useState(false);
  const [showPerEventCategoryDialog, setShowPerEventCategoryDialog] = useState(false);
  const [editingRecurringCategory, setEditingRecurringCategory] = useState(null);
  const [editingPerEventCategory, setEditingPerEventCategory] = useState(null);
  const [showRecurringTemplateDialog, setShowRecurringTemplateDialog] = useState(false);
  const [showPerEventTemplateDialog, setShowPerEventTemplateDialog] = useState(false);
  const [pvSearch, setPvSearch] = useState("");
  const [selectedPvCategory, setSelectedPvCategory] = useState(null);
  const [showPvCategoryDialog, setShowPvCategoryDialog] = useState(false);
  const [editingPvCategory, setEditingPvCategory] = useState(null);
  const [showPvTemplateDialog, setShowPvTemplateDialog] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['taskCategories'],
    queryFn: () => base44.entities.TaskCategory.list(),
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['taskTemplates'],
    queryFn: () => base44.entities.TaskTemplate.list(),
    initialData: [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: () => base44.entities.EmployeeRole.list(),
    initialData: [],
  });

  const recurringCategories = categories.filter(c => c.category_type === 'RECURRING');
  const perEventCategories = categories.filter(c => c.category_type === 'PER_EVENT');
  const pvCategories = categories.filter(c => c.category_type === 'PETI_VOR_RECURRING');

  const filteredRecurringTemplates = templates.filter(t => {
    const matchesSearch = recurringSearch ? 
      (t.title?.toLowerCase().includes(recurringSearch.toLowerCase()) ||
       t.description?.toLowerCase().includes(recurringSearch.toLowerCase())) : true;
    const matchesType = t.task_type === 'RECURRING';
    const matchesCategory = selectedRecurringCategory ? t.category_id === selectedRecurringCategory : true;
    return matchesSearch && matchesType && matchesCategory;
  });

  const filteredPerEventTemplates = templates.filter(t => {
    const matchesSearch = perEventSearch ? 
      (t.title?.toLowerCase().includes(perEventSearch.toLowerCase()) ||
       t.description?.toLowerCase().includes(perEventSearch.toLowerCase())) : true;
    const matchesType = t.task_type === 'PER_EVENT';
    const matchesCategory = selectedPerEventCategory ? t.category_id === selectedPerEventCategory : true;
    return matchesSearch && matchesType && matchesCategory;
  });

  const filteredPvTemplates = templates.filter(t => {
    const matchesSearch = pvSearch ? 
      (t.title?.toLowerCase().includes(pvSearch.toLowerCase()) ||
       t.description?.toLowerCase().includes(pvSearch.toLowerCase())) : true;
    const pvCatIds = pvCategories.map(c => c.id);
    const matchesType = pvCatIds.includes(t.category_id);
    const matchesCategory = selectedPvCategory ? t.category_id === selectedPvCategory : true;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">ניהול משימות</h1>
        <p className="text-stone-500 mt-1">הגדרת קטגוריות ומשימות</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* משימות שוטפות */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center">משימות שוטפות</h2>
          
          <div className="flex justify-center gap-3">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowRecurringTemplateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף משימה
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingRecurringCategory(null);
                setShowRecurringCategoryDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף קטגוריה
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant={selectedRecurringCategory === null ? "default" : "outline"}
              onClick={() => setSelectedRecurringCategory(null)}
              size="sm"
            >
              כל הקטגוריות ({filteredRecurringTemplates.length})
            </Button>
            {recurringCategories
              .filter(c => c.is_active)
              .map((cat) => {
                const count = templates.filter(t => t.category_id === cat.id && t.task_type === 'RECURRING').length;
                return (
                  <Button
                    key={cat.id}
                    variant={selectedRecurringCategory === cat.id ? "default" : "outline"}
                    onClick={() => setSelectedRecurringCategory(cat.id)}
                    size="sm"
                    className="relative"
                  >
                    {cat.name} ({count})
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRecurringCategory(cat);
                        setShowRecurringCategoryDialog(true);
                      }}
                      className="mr-2 hover:bg-white/20 rounded p-0.5"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </Button>
                );
              })}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
            <Input
              placeholder="חיפוש משימות..."
              value={recurringSearch}
              onChange={(e) => setRecurringSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <TaskTemplateManager
            taskType="RECURRING"
            categories={recurringCategories}
            templates={filteredRecurringTemplates}
          />
        </div>

        {/* משימות פר-אירוע */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center">משימות פר-אירוע</h2>
          
          <div className="flex justify-center gap-3">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowPerEventTemplateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף משימה
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingPerEventCategory(null);
                setShowPerEventCategoryDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף קטגוריה
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant={selectedPerEventCategory === null ? "default" : "outline"}
              onClick={() => setSelectedPerEventCategory(null)}
              size="sm"
            >
              כל הקטגוריות ({filteredPerEventTemplates.length})
            </Button>
            {perEventCategories
              .filter(c => c.is_active)
              .map((cat) => {
                const count = templates.filter(t => t.category_id === cat.id && t.task_type === 'PER_EVENT').length;
                return (
                  <Button
                    key={cat.id}
                    variant={selectedPerEventCategory === cat.id ? "default" : "outline"}
                    onClick={() => setSelectedPerEventCategory(cat.id)}
                    size="sm"
                    className="relative"
                  >
                    {cat.name} ({count})
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPerEventCategory(cat);
                        setShowPerEventCategoryDialog(true);
                      }}
                      className="mr-2 hover:bg-white/20 rounded p-0.5"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </Button>
                );
              })}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
            <Input
              placeholder="חיפוש משימות..."
              value={perEventSearch}
              onChange={(e) => setPerEventSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <TaskTemplateManager
            taskType="PER_EVENT"
            categories={perEventCategories}
            templates={filteredPerEventTemplates}
          />
        </div>

        {/* משימות שוטפות פטי וור */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center">משימות שוטפות פטי וור</h2>
          
          <div className="flex justify-center gap-3">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowPvTemplateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף משימה
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingPvCategory(null);
                setShowPvCategoryDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף קטגוריה
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant={selectedPvCategory === null ? "default" : "outline"}
              onClick={() => setSelectedPvCategory(null)}
              size="sm"
            >
              כל הקטגוריות ({filteredPvTemplates.length})
            </Button>
            {pvCategories
              .filter(c => c.is_active)
              .map((cat) => {
                const count = templates.filter(t => t.category_id === cat.id).length;
                return (
                  <Button
                    key={cat.id}
                    variant={selectedPvCategory === cat.id ? "default" : "outline"}
                    onClick={() => setSelectedPvCategory(cat.id)}
                    size="sm"
                    className="relative"
                  >
                    {cat.name} ({count})
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPvCategory(cat);
                        setShowPvCategoryDialog(true);
                      }}
                      className="mr-2 hover:bg-white/20 rounded p-0.5"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </Button>
                );
              })}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
            <Input
              placeholder="חיפוש משימות..."
              value={pvSearch}
              onChange={(e) => setPvSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <TaskTemplateManager
            taskType="PETI_VOR_RECURRING"
            categories={pvCategories}
            templates={filteredPvTemplates}
          />
        </div>
      </div>

      <TaskCategoryDialog
        category={editingRecurringCategory}
        open={showRecurringCategoryDialog}
        onClose={() => {
          setEditingRecurringCategory(null);
          setShowRecurringCategoryDialog(false);
        }}
        categoryType="RECURRING"
      />

      <TaskCategoryDialog
        category={editingPerEventCategory}
        open={showPerEventCategoryDialog}
        onClose={() => {
          setEditingPerEventCategory(null);
          setShowPerEventCategoryDialog(false);
        }}
        categoryType="PER_EVENT"
      />

      <TaskTemplateDialog
        template={null}
        taskType="RECURRING"
        categories={recurringCategories}
        employees={employees}
        roles={roles}
        open={showRecurringTemplateDialog}
        onClose={() => setShowRecurringTemplateDialog(false)}
      />

      <TaskTemplateDialog
        template={null}
        taskType="PER_EVENT"
        categories={perEventCategories}
        employees={employees}
        roles={roles}
        open={showPerEventTemplateDialog}
        onClose={() => setShowPerEventTemplateDialog(false)}
      />

      <TaskCategoryDialog
        category={editingPvCategory}
        open={showPvCategoryDialog}
        onClose={() => {
          setEditingPvCategory(null);
          setShowPvCategoryDialog(false);
        }}
        categoryType="PETI_VOR_RECURRING"
      />

      <TaskTemplateDialog
        template={null}
        taskType="PETI_VOR_RECURRING"
        categories={pvCategories}
        employees={employees}
        roles={roles}
        open={showPvTemplateDialog}
        onClose={() => setShowPvTemplateDialog(false)}
      />
    </div>
  );
}