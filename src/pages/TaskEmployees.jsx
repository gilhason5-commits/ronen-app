import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Phone, Shield, Settings, Briefcase, Edit, Check, X, Trash2, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DepartmentDialog from "../components/tasks/DepartmentDialog";
import RoleDialog from "../components/tasks/RoleDialog";
import RoleProceduresDialog from "../components/tasks/RoleProceduresDialog";
import { toast } from "sonner";

export default function TaskEmployees() {
  const [activeTab, setActiveTab] = useState("employees");
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [proceduresRole, setProceduresRole] = useState(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
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

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaskEmployee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskEmployees'] });
      toast.success('עובד עודכן');
      setEditingId(null);
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskEmployee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskEmployees'] });
      toast.success('עובד נוצר');
      setEditingId(null);
    },
  });

  const filteredEmployees = employees.filter(emp => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = emp.full_name?.toLowerCase().includes(search) || 
           emp.phone_e164?.toLowerCase().includes(search) ||
           emp.role?.toLowerCase().includes(search);
    const matchesDepartment = !selectedDeptFilter || emp.department_id === selectedDeptFilter;
    return matchesSearch && matchesDepartment;
  });

  const activeCount = employees.filter(e => e.is_active).length;
  const whatsappEnabledCount = employees.filter(e => e.whatsapp_enabled).length;

  const handleEdit = (employee) => {
    setEditingId(employee.id);
    setEditForm(employee);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setEditForm({
      full_name: '',
      phone_e164: '',
      department_id: '',
      department_name: '',
      role_id: '',
      role_name: '',
      is_active: true,
      whatsapp_enabled: true
    });
  };

  const handleSave = (id) => {
    let dataToSave = { ...editForm };
    // Validate unique role
    if (dataToSave.role_id) {
      const roleTaken = employees.some(e => e.is_active && e.role_id === dataToSave.role_id && e.id !== id);
      if (roleTaken) {
        toast.error('תפקיד זה כבר מוקצה לעובד אחר');
        return;
      }
    }
    // Derive department from role
    if (dataToSave.role_id) {
      const role = roles.find(r => r.id === dataToSave.role_id);
      if (role) {
        dataToSave.department_id = role.department_id || '';
        dataToSave.department_name = role.department_name || '';
      }
    } else {
      dataToSave.department_id = '';
      dataToSave.department_name = '';
    }
    if (id === 'new') {
      createEmployeeMutation.mutate(dataToSave);
    } else {
      updateEmployeeMutation.mutate({ id, data: dataToSave });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleRoleChange = (roleId) => {
    if (roleId === '__none__') {
      setEditForm({
        ...editForm,
        role_id: '',
        role_name: '',
        department_id: '',
        department_name: ''
      });
    } else {
      const role = roles.find(r => r.id === roleId);
      setEditForm({
        ...editForm,
        role_id: roleId,
        role_name: role?.role_name || '',
        department_id: role?.department_id || '',
        department_name: role?.department_name || ''
      });
    }
  };

  const deleteDeptMutation = useMutation({
    mutationFn: (id) => base44.entities.Department.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('מחלקה נמחקה');
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskEmployee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskEmployees'] });
      toast.success('עובד נמחק');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => base44.entities.EmployeeRole.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeRoles'] });
      toast.success('תפקיד נמחק');
    },
  });

  const departmentColors = {
    "שירות": "bg-blue-100 text-blue-700",
    "בר": "bg-purple-100 text-purple-700",
    "מטבח": "bg-orange-100 text-orange-700",
    "כספים": "bg-emerald-100 text-emerald-700",
    "הנהלה": "bg-red-100 text-red-700",
    "אחר": "bg-stone-100 text-stone-700"
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">ניהול עובדים</h1>
          <p className="text-stone-500 mt-1">ניהול צוות והרשאות למערכת המשימות</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="employees">עובדים</TabsTrigger>
          <TabsTrigger value="roles">תפקידים</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">סה"כ עובדים</p>
                <p className="text-2xl font-bold text-stone-900">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">עובדים פעילים</p>
                <p className="text-2xl font-bold text-stone-900">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">WhatsApp מופעל</p>
                <p className="text-2xl font-bold text-stone-900">{whatsappEnabledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
                <Input
                  placeholder="חיפוש עובדים..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button onClick={handleAddNew} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                עובד חדש
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedDeptFilter === null ? "default" : "outline"}
                onClick={() => setSelectedDeptFilter(null)}
                size="sm"
              >
                כל המחלקות ({employees.length})
              </Button>
              {departments
                .filter(d => d.is_active)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map((dept) => {
                  const count = employees.filter(e => e.department_id === dept.id).length;
                  return (
                    <Button
                      key={dept.id}
                      variant={selectedDeptFilter === dept.id ? "default" : "outline"}
                      onClick={() => setSelectedDeptFilter(dept.id)}
                      size="sm"
                    >
                      {dept.name} ({count})
                    </Button>
                  );
                })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">שם מלא</th>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">טלפון <span className="font-normal text-stone-400">(+972...)</span></th>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">תפקיד</th>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">מחלקה</th>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">מנהל</th>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">סטטוס</th>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">WhatsApp</th>
                  <th className="text-right p-3 text-sm font-semibold text-stone-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {editingId === 'new' && (
                  <tr className="bg-blue-50">
                    <td className="p-3">
                      <Input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                        placeholder="שם מלא"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        value={editForm.phone_e164}
                        onChange={(e) => setEditForm({...editForm, phone_e164: e.target.value})}
                        placeholder="+972501234567"
                      />
                    </td>
                    <td className="p-3">
                      <Select
                        value={editForm.role_id || "__none__"}
                        onValueChange={handleRoleChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="תפקיד" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">ללא תפקיד</SelectItem>
                          {roles.filter(r => r.is_active).map(role => {
                            const taken = employees.some(e => e.is_active && e.role_id === role.id);
                            return (
                              <SelectItem key={role.id} value={role.id} disabled={taken}>
                                {role.role_name} ({role.department_name || '-'}){taken ? ' ✓' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-stone-600">{editForm.department_name || '-'}</span>
                    </td>
                    <td className="p-3">-</td>
                    <td className="p-3">-</td>
                    <td className="p-3">-</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave('new')}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className={editingId === employee.id ? "bg-blue-50" : "hover:bg-stone-50"}>
                    {editingId === employee.id ? (
                      <>
                        <td className="p-3">
                          <Input
                            value={editForm.full_name}
                            onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={editForm.phone_e164}
                            onChange={(e) => setEditForm({...editForm, phone_e164: e.target.value})}
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={editForm.role_id || "__none__"}
                            onValueChange={handleRoleChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="תפקיד" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">ללא תפקיד</SelectItem>
                              {roles.filter(r => r.is_active).map(role => {
                                const taken = employees.some(e => e.is_active && e.role_id === role.id && e.id !== editingId);
                                return (
                                  <SelectItem key={role.id} value={role.id} disabled={taken}>
                                    {role.role_name} ({role.department_name || '-'}){taken ? ' ✓' : ''}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-stone-600">{editForm.department_name || '-'}</span>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-stone-600">{employee.manager_name || '-'}</p>
                        </td>
                        <td className="p-3">
                          <Badge className={employee.is_active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-700"}>
                            {employee.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={employee.whatsapp_enabled ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-700"}>
                            {employee.whatsapp_enabled ? 'מופעל' : 'כבוי'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(employee.id)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancel}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3">
                          <p className="font-medium text-stone-900">{employee.full_name}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-stone-600 font-mono">{employee.phone_e164}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-stone-600">{employee.role_name || '-'}</p>
                        </td>
                        <td className="p-3">
                          <Badge className="bg-blue-100 text-blue-700">
                            {employee.department_name || '-'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-stone-600">{employee.manager_name || '-'}</p>
                        </td>
                        <td className="p-3">
                          <Badge className={employee.is_active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-700"}>
                            {employee.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={employee.whatsapp_enabled ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-700"}>
                            {employee.whatsapp_enabled ? 'מופעל' : 'כבוי'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(employee)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              ערוך
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm(`האם למחוק את העובד ${employee.full_name}?`)) {
                                  deleteEmployeeMutation.mutate(employee.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEmployees.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">לא נמצאו עובדים</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>מחלקות</CardTitle>
                <Button onClick={() => { setSelectedDepartment(null); setShowDeptDialog(true); }} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  מחלקה חדשה
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedDeptFilter === null ? "default" : "outline"}
                  onClick={() => setSelectedDeptFilter(null)}
                  size="sm"
                >
                  הכל ({roles.length})
                </Button>
                {departments
                  .filter(d => d.is_active)
                  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                  .map((dept) => {
                    const count = roles.filter(r => r.department_id === dept.id).length;
                    return (
                      <Button
                        key={dept.id}
                        variant={selectedDeptFilter === dept.id ? "default" : "outline"}
                        onClick={() => setSelectedDeptFilter(dept.id)}
                        size="sm"
                        className="relative"
                      >
                        {dept.name} ({count})
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDepartment(dept);
                            setShowDeptDialog(true);
                          }}
                          className="mr-2 hover:bg-white/20 rounded p-0.5"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                      </Button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <DepartmentDialog
            department={selectedDepartment}
            open={showDeptDialog}
            onClose={() => { setSelectedDepartment(null); setShowDeptDialog(false); }}
          />
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">ניהול תפקידים</h2>
            <Button onClick={() => { setSelectedRole(null); setTimeout(() => setShowRoleDialog(true), 0); }}>
              <Plus className="w-4 h-4 mr-2" />
              תפקיד חדש
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles
              .filter(role => !selectedDeptFilter || role.department_id === selectedDeptFilter)
              .map((role) => (
              <Card key={role.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-stone-900">{role.role_name}</h3>
                      <p className="text-sm text-stone-600 mt-1">מחלקה: {role.department_name || 'לא משויך'}</p>
                      {role.description && <p className="text-sm text-stone-500 mt-1">{role.description}</p>}
                      <Badge className={role.is_active ? "bg-emerald-100 text-emerald-700 mt-2" : "bg-stone-100 text-stone-700 mt-2"}>
                        {role.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedRole(role); setShowRoleDialog(true); }}>
                      עריכה
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      if (window.confirm('האם למחוק תפקיד זה?')) deleteRoleMutation.mutate(role.id);
                    }}>
                      מחק
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setProceduresRole(role)}>
                      <FileText className="w-4 h-4 ml-1" />
                      נהלים
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <RoleDialog
            role={selectedRole}
            departments={departments}
            open={showRoleDialog}
            onClose={() => { setSelectedRole(null); setShowRoleDialog(false); }}
          />

          <RoleProceduresDialog
            role={proceduresRole}
            open={!!proceduresRole}
            onClose={() => setProceduresRole(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}