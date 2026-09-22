import { supabase } from './supabaseClient';

// Supabase/PostgREST caps a single response at 1000 rows by default. Any
// table that grows past that would have silently truncated results from a
// plain .select() — page through with .range() so list()/filter() always
// return everything, not just the first page.
const PAGE_SIZE = 1000;

async function fetchAllPages(buildQuery) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/**
 * Creates a Base44-compatible entity API backed by Supabase.
 * Supports: list(orderBy?, limit?), filter(obj), create(data), update(id, data), delete(id), bulkCreate(arr)
 */
export function createEntity(tableName) {
  return {
    async list(orderBy = 'created_date', limit = null) {
      const ascending = !orderBy.startsWith('-');
      const column = orderBy.replace(/^-/, '');
      if (limit) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order(column, { ascending })
          .limit(limit);
        if (error) throw error;
        return data;
      }
      return fetchAllPages(() =>
        supabase.from(tableName).select('*').order(column, { ascending })
      );
    },

    async filter(filters = {}) {
      return fetchAllPages(() => {
        let query = supabase.from(tableName).select('*');
        for (const [key, value] of Object.entries(filters)) {
          if (value === null || value === undefined) {
            query = query.is(key, null);
          } else if (Array.isArray(value)) {
            // Batch lookup by a set of ids/values in one round-trip instead
            // of the caller looping and filtering one-by-one.
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
        return query;
      });
    },

    async create(data) {
      const { data: created, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },

    async update(id, data) {
      const { data: updated, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id };
    },

    async bulkCreate(rows) {
      if (!rows || rows.length === 0) return [];
      const { data, error } = await supabase
        .from(tableName)
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
  };
}
