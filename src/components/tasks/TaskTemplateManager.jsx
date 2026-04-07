import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Clock, Bell } from "lucide-react";
import TaskTemplateDialog from "./TaskTemplateDialog";
import { toast } from "sonner";

export default function TaskTemplateManager({ taskType, categories }) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['taskTemplates', taskType],
    queryFn: async () => {
      const data = await base44.entities.TaskTemplate.list();
      return data.filter(t => t.task_type === taskType);
    },
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

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskTemplates'] });
      toast.success('משימה נמחקה');
    },
  });

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setShowDialog(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('האם למחוק משימה זו?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-stone-900">{template.title}</h4>
                    <Badge className={template.is_active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-700"}>
                      {template.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-stone-600 mb-3">{template.description}</p>
                  
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{template.category_name}</Badge>
                    <Badge variant="outline">{template.department}</Badge>
                    {template.default_role && (
                      <div className="flex flex-col">
                        <Badge variant="outline">
                          תפקיד: {template.default_role_name || roles.find(r => r.id === template.default_role)?.role_name || template.default_role}
                        </Badge>
                        {(() => {
                          const roleEmployees = employees.filter(e => e.role_id === template.default_role && e.is_active);
                          if (roleEmployees.length > 0) {
                            return (
                              <span className="text-xs text-stone-500 mt-1">
                                {roleEmployees.map(e => e.full_name).join(', ')}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                    {template.duration_minutes && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.duration_minutes} דקות
                      </Badge>
                    )}
                    {(template.reminder_before_start_minutes || template.reminder_before_end_minutes) && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Bell className="w-3 h-3" />
                        תזכורות
                      </Badge>
                    )}
                    {template.escalate_to_manager_if_not_done && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700">
                        העלאה למנהל
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 mr-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-stone-500">אין משימות. צור משימה ראשונה</p>
          </CardContent>
        </Card>
      )}

      <TaskTemplateDialog
        template={selectedTemplate}
        taskType={taskType}
        categories={categories}
        employees={employees}
        roles={roles}
        open={showDialog}
        onClose={handleClose}
      />
    </div>
  );
}