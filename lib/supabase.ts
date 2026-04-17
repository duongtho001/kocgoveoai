import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ozuiiacjwzqyspalsvma.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dWlpYWNqd3pxeXNwYWxzdm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgxNzcsImV4cCI6MjA5MTkwNDE3N30.e7Y6_oZSUhS2K5VsctFkUmWL0MoLjr_PagcP2aYdl7k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
