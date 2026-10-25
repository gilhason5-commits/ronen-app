-- Order of the dish categories for serving events, as the event page's
-- "by category" dish picker shows them: reception, starters, mains (kids'
-- dishes right after), desserts, after party, soft drinks, wine, alcohol,
-- consumables. Several serving categories had display_order 0 and so sat
-- above the reception. Wedding categories were already in order.
update "Category" c set display_order = v.ord
from (values
  ('קבלת פנים', 1),
  ('מנות ראשונות', 2),
  ('מנות עיקריות', 3),
  ('מנות ילדים', 4),
  ('קינוחים', 5),
  ('אפטר פארטי', 6),
  ('שתייה קלה', 7),
  ('יינות', 8),
  ('משקאות', 9),
  ('טקסטיל', 10)
) as v(name, ord)
where c.event_type = 'serving' and trim(c.name) = v.name;
