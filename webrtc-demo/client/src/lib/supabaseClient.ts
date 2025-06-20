import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yopeziorcvzjqczlqnua.supabase.co';
const supabaseAnonKey = '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});
