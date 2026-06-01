import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import PetiVorRecurringTaskColumns from "../components/tasks/PetiVorRecurringTaskColumns";
import AddPetiVorRecurringTaskDialog from "../components/tasks/AddPetiVorRecurringTaskDialog";

const PETI_VOR_DEPT_ID = "6980a31fad76459583167535";

export default function PetiVorRecurringTasks() {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="text-right">
          <h1 className="text-3xl font-bold text-stone-900">משימות שוטפות פטי וור</h1>
          <p className="text-stone-500 mt-1">ניהול והקצאת משימות חוזרות למחלקת פטי וור</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 ml-2" />
          הוסף משימה מהמאגר
        </Button>
      </div>

      <PetiVorRecurringTaskColumns departmentId={PETI_VOR_DEPT_ID} />

      <AddPetiVorRecurringTaskDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        departmentId={PETI_VOR_DEPT_ID}
      />
    </div>
  );
}
