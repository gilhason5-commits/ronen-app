import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import TaskTemplateManager from "../components/tasks/TaskTemplateManager";
import TaskTemplateDialog from "../components/tasks/TaskTemplateDialog";

export default function TaskManagement() {
  const [recurringSearch, setRecurringSearch] = useState("");
  const [perEventSearch, setPerEventSearch] = useState("");
  const [pvSearch, setPvSearch] = useState("");
  const [showRecurringTemplateDialog, setShowRecurringTemplateDialog] = useState(false);
  const [showPerEventTemplateDialog, setShowPerEventTemplateDialog] = useState(false);
  const [showPvTemplateDialog, setShowPvTemplateDialog] = useState(false);

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

  const matchSearch = (template, term) => {
    if (!term) return true;
    const q = term.toLowerCase();
    return (template.title?.toLowerCase().includes(q))
      || (template.description?.toLowerCase().includes(q));
  };

  const filteredRecurringTemplates = templates.filter(
    (t) => t.task_type === 'RECURRING' && matchSearch(t, recurringSearch),
  );
  const filteredPerEventTemplates = templates.filter(
    (t) => t.task_type === 'PER_EVENT' && matchSearch(t, perEventSearch),
  );
  const filteredPvTemplates = templates.filter(
    (t) => t.task_type === 'PETI_VOR_RECURRING' && matchSearch(t, pvSearch),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">ניהול משימות</h1>
        <p className="text-stone-500 mt-1">הגדרת משימות</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* משימות שוטפות */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center">משימות שוטפות</h2>

          <div className="flex justify-center">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowRecurringTemplateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף משימה
            </Button>
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
            categories={[]}
            templates={filteredRecurringTemplates}
          />
        </div>

        {/* משימות פר-אירוע */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center">משימות פר-אירוע</h2>

          <div className="flex justify-center">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowPerEventTemplateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף משימה
            </Button>
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
            categories={[]}
            templates={filteredPerEventTemplates}
          />
        </div>

        {/* משימות שוטפות פטי וור */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center">משימות שוטפות פטי וור</h2>

          <div className="flex justify-center">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowPvTemplateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              הוסף משימה
            </Button>
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
            categories={[]}
            templates={filteredPvTemplates}
          />
        </div>
      </div>

      <TaskTemplateDialog
        template={null}
        taskType="RECURRING"
        categories={[]}
        employees={employees}
        roles={roles}
        open={showRecurringTemplateDialog}
        onClose={() => setShowRecurringTemplateDialog(false)}
      />

      <TaskTemplateDialog
        template={null}
        taskType="PER_EVENT"
        categories={[]}
        employees={employees}
        roles={roles}
        open={showPerEventTemplateDialog}
        onClose={() => setShowPerEventTemplateDialog(false)}
      />

      <TaskTemplateDialog
        template={null}
        taskType="PETI_VOR_RECURRING"
        categories={[]}
        employees={employees}
        roles={roles}
        open={showPvTemplateDialog}
        onClose={() => setShowPvTemplateDialog(false)}
      />
    </div>
  );
}
