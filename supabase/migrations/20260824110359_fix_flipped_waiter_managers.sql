-- The "flipped" (הפוכה) waiter formula was subtracting too many roles from
-- guests/10: it excluded only מארחת/מארחת נוספת/ניהול כניסה, which left
-- ראנר שני and מזנונים counted as "managers" too. Per the real תקן, only
-- 5 roles count as managers below 300 guests (מנהל אירוע, פלור 1,
-- מנהל מרפסת, ראנר, סומלייה), growing to 6 at 300+ guests once פלור 2
-- kicks in.
update "StaffingRule"
set params = jsonb_set(
      params,
      '{exclude_roles}',
      '["מארחת", "מארחת נוספת", "ניהול כניסה", "מזנונים", "ראנר שני"]'::jsonb
    ),
    explanation = 'הפוכה: כמות סופית ÷ 10 פחות 5 מנהלים (מנהל אירוע, פלור 1, מנהל מרפסת, ראנר, סומלייה); מעל 300 סועדים מתווסף פלור 2 ל-6'
where rule_type = 'WAITER_FORMULA' and event_format = 'flipped';

-- Confirmed correct: שטיפת סירים is a single fixed role above 200 guests
-- (no further tiers like מדיח). Clears the "לברר" note left from the
-- original transcription of the standards document.
update "StaffingRule"
set explanation = 'שטיפת סירים — מעל 200 סועדים, איש אחד קבוע'
where rule_type = 'OPS' and role_name = 'שטיפת סירים';
