import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Phone, Shield, Settings, Briefcase, Edit, Check, X, Trash2, FileText, Upload } from "lucide-react";
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
import AgencyWorkerPool from "../components/staffing/AgencyWorkerPool";
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
  const [uploadingAgreement, setUploadingAgreement] = useState(false);
  const queryClient = useQueryClient();

  const handleAgreementUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('אנא העלה קובץ PDF');
      return;
    }
    setUploadingAgreement(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditForm((prev) => ({ ...prev, work_agreement: file_url }));
    } catch (error) {
      toast.error('העלאת הקובץ נכשלה');
    } finally {
      setUploadingAgreement(false);
      e.target.value = '';
    }
  };

  const agreementFileName = (url) => {
    try {
      const last = decodeURIComponent(url.split('/').pop() || '');
      return last.replace(/^\d+-/, '') || 'הסכם עבודה';
    } catch {
      return 'הסכם עבודה';
    }
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const { data: agencies = [] } = useQuery({
    queryKey: ["staffingAgencies"],
    queryFn: () => base44.entities.StaffingAgency.list("sort_order"),
    initialData: [],
  });

  const { data: agencyWorkers = [] } = useQuery({
    queryKey: ["agencyWorkers"],
    queryFn: () => base44.entities.AgencyWorker.list("full_name"),
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
      whatsapp_enabled: true,
      work_agreement: '',
      note: '',
      pay_type: '',
      hourly_rate: '',
      global_rate: ''
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

  const handleBackupChange = (value) => {
    if (value === '__none__') {
      setEditForm({ ...editForm, backup_employee_id: null, backup_employee_name: '' });
    } else {
      const backup = employees.find(e => e.id === value);
      setEditForm({
        ...editForm,
        backup_employee_id: value,
        backup_employee_name: backup?.full_name || ''
      });
    }
  };

  const renderBackupSelect = () => (
    <Select
      value={editForm.backup_employee_id || "__none__"}
      onValueChange={handleBackupChange}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="עובד חלופי" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">ללא</SelectItem>
        {employees
          .filter(e => e.is_active && e.id !== editingId)
          .map(e => (
            <SelectItem key={e.id} value={e.id}>
              {e.full_name}{e.role_name ? ` (${e.role_name})` : ''}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

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

  const payLabel = (emp) => {
    const parts = [];
    if (emp.pay_type === 'hourly' || emp.pay_type === 'both') parts.push(`${emp.hourly_rate ?? 0} ₪/שעה`);
    if (emp.pay_type === 'global' || emp.pay_type === 'both') parts.push(`${emp.global_rate ?? 0} ₪ גלובלי`);
    return parts.length ? parts.join(' + ') : null;
  };

  // pay_type is derived from which of the two checkboxes are on — 'hourly',
  // 'global', 'both', or '' (cleared) if neither.
  const togglePayFlag = (flag, checked) => {
    const hasHourly = flag === 'hourly' ? checked : (editForm.pay_type === 'hourly' || editForm.pay_type === 'both');
    const hasGlobal = flag === 'global' ? checked : (editForm.pay_type === 'global' || editForm.pay_type === 'both');
    const pay_type = hasHourly && hasGlobal ? 'both' : hasHourly ? 'hourly' : hasGlobal ? 'global' : '';
    setEditForm({ ...editForm, pay_type });
  };

  const renderEditFields = (excludeEmployeeId) => (
    <>
      <Input
        value={editForm.full_name}
        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
        placeholder="שם מלא"
        className="font-semibold"
      />
      <Input
        value={editForm.phone_e164}
        onChange={(e) => setEditForm({ ...editForm, phone_e164: e.target.value })}
        placeholder="+972501234567"
      />
      <Select value={editForm.role_id || "__none__"} onValueChange={handleRoleChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="תפקיד" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">ללא תפקיד</SelectItem>
          {roles.filter(r => r.is_active).map(role => {
            const taken = employees.some(e => e.is_active && e.role_id === role.id && e.id !== excludeEmployeeId);
            return (
              <SelectItem key={role.id} value={role.id} disabled={taken}>
                {role.role_name} ({role.department_name || '-'}){taken ? ' ✓' : ''}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="text-sm text-stone-600">מחלקה: {editForm.department_name || '-'}</p>
      {renderBackupSelect()}
      {renderPayFields()}
      <div className="space-y-1.5 border border-stone-200 rounded-md p-2">
        <p className="text-xs font-medium text-stone-500">הסכם עבודה</p>
        {editForm.work_agreement ? (
          <div className="flex items-center gap-2">
            <a
              href={editForm.work_agreement}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm text-blue-600 hover:underline truncate"
            >
              {agreementFileName(editForm.work_agreement)}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setEditForm({ ...editForm, work_agreement: '' })}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleAgreementUpload}
              disabled={uploadingAgreement}
              className="hidden"
              id="work-agreement-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('work-agreement-upload')?.click()}
              disabled={uploadingAgreement}
            >
              <Upload className="w-4 h-4 ml-2" />
              {uploadingAgreement ? 'מעלה...' : 'העלה PDF'}
            </Button>
          </div>
        )}
      </div>
      <Input
        value={editForm.note || ''}
        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
        placeholder="הערה"
      />
      <div className="flex items-center gap-4 text-sm pt-1">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={!!editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
          פעיל
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={!!editForm.whatsapp_enabled} onChange={(e) => setEditForm({ ...editForm, whatsapp_enabled: e.target.checked })} />
          WhatsApp
        </label>
      </div>
    </>
  );

  const renderPayFields = () => {
    const isHourly = editForm.pay_type === 'hourly' || editForm.pay_type === 'both';
    const isGlobal = editForm.pay_type === 'global' || editForm.pay_type === 'both';
    return (
      <div className="space-y-2 border border-stone-200 rounded-md p-2">
        <p className="text-xs font-medium text-stone-500">סוג שכר</p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm shrink-0 w-16">
            <input type="checkbox" checked={isHourly} onChange={(e) => togglePayFlag('hourly', e.target.checked)} />
            שעתי
          </label>
          {isHourly && (
            <Input
              type="number"
              placeholder="₪ לשעה"
              value={editForm.hourly_rate ?? ''}
              onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm shrink-0 w-16">
            <input type="checkbox" checked={isGlobal} onChange={(e) => togglePayFlag('global', e.target.checked)} />
            גלובלי
          </label>
          {isGlobal && (
            <Input
              type="number"
              placeholder="₪ גלובלי"
              value={editForm.global_rate ?? ''}
              onChange={(e) => setEditForm({ ...editForm, global_rate: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            />
          )}
        </div>
      </div>
    );
  };

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees">עובדים</TabsTrigger>
          <TabsTrigger value="roles">תפקידים</TabsTrigger>
          <TabsTrigger value="agencies">סוכנויות כוח אדם</TabsTrigger>
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
                <Plus className="w-4 h-4 ml-2" />
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
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {editingId === 'new' && (
                <Card className="border-emerald-400 border-2">
                  <CardContent className="p-4 space-y-3">
                    {renderEditFields(null)}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => handleSave('new')} className="bg-emerald-600 hover:bg-emerald-700">
                        <Check className="w-4 h-4 ml-1" /> שמירה
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X className="w-4 h-4 ml-1" /> ביטול
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {filteredEmployees.map((employee) => (
                <Card key={employee.id} className={editingId === employee.id ? "border-emerald-400 border-2" : "hover:shadow-md transition-shadow"}>
                  <CardContent className="p-4 space-y-3">
                    {editingId === employee.id ? (
                      <>
                        {renderEditFields(employee.id)}
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => handleSave(employee.id)} className="bg-emerald-600 hover:bg-emerald-700">
                            <Check className="w-4 h-4 ml-1" /> שמירה
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleCancel}>
                            <X className="w-4 h-4 ml-1" /> ביטול
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg text-stone-900 truncate">{employee.full_name}</h3>
                            <p className="text-sm text-stone-500 font-mono">{employee.phone_e164 || '-'}</p>
                          </div>
                          <Badge className={employee.is_active ? "bg-emerald-100 text-emerald-700 shrink-0" : "bg-stone-100 text-stone-700 shrink-0"}>
                            {employee.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {employee.role_name && <Badge variant="outline">{employee.role_name}</Badge>}
                          {employee.department_name && <Badge className="bg-blue-100 text-blue-700">{employee.department_name}</Badge>}
                          <Badge className={employee.whatsapp_enabled ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-700"}>
                            WhatsApp {employee.whatsapp_enabled ? 'מופעל' : 'כבוי'}
                          </Badge>
                        </div>

                        <div className="text-sm text-stone-600 space-y-1">
                          {employee.manager_name && <p>מנהל: {employee.manager_name}</p>}
                          {employee.backup_employee_name && <p>עובד חלופי: {employee.backup_employee_name}</p>}
                          {payLabel(employee) && <p className="font-medium text-stone-900">שכר: {payLabel(employee)}</p>}
                        </div>

                        {(employee.work_agreement || employee.note) && (
                          <div className="text-xs text-stone-500 border-t border-stone-100 pt-2 space-y-1">
                            {employee.work_agreement && (
                              <p className="truncate">
                                הסכם:{' '}
                                <a
                                  href={employee.work_agreement}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {agreementFileName(employee.work_agreement)}
                                </a>
                              </p>
                            )}
                            {employee.note && <p className="truncate" title={employee.note}>הערה: {employee.note}</p>}
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(employee)}>
                            <Edit className="w-4 h-4 ml-1" />
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
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredEmployees.length === 0 && editingId !== 'new' && (
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
                  <Plus className="w-4 h-4 ml-2" />
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
              <Plus className="w-4 h-4 ml-2" />
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

        <TabsContent value="agencies" className="space-y-6">
          <div>
            <h2 className="text-xl font-bold">מאגרי עובדים לפי סוכנות</h2>
            <p className="text-sm text-stone-500 mt-1">
              מאגר זה משמש לבחירת עובדים בעת סימון נוכחות אירוע — הוספה, שינוי שם או הסרה כאן משפיעה שם.
            </p>
          </div>
          <AgencyWorkerPool agencies={agencies} workers={agencyWorkers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}