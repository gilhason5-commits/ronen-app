import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Saves the configured availability send hour in AppSetting.
// The arriveToday and availabilityNoResponseChecker functions
// read this setting every 5 minutes to determine when to run.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { hour } = await req.json();
    
    if (!hour || !/^\d{2}:\d{2}$/.test(hour)) {
      return Response.json({ error: 'Invalid hour format. Use HH:MM' }, { status: 400 });
    }

    // Calculate no-response check time (+2 hours)
    const [h, m] = hour.split(':').map(Number);
    let checkH = h + 2;
    if (checkH >= 24) checkH -= 24;
    const noResponseTime = `${String(checkH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    // Save the setting in AppSetting entity
    const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: 'availability_send_hour' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value: hour });
    } else {
      await base44.asServiceRole.entities.AppSetting.create({ 
        key: 'availability_send_hour', 
        value: hour,
        description: 'שעת שליחת הודעות זמינות יומית'
      });
    }

    console.log(`Availability send hour updated to ${hour}, no-response check at ${noResponseTime}`);

    return Response.json({ 
      success: true, 
      send_hour: hour,
      no_response_check: noResponseTime,
      message: `שעת שליחה: ${hour}, בדיקת אי-מענה: ${noResponseTime}`
    });

  } catch (error) {
    console.error('updateAvailabilitySchedule error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});