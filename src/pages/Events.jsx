import React from "react";
import EventsCalendarView from "../components/events/EventsCalendarView";

// Events are browsed on a calendar; clicking one opens its page, where its
// approval status and actions (approve / manual approval / delete) live.
export default function Events() {
  return <EventsCalendarView title="אירועים" subtitle="לחצו על אירוע כדי לפתוח אותו, או על יום כדי ליצור בו אירוע חדש" />;
}
