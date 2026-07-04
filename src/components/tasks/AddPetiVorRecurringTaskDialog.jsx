import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Clock, Bell, Briefcase, Calendar, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function AddPetiVorRecurringTaskDialog({ open, onClose, editingAssignment = null, departmentId }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("");
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState("1");
  const [escalationRole, setEscalationRole] = useState("");
  
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['taskCategories', 'PETI_VOR_RECURRING'],
    queryFn: async () => {
      const data = await base44.entities.TaskCategory.list();
      return data.filter(c => c.category_type === 'PETI_VOR_RECURRING' && c.is_active);
    },
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['taskTemplates', 'PETI_VOR_RECURRING'],
    queryFn: async () => {
      const data = await base44.entities.TaskTemplate.list();
      return data.filter(t => t.is_active && t.task_type === 'PETI_VOR_RECURRING');
    },
    initialData: [],
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['taskEmployees'],
    queryFn: () => base44.entities.TaskEmployee.list(),
    initialData: [],
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: () => base44.entities.EmployeeRole.list(),
    initialData: [],
  });

  const { data: existingAssignments = [] } = useQuery({
    queryKey: ['taskAssignments', 'pv_recurring_existing'],
    queryFn: async () => {
      const data = await base44.entities.TaskAssignment.filter({});
      return data.filter(a => !a.event_id && a.recurrence_type && a.recurrence_type !== 'once');
    },
    initialData: [],
  });

  // Filter employees to Peti Vor department only
  const activeEmployees = allEmployees.filter(e => e.is_active && e.department_name === 'פטי וור');
  
  const allActiveEmployees = allEmployees.filter(e => e.is_active);

  const rolesWithOneEmployee = allRoles.filter(role => {
    if (!role.is_active) return false;
    const empsInRole = allActiveEmployees.filter(e => e.role_id === role.id);
    return empsInRole.length === 1;
  });

  const getEmployeeForRole = (roleId) => allActiveEmployees.find(e => e.role_id === roleId) || null;
  const getEmployeeById = (empId) => activeEmployees.find(e => e.id === empId) || null;

  useEffect(() => {
    if (editingAssignment && open && templates.length > 0) {
      const emp = allEmployees.find(e => e.id === editingAssignment.assigned_to_id);
      if (emp) {
        setSelectedEmployee(emp.id);
      }
      const startDateTime = new Date(editingAssignment.start_time);
      setStartDate(startDateTime.toISOString().split('T')[0]);
      setStartTime(editingAssignment.recurrence_time || startDateTime.toTimeString().slice(0, 5));
      setRecurrenceType(editingAssignment.recurrence_type || 'once');
      setSelectedWeekdays(editingAssignment.recurrence_days || []);
      setSelectedDayOfMonth(String(editingAssignment.recurrence_day_of_month || 1));
      setEscalationRole(editingAssignment.escalation_role_id || "");
      const template = templates.find(t => t.id === editingAssignment.task_template_id);
      if (template) {
        setSelectedTemplate(template);
        setSelectedCategory(template.category_id);
      }
    }
  }, [editingAssignment, open, templates, allEmployees]);

  const createAssignmentMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('משימה נוספה');
      handleClose();
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaskAssignment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
      toast.success('המשימה עודכנה בהצלחה');
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

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setSelectedEmployee("");
    setRecurrenceType("once");
    const today = new Date();
    setStartDate(today.toISOString().split('T')[0]);
    if (template.schedule_rule) {
      try {
        const rule = JSON.parse(template.schedule_rule);
        setStartTime(rule.time || '09:00');
      } catch { setStartTime('09:00'); }
    } else {
      setStartTime('09:00');
    }
  };

  const handleAddTask = () => {
    const isEditing = !!editingAssignment;
    const hasEmployees = isEditing ? !!selectedEmployee : selectedEmployees.length > 0;
    if (!selectedTemplate || !hasEmployees || !recurrenceType) {
      toast.error('יש למלא את כל השדות');
      return;
    }
    if (recurrenceType === 'once' && (!startDate || !startTime)) { toast.error('יש למלא תאריך ושעה'); return; }
    if (recurrenceType === 'daily' && !startTime) { toast.error('יש למלא שעה'); return; }
    if (recurrenceType === 'weekly' && (selectedWeekdays.length === 0 || !startTime)) { toast.error('יש לבחור לפחות יום אחד ושעה'); return; }
    if (recurrenceType === 'monthly' && !startTime) { toast.error('יש למלא שעה'); return; }

    if (!editingAssignment) {
      const templateId = selectedTemplate.id;
      const existingForTemplate = existingAssignments.filter(a => a.task_template_id === templateId);
      if (existingForTemplate.length > 0) {
        const existingEmployeeIds = [...new Set(existingForTemplate.map(a => a.assigned_to_id))];
        const alreadyAssignedNames = existingEmployeeIds.map(id => getEmployeeById(id)?.full_name || id);
        if (selectedEmployees.some(id => !existingEmployeeIds.includes(id))) {
          toast.error(`המשימה כבר מוקצית ל: ${alreadyAssignedNames.join(', ')}`);
          return;
        }
      }
    }

    const effectiveEscalationRole = (escalationRole && escalationRole !== 'none') ? escalationRole : '';
    const escalationEmployee = effectiveEscalationRole ? getEmployeeForRole(effectiveEscalationRole) : null;
    const escalationRoleObj = effectiveEscalationRole ? allRoles.find(r => r.id === effectiveEscalationRole) : null;

    if (editingAssignment) {
      const employee = getEmployeeById(selectedEmployee);
      const updateData = {
        assigned_to_id: employee?.id || null,
        assigned_to_name: employee?.full_name || '',
        assigned_to_phone: employee?.phone_e164 || '',
        manager_id: employee?.manager_id || null,
        manager_name: employee?.manager_name || '',
        manually_overridden: true,
        recurrence_type: recurrenceType,
        recurrence_time: startTime,
        recurrence_days: recurrenceType === 'weekly' ? selectedWeekdays : [],
        recurrence_day_of_month: recurrenceType === 'monthly' ? parseInt(selectedDayOfMonth) : null,
        escalation_role_id: effectiveEscalationRole || null,
        escalation_role_name: escalationRoleObj?.role_name || '',
        escalation_employee_id: escalationEmployee?.id || null,
        escalation_employee_name: escalationEmployee?.full_name || '',
        escalation_employee_phone: escalationEmployee?.phone_e164 || '',
        escalate_to_manager: !!effectiveEscalationRole,
      };
      if (startTime && startDate) {
        const [hours, minutes] = startTime.split(':').map(Number);
        const [y, m, d] = startDate.split('-').map(Number);
        const newStart = new Date(y, m - 1, d, hours, minutes, 0, 0);
        const duration = editingAssignment.end_time && editingAssignment.start_time
          ? new Date(editingAssignment.end_time) - new Date(editingAssignment.start_time)
          : 60 * 60000;
        const newEnd = new Date(newStart.getTime() + duration);
        updateData.start_time = newStart.toISOString();
        updateData.end_time = newEnd.toISOString();
        updateData.computed_start_time = newStart.toISOString();
        updateData.computed_end_time = newEnd.toISOString();
      }
      updateAssignmentMutation.mutate({ id: editingAssignment.id, data: updateData });
      return;
    }

    const employees = selectedEmployees.map(id => getEmployeeById(id)).filter(Boolean);
    const assignmentsToCreate = [];

    for (const employee of employees) {
      const baseAssignment = {
        task_template_id: selectedTemplate.id,
        task_title: selectedTemplate.title,
        task_description: selectedTemplate.description,
        event_id: null,
        event_name: null,
        assigned_to_id: employee.id,
        assigned_to_name: employee.full_name || '',
        assigned_to_phone: employee.phone_e164 || '',
        status: 'PENDING',
        reminder_before_start_minutes: selectedTemplate.reminder_before_start_minutes,
        reminder_before_end_minutes: selectedTemplate.reminder_before_end_minutes,
        escalate_to_manager: !!effectiveEscalationRole || selectedTemplate.escalate_to_manager_if_not_done,
        manager_id: employee.manager_id || null,
        manager_name: employee.manager_name || '',
        manually_overridden: false,
        recurrence_type: recurrenceType,
        recurrence_time: startTime,
        recurrence_days: recurrenceType === 'weekly' ? selectedWeekdays : [],
        recurrence_day_of_month: recurrenceType === 'monthly' ? parseInt(selectedDayOfMonth) : null,
        escalation_role_id: effectiveEscalationRole || null,
        escalation_role_name: escalationRoleObj?.role_name || '',
        escalation_employee_id: escalationEmployee?.id || null,
        escalation_employee_name: escalationEmployee?.full_name || '',
        escalation_employee_phone: escalationEmployee?.phone_e164 || '',
        additional_employees: selectedEmployees.filter(id => id !== employee.id).map(id => {
          const e = getEmployeeById(id);
          return e ? { employee_id: e.id, employee_name: e.full_name, employee_phone: e.phone_e164 } : null;
        }).filter(Boolean),
      };

      const generateInstances = (type) => {
        const today = new Date();
        const duration = selectedTemplate.duration_minutes || 60;
        if (type === 'once') {
          const s = new Date(`${startDate}T${startTime}`);
          assignmentsToCreate.push({ ...baseAssignment, computed_start_time: s.toISOString(), computed_end_time: new Date(s.getTime() + duration * 60000).toISOString(), start_time: s.toISOString(), end_time: new Date(s.getTime() + duration * 60000).toISOString() });
        } else if (type === 'daily') {
          for (let d = 0; d < 30; d++) {
            const taskDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
            if (taskDate.getDay() === 5 || taskDate.getDay() === 6) continue;
            const [h, m] = startTime.split(':').map(Number);
            const s = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate(), h, m, 0, 0);
            assignmentsToCreate.push({ ...baseAssignment, computed_start_time: s.toISOString(), computed_end_time: new Date(s.getTime() + duration * 60000).toISOString(), start_time: s.toISOString(), end_time: new Date(s.getTime() + duration * 60000).toISOString() });
          }
        } else if (type === 'weekly') {
          const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
          for (let w = 0; w < 12; w++) {
            selectedWeekdays.forEach(wd => {
              const taskDate = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + w * 7 + wd);
              const [h, m] = startTime.split(':').map(Number);
              const s = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate(), h, m, 0, 0);
              assignmentsToCreate.push({ ...baseAssignment, computed_start_time: s.toISOString(), computed_end_time: new Date(s.getTime() + duration * 60000).toISOString(), start_time: s.toISOString(), end_time: new Date(s.getTime() + duration * 60000).toISOString() });
            });
          }
        } else if (type === 'monthly') {
          const dom = parseInt(selectedDayOfMonth);
          for (let mo = 0; mo < 6; mo++) {
            const taskDate = new Date(today.getFullYear(), today.getMonth() + mo, 1);
            taskDate.setDate(Math.min(dom, new Date(taskDate.getFullYear(), taskDate.getMonth() + 1, 0).getDate()));
            const [h, m] = startTime.split(':').map(Number);
            const s = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate(), h, m, 0, 0);
            assignmentsToCreate.push({ ...baseAssignment, computed_start_time: s.toISOString(), computed_end_time: new Date(s.getTime() + duration * 60000).toISOString(), start_time: s.toISOString(), end_time: new Date(s.getTime() + duration * 60000).toISOString() });
          }
        }
      };
      generateInstances(recurrenceType);
    }

    Promise.all(assignmentsToCreate.map(a => base44.entities.TaskAssignment.create(a)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['taskAssignments'] });
        toast.success(`נוספו ${assignmentsToCreate.length} משימות`);
        handleClose();
      });
  };

  const handleClose = () => {
    setSearchTerm(""); setSelectedCategory(null); setSelectedTemplate(null);
    setSelectedEmployee(""); setSelectedEmployees([]); setStartDate(""); setStartTime("");
    setRecurrenceType(""); setSelectedWeekdays([]); setSelectedDayOfMonth("1"); setEscalationRole("");
    onClose();
  };

  const toggleWeekday = (day) => setSelectedWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const weekdays = [{ value: 0, label: "ראשון" }, { value: 1, label: "שני" }, { value: 2, label: "שלישי" }, { value: 3, label: "רביעי" }, { value: 4, label: "חמישי" }];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAssignment ? 'עריכת משימה' : 'הוספת משימה שוטפת פטי וור מהמאגר'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
              <Input placeholder="חיפוש משימות..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={selectedCategory === null ? "default" : "outline"} onClick={() => setSelectedCategory(null)} size="sm">
                כל הקטגוריות ({templates.length})
              </Button>
              {categories.map(cat => {
                const count = templates.filter(t => t.category_id === cat.id).length;
                return (
                  <Button key={cat.id} variant={selectedCategory === cat.id ? "default" : "outline"} onClick={() => setSelectedCategory(cat.id)} size="sm">
                    {cat.name} ({count})
                  </Button>
                );
              })}
            </div>
          </div>

          {!editingAssignment && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
              {filteredTemplates.map(template => {
                const alreadyAssigned = existingAssignments.some(a => a.task_template_id === template.id);
                const assignedToName = alreadyAssigned
                  ? [...new Set(existingAssignments.filter(a => a.task_template_id === template.id).map(a => a.assigned_to_name))].join(', ')
                  : '';
                return (
                  <div key={template.id} onClick={() => !alreadyAssigned && handleTemplateSelect(template)}
                    className={`border rounded-lg p-3 transition-colors ${alreadyAssigned ? 'bg-stone-100 border-stone-200 cursor-not-allowed opacity-60' : selectedTemplate?.id === template.id ? 'bg-emerald-50 border-emerald-300 cursor-pointer' : 'hover:bg-stone-50 cursor-pointer'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold ${alreadyAssigned ? 'text-stone-400' : 'text-stone-900'}`}>{template.title}</h4>
                          {alreadyAssigned && <Badge variant="secondary" className="text-xs bg-stone-200 text-stone-500">מוקצית ל{assignedToName}</Badge>}
                        </div>
                        {template.description && <p className={`text-sm mt-1 ${alreadyAssigned ? 'text-stone-400' : 'text-stone-600'}`}>{template.description}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline">{template.category_name}</Badge>
                          {template.duration_minutes && <Badge variant="outline" className="flex items-center gap-1"><Clock className="w-3 h-3" />{template.duration_minutes} דקות</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredTemplates.length === 0 && <div className="text-center py-8 text-stone-500">לא נמצאו משימות מתאימות. הוסף משימות במאגר משימות תחת "משימות שוטפות פטי וור".</div>}
            </div>
          )}

          {(selectedTemplate || editingAssignment) && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-stone-900">הגדרות הקצאה</h3>
              
              <div>
                <label className="text-sm font-medium text-stone-700 mb-2 block">
                  <Briefcase className="w-4 h-4 inline mr-1" />
                  {editingAssignment ? 'עובד' : 'עובדים'} (פטי וור בלבד)
                </label>
                {editingAssignment ? (
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger><SelectValue placeholder="בחר עובד" /></SelectTrigger>
                    <SelectContent>
                      {activeEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name} - {emp.role_name || ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Select value="" onValueChange={(empId) => { if (!selectedEmployees.includes(empId)) setSelectedEmployees(prev => [...prev, empId]); }}>
                      <SelectTrigger><SelectValue placeholder="בחר עובדים..." /></SelectTrigger>
                      <SelectContent>
                        {activeEmployees.filter(emp => !selectedEmployees.includes(emp.id)).map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.full_name} - {emp.role_name || ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployees.map(empId => {
                          const emp = getEmployeeById(empId);
                          return emp ? (
                            <Badge key={empId} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                              {emp.full_name}
                              <button type="button" onClick={() => setSelectedEmployees(prev => prev.filter(id => id !== empId))} className="hover:text-red-600 mr-1">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700 mb-2 block">תדירות חזרה</label>
                <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                  <SelectTrigger><SelectValue placeholder="בחר תדירות" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">חד פעמי</SelectItem>
                    <SelectItem value="daily">יומי (ראשון-חמישי)</SelectItem>
                    <SelectItem value="weekly">שבועי (קבוע)</SelectItem>
                    <SelectItem value="monthly">חודשי (קבוע)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType === 'once' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-stone-700 mb-2 block"><Calendar className="w-4 h-4 inline mr-1" />תאריך</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div><label className="text-sm font-medium text-stone-700 mb-2 block"><Clock className="w-4 h-4 inline mr-1" />שעה</label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                </div>
              )}

              {recurrenceType === 'daily' && (
                <div><label className="text-sm font-medium text-stone-700 mb-2 block"><Clock className="w-4 h-4 inline mr-1" />שעה (כל יום)</label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              )}

              {recurrenceType === 'weekly' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-stone-700 mb-2 block">ימים בשבוע</label>
                    <div className="flex flex-wrap gap-2">
                      {weekdays.map(day => (
                        <Button key={day.value} type="button" size="sm" variant={selectedWeekdays.includes(day.value) ? "default" : "outline"} onClick={() => toggleWeekday(day.value)} className={selectedWeekdays.includes(day.value) ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div><label className="text-sm font-medium text-stone-700 mb-2 block"><Clock className="w-4 h-4 inline mr-1" />שעה</label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                </>
              )}

              {recurrenceType === 'monthly' && (
                <>
                  <div><label className="text-sm font-medium text-stone-700 mb-2 block">יום בחודש</label>
                    <Select value={selectedDayOfMonth} onValueChange={setSelectedDayOfMonth}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 31 }, (_, i) => i + 1).map(day => (<SelectItem key={day} value={day.toString()}>{day}</SelectItem>))}</SelectContent>
                    </Select></div>
                  <div><label className="text-sm font-medium text-stone-700 mb-2 block"><Clock className="w-4 h-4 inline mr-1" />שעה</label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                </>
              )}

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-stone-700 mb-2 block">מנהל אסקלציה (אופציונלי)</label>
                <Select value={escalationRole} onValueChange={setEscalationRole}>
                  <SelectTrigger><SelectValue placeholder="ללא מנהל אסקלציה" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {rolesWithOneEmployee.map(role => {
                      const emp = getEmployeeForRole(role.id);
                      return <SelectItem key={role.id} value={role.id}>{role.role_name} ({emp?.full_name})</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>ביטול</Button>
                <Button onClick={handleAddTask} disabled={editingAssignment ? !selectedEmployee : (selectedEmployees.length === 0 || !recurrenceType)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingAssignment ? 'שמור שינויים' : 'הוסף משימה'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}