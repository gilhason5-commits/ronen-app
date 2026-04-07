import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { employee_name, summary_text, issues_text } = await req.json();

        if (!employee_name || !summary_text) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const record = await base44.asServiceRole.entities.WorkSummary.create({
            employee_name,
            summary_text,
            issues_text: issues_text || '',
        });

        return Response.json({ success: true, id: record.id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});