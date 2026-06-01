import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import RecurringTaskColumns from "../components/tasks/RecurringTaskColumns.jsx";
import RecurringTasksDailySummary from "../components/tasks/RecurringTasksDailySummary.jsx";
import AddRecurringTaskDialog from "../components/tasks/AddRecurringTaskDialog";

export default function RecurringTasks() {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 ml-2" />
          הוסף משימה מהמאגר
        </Button>
        <div className="text-right">
          <h1 className="text-3xl font-bold text-stone-900">משימות שוטפות</h1>
          <p className="text-stone-500 mt-1">ניהול והקצאת משימות חוזרות יומיומיות ושבועיות</p>
        </div>
      </div>

      <RecurringTaskColumns />

      <RecurringTasksDailySummary />

      <AddRecurringTaskDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}
