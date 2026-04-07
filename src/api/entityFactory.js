import { supabase } from './supabaseClient';

/**
 * Creates a Base44-compatible entity API backed by Supabase.
 * Supports: list(orderBy?, limit?), filter(obj), create(data), update(id, data), delete(id), bulkCreate(arr)
 */
export function createEntity(tableName) {
  return {
    async list(orderBy = 'created_date', limit = null) {
      const ascending = !orderBy.startsWith('-');
      const column = orderBy.replace(/^-/, '');
      let query = supabase
        .from(tableName)
        .select('*')
        .order(column, { ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async filter(filters = {}) {
      let query = supabase.from(tableName).select('*');
      for (const [key, value] of Object.entries(filters)) {
        if (value === null || value === undefined) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
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
