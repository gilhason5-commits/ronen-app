import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function EmployeeDialog({ employee, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: '',
    phone_e164: '',
    role_id: '',
    role_name: '',
    department_id: '',
    department_name: '',
    is_active: true,
    whatsapp_enabled: true
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    initialData: [],
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: () => base44.entities.EmployeeRole.list(),
    initialData: [],
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    } else {
      setFormData({
        full_name: '',
        phone_e164: '',
        role_id: '',
        role_name: '',
        department_id: '',
        department_name: '',
        is_active: true,
        whatsapp_enabled: true
      });
    }
  }, [employee, open]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (employee?.id) {
        return base44.entities.TaskEmployee.update(employee.id, data);
      }
      return base44.entities.TaskEmployee.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskEmployees'] });
      toast.success(employee ? 'עובד עודכן' : 'עובד נוצר');
      onClose();
    },
    onError: () => {
      toast.error('שמירת עובד נכשלה');
    }
  });

  const validatePhone = (phone) => {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  };

  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    const errors = [];
    if (!formData.full_name?.trim()) errors.push('שם מלא');
    const cleanPhone = (formData.phone_e164 || '').replace(/[^\d+]/g, '');
    if (!cleanPhone) errors.push('טלפון');
    else if (!validatePhone(cleanPhone)) errors.push('טלפון לא תקין (נדרש +972...)');
    if (errors.length > 0) {
      setValidationError(errors.join(' | '));
      return;
    }
    setValidationError('');

    // Prevent assigning the same role to two different employees
    if (formData.role_id) {
      const existingWithRole = allEmployees.find(
        emp => emp.role_id === formData.role_id && emp.is_active && emp.id !== employee?.id
      );
      if (existingWithRole) {
        const roleName = roles.find(r => r.id === formData.role_id)?.role_name || 'התפקיד';
        toast.error(`התפקיד "${roleName}" כבר משויך ל${existingWithRole.full_name}`);
        return;
      }
    }

    let dataToSave = {
      ...formData,
      phone_e164: cleanPhone,
      is_active: true,
      whatsapp_enabled: true
    };

    // If role selected, derive department and find manager
    if (formData.role_id) {
      const selectedRole = roles.find(r => r.id === formData.role_id);
      if (selectedRole) {
        dataToSave.department_id = selectedRole.department_id || '';
        dataToSave.department_name = selectedRole.department_name || '';

        if (selectedRole.is_manager && selectedRole.manages_department_id === selectedRole.department_id) {
          dataToSave.manager_id = '';
          dataToSave.manager_name = '';
        } else {
          const managerRole = roles.find(r => 
            r.is_manager && r.manages_department_id === selectedRole.department_id
          );
          if (managerRole) {
            const manager = allEmployees.find(emp => 
              emp.role_id === managerRole.id && emp.is_active
            );
            if (manager) {
              dataToSave.manager_id = manager.id;
              dataToSave.manager_name = manager.full_name;
            }
          }
        }
      }
    } else {
      // No role - clear department
      dataToSave.department_id = '';
      dataToSave.department_name = '';
      dataToSave.manager_id = '';
      dataToSave.manager_name = '';
    }

    // Clean UUID fields
    ['role_id', 'department_id', 'manager_id'].forEach(k => {
      if (!dataToSave[k]) dataToSave[k] = null;
    });

    saveMutation.mutate(dataToSave);
  };

  const handleRoleChange = (roleId) => {
    if (roleId === '__none__') {
      setFormData({
        ...formData,
        role_id: '',
        role_name: '',
        department_id: '',
        department_name: ''
      });
    } else {
      const role = roles.find(r => r.id === roleId);
      setFormData({
        ...formData,
        role_id: roleId,
        role_name: role?.role_name || '',
        department_id: role?.department_id || '',
        department_name: role?.department_name || ''
      });
    }
  };

  const activeRoles = roles.filter(r => r.is_active);
  const selectedRole = roles.find(r => r.id === formData.role_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? 'עריכת עובד' : 'עובד חדש'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>שם מלא *</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              required
            />
          </div>

          <div>
            <Label>מספר טלפון (E.164) *</Label>
            <Input
              value={formData.phone_e164}
              onChange={(e) => setFormData({...formData, phone_e164: e.target.value})}
              placeholder="+972501234567"
              required
            />
            <p className="text-xs text-stone-500 mt-1">פורמט: +972501234567</p>
          </div>

          <div>
            <Label>תפקיד</Label>
            <Select
              value={formData.role_id || "__none__"}
              onValueChange={handleRoleChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר תפקיד" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא תפקיד</SelectItem>
                {activeRoles.map(role => {
                  const takenBy = allEmployees.find(
                    emp => emp.role_id === role.id && emp.is_active && emp.id !== employee?.id
                  );
                  return (
                    <SelectItem key={role.id} value={role.id} disabled={!!takenBy}>
                      {role.role_name} ({role.department_name || 'ללא מחלקה'})
                      {takenBy ? ` — תפוס ע"י ${takenBy.full_name}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedRole && (
            <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-600">
              <span className="font-medium">מחלקה:</span> {selectedRole.department_name || 'לא מוגדרת'}
            </div>
          )}

          {validationError && (
            <p className="text-sm text-red-600 text-center">{validationError}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              {employee ? 'עדכון' : 'יצירה'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}