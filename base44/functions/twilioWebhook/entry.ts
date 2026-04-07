// Minimal Twilio webhook - no imports, no SDK, just parse and respond
Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    console.log("RECEIVED:", rawBody.substring(0, 300));
    
    const params = new URLSearchParams(rawBody);
    const from = (params.get("From") || "").replace("whatsapp:", "").trim();
    const body = (params.get("Body") || "").trim();
    const buttonPayload = (params.get("ButtonPayload") || "").trim();
    const message = body || buttonPayload;

    console.log(`FROM: ${from}, MSG: "${message}"`);

    if (!from || !message) {
      return new Response("<?xml version='1.0' encoding='UTF-8'?><Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" }
      });
    }

    // Store in KV-like approach: call the processing function async
    // For now, just use Base44 SDK to update task
    const { createClientFromRequest } = await import("npm:@base44/sdk@0.8.6");
    const base44 = createClientFromRequest(req);

    const lowerMsg = message.toLowerCase();
    const hasNotDone = message.includes("לא בוצע") || lowerMsg === "not_done" || lowerMsg === "no";
    const hasDone = !hasNotDone && (message.includes("בוצע") || lowerMsg === "done" || lowerMsg === "yes");

    if (!hasDone && !hasNotDone) {
      console.log("Unknown intent:", message);
      return new Response("<?xml version='1.0' encoding='UTF-8'?><Response></Response>", {
        status: 200, headers: { "Content-Type": "text/xml" }
      });
    }

    // Find employee
    const employees = await base44.asServiceRole.entities.TaskEmployee.filter({ phone_e164: from });
    if (!employees[0]) {
      console.log("Unknown phone:", from);
      return new Response("<?xml version='1.0' encoding='UTF-8'?><Response></Response>", {
        status: 200, headers: { "Content-Type": "text/xml" }
      });
    }

    // Find active tasks
    const allTasks = await base44.asServiceRole.entities.TaskAssignment.filter({ assigned_to_id: employees[0].id });
    const active = allTasks.filter(t => t.status === "PENDING" || t.status === "OVERDUE");

    if (active.length === 0) {
      console.log("No active tasks for", employees[0].full_name);
      return new Response("<?xml version='1.0' encoding='UTF-8'?><Response></Response>", {
        status: 200, headers: { "Content-Type": "text/xml" }
      });
    }

    // Nearest task
    const now = Date.now();
    let task = active[0];
    let minDiff = Infinity;
    for (const t of active) {
      const diff = Math.abs(new Date(t.computed_start_time || t.start_time).getTime() - now);
      if (diff < minDiff) { minDiff = diff; task = t; }
    }

    if (hasDone) {
      await base44.asServiceRole.entities.TaskAssignment.update(task.id, {
        status: "DONE", completed_at: new Date().toISOString()
      });
      console.log("✅ DONE:", task.task_title);
    } else {
      await base44.asServiceRole.entities.TaskAssignment.update(task.id, { status: "NOT_DONE" });
      console.log("❌ NOT_DONE:", task.task_title);
    }

    return new Response("<?xml version='1.0' encoding='UTF-8'?><Response></Response>", {
      status: 200, headers: { "Content-Type": "text/xml" }
    });

  } catch (error) {
    console.error("ERROR:", error.message);
    return new Response("<?xml version='1.0' encoding='UTF-8'?><Response></Response>", {
      status: 200, headers: { "Content-Type": "text/xml" }
    });
  }
});