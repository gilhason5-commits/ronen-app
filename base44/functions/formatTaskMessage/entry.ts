import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { task_assignment_id } = await req.json();

    if (!task_assignment_id) {
      return Response.json({ message: "❌ משימה לא נמצאה" });
    }

    // Get task assignment
    const assignments = await base44.asServiceRole.entities.TaskAssignment.filter({ id: task_assignment_id });
    const task = assignments[0];

    if (!task) {
      console.log(`⚠️ Task assignment ${task_assignment_id} not found`);
      return Response.json({ message: "❌ משימה לא נמצאה" });
    }

    // Get event name - CRITICAL: must show which event this task belongs to!
    let eventName = "-";
    if (task.event_id) {
      const events = await base44.asServiceRole.entities.Event.filter({ id: task.event_id });
      if (events[0]) {
        eventName = events[0].event_name || events[0].name || "-";
      }
    }
    // Also check if event_name is cached on assignment
    if (task.event_name) {
      eventName = task.event_name;
    }

    // Format times
    const startTime = task.start_time ? new Date(task.start_time) : null;
    const endTime = task.end_time ? new Date(task.end_time) : null;
    
    const startStr = startTime ? startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
    const endStr = endTime ? endTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

    // Build message - includes event name and unique token
    const message = `📋 משימה: ${task.task_title || 'משימה'}
🎉 אירוע: ${eventName}
⏰ חלון: ${startStr}-${endStr}
📱 השב: ✅ בוצע / ❌ לא בוצע
🔑 קוד: ${task.whatsapp_token || 'N/A'}`;

    return Response.json({ message });

  } catch (error) {
    console.error("❌ formatTaskMessage error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});