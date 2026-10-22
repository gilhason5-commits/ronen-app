-- Updated pot-washing (שטיפת סירים) standard: one worker at any guest count
-- (was only above 200), with the arrival tiers spelled out. The hours
-- themselves are applied as defaults in the kitchen schedule
-- (potWashDefaultHours in src/lib/kitchenSchedule.js).
update "StaffingRule"
set min_guests = 1,
    max_guests = null,
    quantity = 1,
    explanation = 'שטיפת סירים — עובד 1. הגעה: עד 100 איש 14:00, עד 200 איש 13:00, מעל 200 איש 12:00. סיום לא יאוחר מ-02:00 (חמישי עד 03:00). ראשון אחרי אירוע בשישי — 11:00. יום הכנות — 10:00'
where rule_type = 'OPS' and role_name = 'שטיפת סירים';
