import React from "react";
import PetiVorRecurringTaskColumns from "../components/tasks/PetiVorRecurringTaskColumns";
import PetiVorTaskAssignmentList from "../components/tasks/PetiVorTaskAssignmentList";

const PETI_VOR_DEPT_ID = "6980a31fad76459583167535";

export default function PetiVorRecurringTasks() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">משימות שוטפות פטי וור</h1>
        <p className="text-stone-500 mt-1">ניהול והקצאת משימות חוזרות למחלקת פטי וור</p>
      </div>

      <PetiVorRecurringTaskColumns departmentId={PETI_VOR_DEPT_ID} />

      <PetiVorTaskAssignmentList departmentId={PETI_VOR_DEPT_ID} />
    </div>
  );
}