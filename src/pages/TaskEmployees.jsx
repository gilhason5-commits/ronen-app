import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSingleFlightMutation } from "@/lib/useSingleFlightMutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Phone, Shield, Settings, Briefcase, Edit, Check, X, Trash2, FileText, Upload, History } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import EmployeeHistoryDialog from "../components/tasks/EmployeeHistoryDialog";
import { WAITERS_DEPARTMENT, isWaiterEmployee, orderAgenciesForDisplay } from "@/lib/staffingEngine";
import { toast } from "sonner";
import LoadingState from "@/components/utils/LoadingState";

// Segmented either/or buttons used across the card (selected = filled green).
const Seg = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-10 flex-1 min-w-[4.5rem] rounded-md border px-3 text-sm transition-colors ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'}`}
  >
    {children}
  </button>
);

const Section = ({ title, children }) => (
  <section className="rounded-xl border border-emerald-100 overflow-hidden">
    <h3 className="bg-emerald-50 px-4 py-2.5 text-lg font-bold text-emerald-700">{title}</h3>
    <div className="p-4 space-y-3 bg-white">{children}</div>
  </section>
);

// Label on the right, control on the left — one cell of the card's grid.
const Field = ({ label, children, className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <span className="w-24 shrink-0 text-sm text-stone-700">{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

export default function TaskEmployees() {
  const [activeTab, setActiveTab] = useState("employees");
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [proceduresRole, setProceduresRole] = useState(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState(null);
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [uploadingAgreement, setUploadingAgreement] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  });

  const { data: agencies = [] } = useQuery({
    queryKey: ["staffingAgencies"],
    queryFn: () => base44.entities.StaffingAgency.list("sort_order"),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: () => base44.entities.EmployeeRole.list(),
  });

  // A waiter's name is copied onto their EventShift rows and locked
  // TipAllocation rows, so a rename is pushed there too — otherwise past
  // attendance and tips would keep showing the old name.
  const updateEmployeeMutation = useSingleFlightMutation({
    mutationFn: async ({ id, data }) => {
      const before = employees.find(e => e.id === id);
      const updated = await base44.entities.TaskEmployee.update(id, data);
      const newName = data.full_name?.trim();
      if (before && newName && newName !== before.full_name && (isWaiterEmployee(before) || isWaiterEmployee(updated))) {
        const shifts = await base44.entities.EventShift.filter({ worker_id: id });
        await Promise.all(shifts.map(s => base44.entities.EventShift.update(s.id, { worker_name: newName })));
        const allocations = await base44.entities.TipAllocation.filter({ worker_name: before.full_name });
        await Promise.all(
          allocations
            .filter(a => (a.agency_name || '') === (before.agency_name || ''))
            .map(a => base44.entities.TipAllocation.update(a.id, { worker_name: newName }))
        );
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['eventShifts'] });
      queryClient.invalidateQueries({ queryKey: ['monthShifts'] });
      queryClient.invalidateQueries({ queryKey: ['tipAllocations'] });
      toast.success('עובד עודכן');
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message || 'עדכון העובד נכשל'),
  });

  const createEmployeeMutation = useSingleFlightMutation({
    mutationFn: (data) => base44.entities.TaskEmployee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskEmployees'] });
      toast.success('עובד נוצר');
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message || 'יצירת העובד נכשלה'),
  });

  const filteredEmployees = useMemo(() => employees.filter(emp => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = emp.full_name?.toLowerCase().includes(search) ||
           emp.phone_e164?.toLowerCase().includes(search) ||
           emp.role_name?.toLowerCase().includes(search) ||
           emp.agency_name?.toLowerCase().includes(search);
    const matchesDepartment = !selectedDeptFilter || emp.department_id === selectedDeptFilter;
    const matchesAgency = !selectedAgencyFilter || emp.agency_id === selectedAgencyFilter;
    return matchesSearch && matchesDepartment && matchesAgency;
  }), [employees, searchTerm, selectedDeptFilter, selectedAgencyFilter]);

  const activeAgencies = useMemo(() => orderAgenciesForDisplay(agencies.filter(a => a.is_active)), [agencies]);
  const waitersDept = departments.find(d => d.name === WAITERS_DEPARTMENT);
  const editIsWaiter = editForm.department_name === WAITERS_DEPARTMENT;

  const activeCount = employees.filter(e => e.is_active).length;
  const whatsappEnabledCount = employees.filter(e => e.whatsapp_enabled).length;

  const handleEdit = (employee) => {
    setEmployerCostTypeChoice(null);
    setEditingId(employee.id);
    setEditForm(employee);
  };

  // Adding while a department (and agency) filter is on pre-fills them, so
  // "new waiter for עמי" is one click from the filtered view.
  const handleAddNew = () => {
    setEmployerCostTypeChoice(null);
    const dept = departments.find(d => d.id === selectedDeptFilter);
    const agency = agencies.find(a => a.id === selectedAgencyFilter);
    setEditingId('new');
    setEditForm({
      full_name: '',
      phone_e164: '',
      department_id: dept?.id || '',
      department_name: dept?.name || '',
      role_id: '',
      role_name: '',
      agency_id: agency?.id || '',
      agency_name: agency?.name || '',
      is_active: true,
      whatsapp_enabled: true,
      work_agreement: '',
      note: '',
      pay_type: '',
      hourly_rate: '',
      global_rate: '',
      secondary_role_id: '',
      secondary_role_name: '',
      secondary_rate: '',
      travel_amount: '',
      salary_basis: '',
      overtime_pay: '',
      recuperation_pay: '',
      vacation_pay: '',
      travel_pay: '',
      via_staffing_company: false,
      employer_cost_hourly: '',
      employer_cost_global: '',
      employer_cost_daily: '',
      agreement_signed: false,
      agreement_notes: '',
      procedures_signed: false,
      procedures_notes: '',
    });
  };

  const handleSave = (id) => {
    if (createEmployeeMutation.isPending || updateEmployeeMutation.isPending) return; // already saving
    let dataToSave = { ...editForm };
    // Validate unique role
    if (dataToSave.role_id) {
      const roleTaken = employees.some(e => e.is_active && e.role_id === dataToSave.role_id && e.id !== id);
      if (roleTaken) {
        toast.error('תפקיד זה כבר מוקצה לעובד אחר');
        return;
      }
    }
    // A role pins the department to the role's; without one, the category
    // picked on the card stands.
    if (dataToSave.role_id) {
      const role = roles.find(r => r.id === dataToSave.role_id);
      if (role) {
        dataToSave.department_id = role.department_id || null;
        dataToSave.department_name = role.department_name || '';
      }
    }
    if (!dataToSave.department_id) {
      dataToSave.department_id = null;
      dataToSave.department_name = '';
    }
    if (dataToSave.department_name === WAITERS_DEPARTMENT) {
      if (!dataToSave.agency_id) {
        toast.error('יש לבחור סוכנות כוח אדם למלצר');
        return;
      }
    } else {
      dataToSave.agency_id = null;
      dataToSave.agency_name = null;
    }
    // '' fails at the DB level for uuid columns (role_id/department_id) and
    // for pay_type's CHECK constraint (must be null or one of the allowed
    // values) — an untouched field defaults to '' in form state, which used
    // to silently block creating an employee with just a name.
    if (!dataToSave.role_id) dataToSave.role_id = null;
    if (!dataToSave.full_name?.trim()) {
      toast.error('יש להזין שם');
      return;
    }
    if (!dataToSave.pay_type) dataToSave.pay_type = null;
    if (dataToSave.hourly_rate === '') dataToSave.hourly_rate = null;
    if (dataToSave.global_rate === '') dataToSave.global_rate = null;
    if (!dataToSave.secondary_role_id) { dataToSave.secondary_role_id = null; dataToSave.secondary_role_name = ''; }
    for (const f of ['secondary_rate', 'travel_amount', 'employer_cost_hourly', 'employer_cost_global', 'employer_cost_daily']) {
      if (dataToSave[f] === '' || dataToSave[f] === undefined) dataToSave[f] = null;
    }
    // A single pay type keeps only its own amount.
    if (dataToSave.pay_type === 'hourly') dataToSave.global_rate = null;
    if (dataToSave.pay_type === 'global' || dataToSave.pay_type === 'monthly') dataToSave.hourly_rate = null;
    if (dataToSave.travel_pay !== 'paid') dataToSave.travel_amount = null;
    for (const f of ['salary_basis', 'overtime_pay', 'recuperation_pay', 'vacation_pay', 'travel_pay']) {
      if (!dataToSave[f]) dataToSave[f] = null;
    }
    if (id === 'new') {
      createEmployeeMutation.mutate(dataToSave);
    } else {
      updateEmployeeMutation.mutate({ id, data: dataToSave });
    }
  };

  const handleCancel = () => {
    setEmployerCostTypeChoice(null);
    setEditingId(null);
    setEditForm({});
  };

  const handleRoleChange = (roleId) => {
    if (roleId === '__none__') {
      setEditForm({
        ...editForm,
        role_id: '',
        role_name: ''
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

  // Switching category drops a role that belongs to a different department.
  const handleDepartmentChange = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    const role = roles.find(r => r.id === editForm.role_id);
    const keepRole = role && deptId !== '__none__' && role.department_id === deptId;
    setEditForm({
      ...editForm,
      department_id: deptId === '__none__' ? '' : deptId,
      department_name: dept?.name || '',
      ...(keepRole ? {} : { role_id: '', role_name: '' }),
    });
  };

  const handleAgencyChange = (agencyId) => {
    const agency = agencies.find(a => a.id === agencyId);
    setEditForm({ ...editForm, agency_id: agencyId, agency_name: agency?.name || '' });
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
    if (emp.pay_type === 'global' || emp.pay_type === 'both') parts.push(`${emp.global_rate ?? 0} ₪ ${isWaiterEmployee(emp) ? 'לאירוע' : 'ליום'}`);
    if (emp.pay_type === 'monthly') parts.push(`${emp.global_rate ?? 0} ₪ לחודש`);
    return parts.length ? parts.join(' + ') : null;
  };

  // שכר is one of חודשי / שעתי / יומי. pay_type 'monthly' and 'global'
  // (יומי — the per-day / per-event rate attendance seeds shifts from) keep
  // the amount in global_rate; 'hourly' in hourly_rate. A legacy 'both'
  // shows as שעתי and is kept until another type is picked.
  const payKind = editForm.pay_type === 'both' ? 'hourly' : editForm.pay_type === 'global' ? 'daily' : (editForm.pay_type || '');
  const setPayKind = (kind) => {
    const next = payKind === kind ? '' : kind;
    setEditForm({ ...editForm, pay_type: next === 'daily' ? 'global' : next });
  };
  const payAmountField = payKind === 'hourly' ? 'hourly_rate' : 'global_rate';

  // כלול / לשלם pair for a text field holding 'included' | 'paid'.
  const includedPaid = (field) => (
    <div className="flex gap-2 w-full">
      <Seg active={editForm[field] === 'paid'} onClick={() => setEditForm({ ...editForm, [field]: editForm[field] === 'paid' ? '' : 'paid' })}>לשלם</Seg>
      <Seg active={editForm[field] === 'included'} onClick={() => setEditForm({ ...editForm, [field]: editForm[field] === 'included' ? '' : 'included' })}>כלול</Seg>
    </div>
  );

  const numberValue = (v) => (v === null || v === undefined ? '' : v);
  const setNumber = (field) => (e) =>
    setEditForm({ ...editForm, [field]: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 });

  // Employer cost (עלות מעביד) is monthly, hourly or daily: the amount lives
  // in employer_cost_global (monthly), employer_cost_hourly or
  // employer_cost_daily. Picking a type clears the other amounts.
  const [employerCostTypeChoice, setEmployerCostTypeChoice] = useState(null);
  const EMPLOYER_COST_FIELD = { monthly: 'employer_cost_global', hourly: 'employer_cost_hourly', daily: 'employer_cost_daily' };
  const hasValue = (v) => v != null && v !== '';
  const employerCostType = employerCostTypeChoice
    ?? (hasValue(editForm.employer_cost_hourly) ? 'hourly'
      : hasValue(editForm.employer_cost_daily) ? 'daily'
      : hasValue(editForm.employer_cost_global) ? 'monthly' : '');
  const setEmployerCostType = (type) => {
    const next = employerCostType === type ? '' : type;
    setEmployerCostTypeChoice(next);
    setEditForm({
      ...editForm,
      ...Object.fromEntries(Object.entries(EMPLOYER_COST_FIELD).map(([t, f]) => [f, t === next ? editForm[f] : ''])),
    });
  };

  const handleSecondaryRoleChange = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    setEditForm({
      ...editForm,
      secondary_role_id: roleId === '__none__' ? '' : roleId,
      secondary_role_name: roleId === '__none__' ? '' : (role?.role_name || ''),
    });
  };

  // Layout follows Ronen's "כרטיס עובד" design: פרטי העובד, תנאי העסקה,
  // עלות מעביד\חברה, הסכם עבודה, נהלי עבודה, then פעיל / WhatsApp.
  const renderEditFields = (excludeEmployeeId) => (
    <div className="space-y-4">
      <Section title="פרטי העובד">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="שם העובד">
            <Input
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              placeholder="שם מלא"
            />
          </Field>
          <Field label="נייד">
            <Input
              value={editForm.phone_e164}
              onChange={(e) => setEditForm({ ...editForm, phone_e164: e.target.value })}
              placeholder="+972501234567"
              dir="ltr"
              className="text-right"
            />
          </Field>
          <Field label="מחלקה">
            <Select value={editForm.department_id || "__none__"} onValueChange={handleDepartmentChange}>
              <SelectTrigger className="w-full"><SelectValue placeholder="ללא בחירה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא בחירה</SelectItem>
                {departments
                  .filter(d => d.is_active)
                  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                  .map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="תפקיד">
            <Select value={editForm.role_id || "__none__"} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-full"><SelectValue placeholder="ללא תפקיד" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא תפקיד</SelectItem>
                {roles.filter(r => r.is_active && (!editForm.department_id || r.department_id === editForm.department_id)).map(role => {
                  const taken = employees.some(e => e.is_active && e.role_id === role.id && e.id !== excludeEmployeeId);
                  return (
                    <SelectItem key={role.id} value={role.id} disabled={taken}>
                      {role.role_name} ({role.department_name || '-'}){taken ? ' ✓' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field label="תפקיד נוסף">
            <div className="flex gap-2">
              <Select value={editForm.secondary_role_id || "__none__"} onValueChange={handleSecondaryRoleChange}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא</SelectItem>
                  {roles.filter(r => r.is_active && r.id !== editForm.role_id).map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.role_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.secondary_role_id && (
                <Input
                  type="number"
                  className="w-24"
                  placeholder="₪ בתפקיד"
                  value={numberValue(editForm.secondary_rate)}
                  onChange={setNumber('secondary_rate')}
                />
              )}
            </div>
          </Field>
          <Field label="עובד חלופי">{renderBackupSelect()}</Field>
          {editIsWaiter && (
            <Field label="סוכנות *" className="md:col-span-2">
              <Select value={editForm.agency_id || ""} onValueChange={handleAgencyChange}>
                <SelectTrigger className="w-full border-amber-300 bg-amber-50"><SelectValue placeholder="בחר סוכנות כוח אדם" /></SelectTrigger>
                <SelectContent>
                  {activeAgencies.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      </Section>

      <Section title="תנאי העסקה">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="שכר">
            <div className="flex gap-2">
              <Seg active={payKind === 'monthly'} onClick={() => setPayKind('monthly')}>חודשי</Seg>
              <Seg active={payKind === 'hourly'} onClick={() => setPayKind('hourly')}>שעתי</Seg>
              <Seg active={payKind === 'daily'} onClick={() => setPayKind('daily')}>יומי</Seg>
            </div>
          </Field>
          <Field label="הובטח לעובד">
            <Input
              type="number"
              disabled={!payKind}
              placeholder={payKind === 'hourly' ? '₪ לשעה' : payKind === 'daily' ? (editIsWaiter ? '₪ לאירוע' : '₪ ליום') : payKind === 'monthly' ? '₪ לחודש' : 'בחר סוג שכר'}
              value={numberValue(editForm[payAmountField])}
              onChange={setNumber(payAmountField)}
            />
          </Field>
          <Field label="נטו / ברוטו">
            <div className="flex gap-2">
              <Seg active={editForm.salary_basis === 'gross'} onClick={() => setEditForm({ ...editForm, salary_basis: editForm.salary_basis === 'gross' ? '' : 'gross' })}>ברוטו</Seg>
              <Seg active={editForm.salary_basis === 'net'} onClick={() => setEditForm({ ...editForm, salary_basis: editForm.salary_basis === 'net' ? '' : 'net' })}>נטו</Seg>
            </div>
          </Field>
          <Field label="שעות נוספות">{includedPaid('overtime_pay')}</Field>
          <Field label="הבראה">{includedPaid('recuperation_pay')}</Field>
          <Field label="חופש">{includedPaid('vacation_pay')}</Field>
          <Field label="נסיעות">{includedPaid('travel_pay')}</Field>
          <Field label="כמה לשלם">
            <Input
              type="number"
              disabled={editForm.travel_pay !== 'paid'}
              placeholder="₪"
              value={numberValue(editForm.travel_amount)}
              onChange={setNumber('travel_amount')}
            />
          </Field>
          <Field label="הערות נוספות" className="md:col-span-2 items-start">
            <Textarea
              rows={2}
              value={editForm.note || ''}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
              placeholder="יש להזין הערות נוספות כאן..."
            />
          </Field>
        </div>
      </Section>

      <Section title="עלות מעביד\חברה">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" className="w-4 h-4" checked={!!editForm.via_staffing_company} onChange={(e) => setEditForm({ ...editForm, via_staffing_company: e.target.checked })} />
            חברת כח אדם
          </label>
          <div className="flex gap-2 flex-1 min-w-[14rem]">
            <Seg active={employerCostType === 'monthly'} onClick={() => setEmployerCostType('monthly')}>חודשי</Seg>
            <Seg active={employerCostType === 'hourly'} onClick={() => setEmployerCostType('hourly')}>שעתי</Seg>
            <Seg active={employerCostType === 'daily'} onClick={() => setEmployerCostType('daily')}>יומי</Seg>
          </div>
          <Input
            type="number"
            className="w-36"
            disabled={!employerCostType}
            placeholder="סכום"
            value={employerCostType ? numberValue(editForm[EMPLOYER_COST_FIELD[employerCostType]]) : ''}
            onChange={employerCostType ? setNumber(EMPLOYER_COST_FIELD[employerCostType]) : undefined}
          />
        </div>
      </Section>

      <Section title="הסכם עבודה">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 items-start">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" className="w-4 h-4" checked={!!editForm.agreement_signed} onChange={(e) => setEditForm({ ...editForm, agreement_signed: e.target.checked })} />
              חתם על הסכם עבודה
            </label>
            {editForm.work_agreement ? (
              <div className="flex items-center gap-1 min-w-0">
                <a
                  href={editForm.work_agreement}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate max-w-[12rem]"
                >
                  <FileText className="inline w-4 h-4 ml-1" />
                  {agreementFileName(editForm.work_agreement)}
                </a>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditForm({ ...editForm, work_agreement: '' })}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
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
                  onClick={() => document.getElementById('work-agreement-upload')?.click()}
                  disabled={uploadingAgreement}
                >
                  <Upload className="w-4 h-4 ml-2" />
                  {uploadingAgreement ? 'מעלה...' : 'העלאה PDF'}
                </Button>
              </>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-stone-700">הערות</p>
            <Textarea
              rows={2}
              value={editForm.agreement_notes || ''}
              onChange={(e) => setEditForm({ ...editForm, agreement_notes: e.target.value })}
              placeholder="יש להזין הערות כאן..."
            />
          </div>
        </div>
      </Section>

      <Section title="נהלי עבודה">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 items-start">
          <label className="flex items-center gap-2 text-sm text-stone-700 pt-2">
            <input type="checkbox" className="w-4 h-4" checked={!!editForm.procedures_signed} onChange={(e) => setEditForm({ ...editForm, procedures_signed: e.target.checked })} />
            חתם על נהלי עבודה
          </label>
          <div className="space-y-1">
            <p className="text-sm text-stone-700">הערות</p>
            <Textarea
              rows={2}
              value={editForm.procedures_notes || ''}
              onChange={(e) => setEditForm({ ...editForm, procedures_notes: e.target.value })}
              placeholder="יש להזין הערות כאן..."
            />
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-5 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="w-4 h-4" checked={!!editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
          פעיל
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="w-4 h-4" checked={!!editForm.whatsapp_enabled} onChange={(e) => setEditForm({ ...editForm, whatsapp_enabled: e.target.checked })} />
          WhatsApp
        </label>
      </div>
    </div>
  );

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
                <Plus className="w-4 h-4 ml-2" />
                עובד חדש
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedDeptFilter === null ? "default" : "outline"}
                onClick={() => { setSelectedDeptFilter(null); setSelectedAgencyFilter(null); }}
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
                      onClick={() => { setSelectedDeptFilter(dept.id); setSelectedAgencyFilter(null); }}
                      size="sm"
                    >
                      {dept.name} ({count})
                    </Button>
                  );
                })}
            </div>
            {waitersDept && selectedDeptFilter === waitersDept.id && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-stone-500">סוכנות:</span>
                <Button size="sm" variant={selectedAgencyFilter === null ? "default" : "outline"} onClick={() => setSelectedAgencyFilter(null)}>
                  הכל
                </Button>
                {activeAgencies.map(a => (
                  <Button key={a.id} size="sm" variant={selectedAgencyFilter === a.id ? "default" : "outline"} onClick={() => setSelectedAgencyFilter(a.id)}>
                    {a.name} ({employees.filter(e => e.agency_id === a.id).length})
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEmployees.map((employee) => (
                <Card key={employee.id} className={editingId === employee.id ? "border-emerald-400 border-2" : "hover:shadow-md transition-shadow"}>
                  <CardContent className="p-4 space-y-3">
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg text-stone-900 truncate">{employee.full_name}</h3>
                            <p className="inline-block mt-0.5 text-sm text-stone-600 font-mono border border-stone-200 rounded-full px-3 py-0.5">{employee.phone_e164 || '-'}</p>
                          </div>
                          <Badge className={employee.is_active ? "bg-emerald-100 text-emerald-700 shrink-0" : "bg-stone-100 text-stone-700 shrink-0"}>
                            {employee.is_active ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {employee.role_name && <Badge variant="outline">{employee.role_name}</Badge>}
                          {employee.department_name && <Badge className="bg-blue-100 text-blue-700">{employee.department_name}</Badge>}
                          {employee.agency_name && <Badge className="bg-amber-100 text-amber-800">סוכנות: {employee.agency_name}</Badge>}
                          <Badge className={employee.whatsapp_enabled ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-700"}>
                            WhatsApp {employee.whatsapp_enabled ? 'מופעל' : 'כבוי'}
                          </Badge>
                        </div>

                        {(employee.manager_name || employee.backup_employee_name || payLabel(employee)) && (
                          <div className="text-sm text-stone-600 space-y-1 border border-stone-200 rounded-lg px-3 py-2">
                            {employee.manager_name && <p>מנהל: {employee.manager_name}</p>}
                            {employee.backup_employee_name && <p>עובד חלופי: {employee.backup_employee_name}</p>}
                            {payLabel(employee) && <p className="font-medium text-stone-900">שכר: {payLabel(employee)}</p>}
                          </div>
                        )}

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
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredEmployees.length === 0 && isLoading && <LoadingState className="py-12" />}
            {filteredEmployees.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">לא נמצאו עובדים</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="pl-8">{editingId === 'new' ? 'עובד חדש' : `כרטיס עובד — ${employees.find(e => e.id === editingId)?.full_name || ''}`}</DialogTitle>
          </DialogHeader>
          {editingId && renderEditFields(editingId === 'new' ? null : editingId)}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => handleSave(editingId)}
              disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="w-4 h-4 ml-1" /> שמירה
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            {editingId && editingId !== 'new' && (
              <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                <History className="w-4 h-4 ml-1" /> היסטוריית שינויים
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        employeeId={editingId !== 'new' ? editingId : null}
        employeeName={employees.find(e => e.id === editingId)?.full_name || ''}
      />

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

      </Tabs>
    </div>
  );
}