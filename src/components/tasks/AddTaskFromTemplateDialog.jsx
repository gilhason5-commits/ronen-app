import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Clock, Bell, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function AddTaskFromTemplateDialog({ open, onClose, eventId, event, staffing }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [startOffsetMinutes, setStartOffsetMinutes] = useState(0);
  
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['taskCategories', 'PER_EVENT'],
    queryFn: async () => {
      const data = await base44.entities.TaskCategory.list();
      return data.filter(c => c.category_type === 'PER_EVENT' && c.is_active);
    },
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['taskTemplates', 'PER_EVENT'],
    queryFn: async () => {
      const data = await base44.entities.TaskTemplate.list();
      return data.filter(t => t.task_type === 'PER_EVENT' && t.is_active);
    },
    initialData: [],
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה נוספה');
      handleClose();
    },
  });

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = searchTerm ? 
      (t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       t.description?.toLowerCase().includes(searchTerm.toLowerCase())) : true;
    const matchesCategory = selectedCategory ? t.category_id === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const availableEmployees = allEmployees.filter(e => 
    e.is_active && staffing.some(s => s.employee_id === e.id)
  );

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setSelectedEmployee("");
    setStartOffsetMinutes(template.start_offset_minutes || 0);
  };

  const handleAddTask = () => {
    if (!selectedTemplate || !selectedEmployee) {
      toast.error('יש לבחור משימה ועובד');
      return;
    }

    const employee = allEmployees.find(e => e.id === selectedEmployee);
    const eventStartTime = new Date(`${event.event_date}T${event.event_time || '00:00'}`);
    const startTime = new Date(eventStartTime.getTime() + startOffsetMinutes * 60000);
    const endTime = new Date(startTime.getTime() + (selectedTemplate.duration_minutes || 60) * 60000);

    // Find escalation employee from template's escalation role
    const escalationRoleId = selectedTemplate.escalation_role_id;
    const escalationEmployee = escalationRoleId 
      ? allEmployees.find(e => e.role_id === escalationRoleId && e.is_active) 
      : null;

    createAssignmentMutation.mutate({
      task_template_id: selectedTemplate.id,
      task_title: selectedTemplate.title,
      task_description: selectedTemplate.description,
      event_id: eventId,
      event_name: event.event_name,
      assigned_to_id: employee.id,
      assigned_to_name: employee.full_name,
      assigned_to_phone: employee.phone_e164 || '',
      computed_start_time: startTime.toISOString(),
      computed_end_time: endTime.toISOString(),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'PENDING',
      reminder_before_start_minutes: selectedTemplate.reminder_before_start_minutes,
      reminder_before_end_minutes: selectedTemplate.reminder_before_end_minutes,
      escalate_to_manager: selectedTemplate.escalate_to_manager_if_not_done,
      escalation_role_id: escalationRoleId || null,
      escalation_role_name: selectedTemplate.escalation_role_name || '',
      escalation_employee_id: escalationEmployee?.id || null,
      escalation_employee_name: escalationEmployee?.full_name || '',
      escalation_employee_phone: escalationEmployee?.phone_e164 || '',
      manager_id: employee.manager_id || null,
      manager_name: employee.manager_name || '',
      manager_phone: '',
      manually_overridden: false
    });
  };

  const handleClose = () => {
    setSearchTerm("");
    setSelectedCategory(null);
    setSelectedTemplate(null);
    setSelectedEmployee("");
    setStartOffsetMinutes(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוספת משימה מהמאגר</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
              <Input
                placeholder="חיפוש משימות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                size="sm"
              >
                כל הקטגוריות ({templates.length})
              </Button>
              {categories.map(cat => {
                const count = templates.filter(t => t.category_id === cat.id).length;
                return (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat.id)}
                    size="sm"
                  >
                    {cat.name} ({count})
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Templates List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedTemplate?.id === template.id 
                    ? 'bg-emerald-50 border-emerald-300' 
                    : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-stone-900">{template.title}</h4>
                    {template.description && (
                      <p className="text-sm text-stone-600 mt-1">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{template.category_name}</Badge>
                      <Badge variant="outline">{template.department}</Badge>
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
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-stone-500">
                לא נמצאו משימות מתאימות
              </div>
            )}
          </div>

          {/* Assignment Configuration */}
          {selectedTemplate && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-stone-900">הגדרות הקצאה</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-2 block">
                    <User className="w-4 h-4 inline mr-1" />
                    עובד מוקצה
                  </label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר עובד" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} - {emp.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-stone-700 mb-2 block">
                    <Bell className="w-4 h-4 inline mr-1" />
                    דקות לפני המשימה לשליחת התראה
                  </label>
                  <Input
                    type="number"
                    value={startOffsetMinutes}
                    onChange={(e) => setStartOffsetMinutes(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  ביטול
                </Button>
                <Button 
                  onClick={handleAddTask}
                  disabled={!selectedEmployee}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  הוסף משימה
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}