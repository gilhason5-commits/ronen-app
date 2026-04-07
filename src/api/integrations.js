import { supabase } from './supabaseClient';

/**
 * Integrations — Vercel API route equivalents of the Base44 integration helpers.
 * Each function calls a /api/* Vercel serverless function.
 */

async function callApi(endpoint, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

export const InvokeLLM = ({ prompt, response_json_schema } = {}) =>
  callApi('llm', { prompt, response_json_schema });

export const SendEmail = ({ to, subject, body } = {}) =>
  callApi('send-email', { to, subject, body });

export const SendSMS = ({ to, body } = {}) =>
  callApi('send-sms', { to, body });

export const UploadFile = async ({ file } = {}) => {
  const fileName = `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, file, { upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return { file_url: publicUrl, file_name: file.name };
};

export const GenerateImage = ({ prompt } = {}) =>
  callApi('generate-image', { prompt });

export const ExtractDataFromUploadedFile = ({ file_url, json_schema } = {}) =>
  callApi('extract-data', { file_url, json_schema });

export const Core = {
  InvokeLLM,
  SendEmail,
  SendSMS,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
};
