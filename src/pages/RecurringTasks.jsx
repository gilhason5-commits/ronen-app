import React from "react";
import RecurringTaskColumns from "../components/tasks/RecurringTaskColumns.jsx";
import TaskAssignmentList from "../components/tasks/TaskAssignmentList.jsx";

export default function RecurringTasks() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">משימות שוטפות</h1>
        <p className="text-stone-500 mt-1">ניהול והקצאת משימות חוזרות יומיומיות ושבועיות</p>
      </div>

      <RecurringTaskColumns />

      <TaskAssignmentList taskType="RECURRING" />
    </div>
  );
}