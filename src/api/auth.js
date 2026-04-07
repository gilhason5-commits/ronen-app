import { supabase } from './supabaseClient';

/**
 * Base44-compatible auth API backed by Supabase Auth.
 */
export const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'user',
      full_name: user.user_metadata?.full_name || user.email,
      // preserve any custom order keys stored in metadata
      ...user.user_metadata,
    };
  },

  async updateMe(updates) {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    });
    if (error) throw error;
    return data;
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    window.location.href = redirectUrl || '/';
  },

  redirectToLogin(redirectUrl) {
    const params = redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : '';
    window.location.href = `/login${params}`;
  },
};
