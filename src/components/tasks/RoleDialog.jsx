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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function RoleDialog({ role, departments, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    role_name: '',
    department_id: '',
    department_name: '',
    description: '',
    is_active: true,
    is_manager: false,
    manages_department_id: '',
    manages_department_name: ''
  });

  useEffect(() => {
    if (role) {
      setFormData({
        role_name: role.role_name || '',
        department_id: role.department_id || '',
        department_name: role.department_name || '',
        description: role.description || '',
        is_active: role.is_active !== false,
        is_manager: role.is_manager || false,
        manages_department_id: role.manages_department_id || '',
        manages_department_name: role.manages_department_name || ''
      });
    } else {
      setFormData({
        role_name: '',
        department_id: '',
        department_name: '',
        description: '',
        is_active: true,
        is_manager: false,
        manages_department_id: '',
        manages_department_name: ''
      });
    }
  }, [role]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (role?.id) {
        return base44.entities.EmployeeRole.update(role.id, data);
      }
      return base44.entities.EmployeeRole.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeRoles'] });
      toast.success(role ? 'תפקיד עודכן' : 'תפקיד נוצר');
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.is_manager && !formData.manages_department_id) {
      toast.error("נא לבחור מחלקה לניהול");
      return;
    }

    const submitData = { ...formData };
    if (!submitData.is_manager) {
      submitData.manages_department_id = '';
      submitData.manages_department_name = '';
    }

    saveMutation.mutate(submitData);
  };

  const handleDepartmentChange = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    setFormData({
      ...formData,
      department_id: deptId,
      department_name: dept?.name || ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? 'עריכת תפקיד' : 'תפקיד חדש'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>שם התפקיד *</Label>
            <Input
              value={formData.role_name}
              onChange={(e) => setFormData({...formData, role_name: e.target.value})}
              required
            />
          </div>

          <div>
            <Label>מחלקה *</Label>
            <Select
              value={formData.department_id}
              onValueChange={handleDepartmentChange}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר מחלקה" />
              </SelectTrigger>
              <SelectContent>
                {departments.filter(d => d.is_active).map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>תיאור</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
            />
            <Label>תפקיד פעיל</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_manager}
              onCheckedChange={(checked) => setFormData({...formData, is_manager: checked})}
            />
            <Label>תפקיד מנהל</Label>
          </div>

          {formData.is_manager && (
            <div>
              <Label>מחלקה לניהול *</Label>
              <Select
                value={formData.manages_department_id}
                onValueChange={(deptId) => {
                  const dept = departments.find(d => d.id === deptId);
                  setFormData({
                    ...formData,
                    manages_department_id: deptId,
                    manages_department_name: dept?.name || ''
                  });
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מחלקה" />
                </SelectTrigger>
                <SelectContent>
                  {departments.filter(d => d.is_active).map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
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
              {role ? 'עדכון' : 'יצירה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}