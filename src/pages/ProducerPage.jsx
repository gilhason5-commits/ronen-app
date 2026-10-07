import React from "react";
import EventsCalendarView from "../components/events/EventsCalendarView";
import { useAuth } from "@/lib/AuthContext";

// The producer works from the same events calendar as the main user: creates
// events, opens them to pick dishes, and approves them from the event's page
// (EventApprovalBar). producerMode hides financials in the event form.
export default function ProducerPage() {
  const { user } = useAuth();
  const isProducerRole = user?.role === "producer";
  return (
    <EventsCalendarView
      title="עמוד מפיק"
      subtitle="צרו אירועים, בחרו מנות ואשרו אותם להעברה לביצוע — מתוך עמוד האירוע"
      producerMode={isProducerRole}
    />
  );
}
