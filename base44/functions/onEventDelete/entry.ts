import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event?.type !== 'delete') {
      return Response.json({ skipped: true });
    }

    const eventId = event.entity_id;
    if (!eventId) {
      return Response.json({ error: 'No event_id' }, { status: 400 });
    }

    // Find all task assignments for this event
    const assignments = await base44.asServiceRole.entities.TaskAssignment.filter({ event_id: eventId });

    if (assignments.length === 0) {
      return Response.json({ deleted: 0 });
    }

    // Delete all related task assignments
    for (const assignment of assignments) {
      await base44.asServiceRole.entities.TaskAssignment.delete(assignment.id);
    }

    console.log(`Deleted ${assignments.length} task assignments for event ${eventId}`);
    return Response.json({ deleted: assignments.length, event_id: eventId });
  } catch (error) {
    console.error('Error deleting event tasks:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});