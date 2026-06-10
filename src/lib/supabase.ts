import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adsjwkdhfjpcrhqsjezz.supabase.co';
const supabaseKey = 'sb_publishable_v69cNViHMfA1aDWphcDxPg_3-Ml0IIR';

export const supabase = createClient(supabaseUrl, supabaseKey);
