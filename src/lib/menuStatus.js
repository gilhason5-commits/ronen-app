// Event.menu_status — where the menu stands with the couple, separate from
// the event's own status (ממתין לאישור / מאושר / הושלם). Set from the event
// page (office or producer); a closed menu shows as a dot on the calendar.
export const MENU_STATUSES = {
  open: "תפריט פתוח",
  closed: "תפריט סגור",
};

export const isMenuClosed = (event) => event?.menu_status === "closed";
