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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function TaskTemplateDialog({ template, taskType, categories, employees, roles, open, onClose }) {
  const queryClient = useQueryClient();
  
  // Find employees that match the selected role
  const getEmployeesForRole = (roleId) => {
    if (!roleId || !employees) return [];
    return employees.filter(emp => emp.role_id === roleId && emp.is_active);
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    category_name: '',
    task_type: taskType,
    department: '',
    default_role: '',
    manager_editable: false,
    is_active: true,
    reminder_before_start_minutes: 10,
    reminder_before_end_minutes: 10,
    escalate_to_manager_if_not_done: true,
    escalation_role_id: '',
    escalation_role_name: '',
    schedule_rule: '',
    anchor: 'EVENT_START',
    start_offset_minutes: 0,
    duration_minutes: 30
  });

  useEffect(() => {
    if (template) {
      setFormData(template);
    } else {
      setFormData({
        title: '',
        description: '',
        category_id: '',
        category_name: '',
        task_type: taskType,
        department: '',
        default_role: '',
        manager_editable: false,
        is_active: true,
        reminder_before_start_minutes: 10,
        reminder_before_end_minutes: 10,
        escalate_to_manager_if_not_done: true,
        escalation_role_id: '',
        escalation_role_name: '',
        schedule_rule: '',
        anchor: 'EVENT_START',
        start_offset_minutes: 0,
        duration_minutes: 30
      });
    }
  }, [template, taskType]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (template?.id) {
        return base44.entities.TaskTemplate.update(template.id, data);
      }
      return base44.entities.TaskTemplate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskTemplates'] });
      toast.success(template ? 'תבנית עודכנה' : 'תבנית נוצרה');
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleCategoryChange = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    setFormData({
      ...formData,
      category_id: categoryId,
      category_name: category?.name || '',
      department: category?.department || ''
    });
  };

  const isRecurring = taskType === 'RECURRING' || taskType === 'PETI_VOR_RECURRING';
  const isPerEvent = taskType === 'PER_EVENT';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'עריכת תבנית' : 'תבנית חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>כותרת *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          <div>
            <Label>תיאור</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label>קטגוריה *</Label>
            <Select
              value={formData.category_id}
              onValueChange={handleCategoryChange}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name} ({cat.department})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isPerEvent && (
            <div className="pt-4 border-t">
              <Label>תפקיד מבצע</Label>
              <p className="text-xs text-stone-500 mb-1">כל העובדים שממלאים תפקיד זה יוקצו אוטומטית למשימה</p>
              <Select
                value={formData.default_role || ''}
                onValueChange={(value) => {
                  const role = roles?.find(r => r.id === value);
                  setFormData({
                    ...formData,
                    default_role: value,
                    default_role_name: role?.role_name || ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תפקיד מבצע" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.role_name}
                      {(() => {
                        const emps = employees?.filter(e => e.role_id === role.id && e.is_active);
                        return emps?.length > 0 ? ` (${emps.map(e => e.full_name).join(', ')})` : '';
                      })()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isPerEvent && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>היסט מתחילת אירוע (דקות)</Label>
                <p className="text-xs text-stone-500 mb-1">30 = 30 דק' אחרי, -30 = 30 דק' לפני</p>
                <Input
                  type="number"
                  step={5}
                  value={formData.start_offset_minutes}
                  onChange={(e) => setFormData({...formData, start_offset_minutes: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>משך (דקות)</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          )}

          {isRecurring && (
            <div>
              <Label>משך משימה (דקות)</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})}
              />
            </div>
          )}

          <div>
            <Label>תזכורת לפני התחלה (דקות)</Label>
            <Input
              type="number"
              step={5}
              value={formData.reminder_before_start_minutes}
              onChange={(e) => setFormData({...formData, reminder_before_start_minutes: parseInt(e.target.value) || 0})}
            />
          </div>

          {isPerEvent && (
            <div className="pt-4 border-t">
              <Label>תפקיד מנהל אסקלציה</Label>
              <p className="text-xs text-stone-500 mb-1">אם המשימה לא בוצעה, תישלח התראה לעובד בתפקיד זה</p>
              <Select
                value={formData.escalation_role_id || ''}
                onValueChange={(value) => {
                  const role = roles?.find(r => r.id === value);
                  setFormData({
                    ...formData,
                    escalation_role_id: value,
                    escalation_role_name: role?.role_name || '',
                    escalate_to_manager_if_not_done: true
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תפקיד אסקלציה" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              {template ? 'עדכון' : 'יצירה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}