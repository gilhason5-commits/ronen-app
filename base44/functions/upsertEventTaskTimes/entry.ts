import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// CRITICAL: This function works on ONE SPECIFIC EVENT only!
// Never modifies tasks from other events

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_id } = await req.json();

    if (!event_id) {
      return Response.json({ error: "event_id is required" }, { status: 400 });
    }

    // Get event
    const events = await base44.entities.Event.filter({ id: event_id });
    const event = events[0];

    if (!event) {
      console.error(`❌ Event ${event_id} not found`);
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // Find tasks for THIS SPECIFIC EVENT only
    const allTasks = await base44.entities.TaskAssignment.filter({ event_id: event_id });
    
    console.log(`📋 Found ${allTasks.length} tasks for event ${event_id} (${event.event_name})`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const task of allTasks) {
      // Don't modify completed tasks - immutable
      if (task.status === 'DONE') {
        console.log(`⏭️ Skipping task ${task.id} - already DONE`);
        skippedCount++;
        continue;
      }

      // Get time values
      const computedStart = task.computed_start_time;
      const computedEnd = task.computed_end_time;

      if (!computedStart) {
        console.log(`⚠️ Task ${task.id} missing computed_start_time`);
        skippedCount++;
        continue;
      }

      // Parse computed times
      const newStartTime = new Date(computedStart);
      const newEndTime = computedEnd ? new Date(computedEnd) : new Date(newStartTime.getTime() + 60 * 60 * 1000); // default 1 hour

      // Check if times changed
      const currentStart = task.start_time ? new Date(task.start_time).getTime() : 0;
      const currentEnd = task.end_time ? new Date(task.end_time).getTime() : 0;

      if (currentStart !== newStartTime.getTime() || currentEnd !== newEndTime.getTime()) {
        await base44.entities.TaskAssignment.update(task.id, {
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          last_notification_start_sent_at: null, // Reset to allow re-sending
          last_notification_end_sent_at: null
        });
        updatedCount++;
        console.log(`✅ Updated times for task ${task.id}`);
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ Event ${event_id}: updated ${updatedCount} tasks, skipped ${skippedCount}`);

    return Response.json({
      event_id: event_id,
      event_name: event.event_name,
      updated_count: updatedCount,
      skipped_count: skippedCount
    });

  } catch (error) {
    console.error("❌ upsertEventTaskTimes error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});