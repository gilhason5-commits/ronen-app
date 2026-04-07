import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { employee_id } = await req.json();

    if (!employee_id) {
      return Response.json({ manager_phone: null, reason: "No employee_id provided" });
    }

    // Get employee from TaskEmployee entity
    const employees = await base44.asServiceRole.entities.TaskEmployee.filter({ id: employee_id });
    const employee = employees[0];

    if (!employee) {
      console.log(`⚠️ Employee ${employee_id} not found`);
      return Response.json({ manager_phone: null, reason: "Employee not found" });
    }

    // Option A: Via manager_id (FK to another TaskEmployee)
    if (employee.manager_id) {
      const managers = await base44.asServiceRole.entities.TaskEmployee.filter({ id: employee.manager_id });
      const manager = managers[0];
      
      if (manager && manager.phone_e164) {
        console.log(`✅ Found manager ${manager.full_name} for employee ${employee.full_name}`);
        return Response.json({ 
          manager_phone: manager.phone_e164,
          manager_name: manager.full_name
        });
      }
    }

    // Option B: Via manager_phone field on employee
    if (employee.manager_phone) {
      console.log(`✅ Found manager phone for employee ${employee.full_name}`);
      return Response.json({ 
        manager_phone: employee.manager_phone,
        manager_name: employee.manager_name || "מנהל"
      });
    }

    console.log(`⚠️ No manager found for employee ${employee.id} (${employee.full_name})`);
    return Response.json({ manager_phone: null, reason: "No manager configured" });

  } catch (error) {
    console.error("❌ getManagerPhone error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});