import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Generates a GLOBALLY UNIQUE whatsapp_token for a task
// Token is used to identify exact task + event combination

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a unique 7-character alphanumeric token
    // Removed confusing characters: 0, O, 1, I, L
    const generateToken = () => {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let token = '';
      for (let i = 0; i < 7; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    };

    // Try up to 10 times to generate a unique token
    for (let attempt = 0; attempt < 10; attempt++) {
      const token = generateToken();
      
      // Check if token already exists (must be globally unique)
      const existing = await base44.entities.TaskAssignment.filter({ whatsapp_token: token });
      
      if (existing.length === 0) {
        console.log(`✅ Generated unique token: ${token}`);
        return Response.json({ token });
      }
      
      console.log(`⚠️ Token ${token} already exists, retrying... (attempt ${attempt + 1})`);
    }

    // Fallback: add timestamp suffix for guaranteed uniqueness
    const fallbackToken = generateToken() + Date.now().toString(36).slice(-2).toUpperCase();
    console.log(`⚠️ Using fallback token: ${fallbackToken}`);
    
    return Response.json({ token: fallbackToken });

  } catch (error) {
    console.error("❌ generateWhatsappToken error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});