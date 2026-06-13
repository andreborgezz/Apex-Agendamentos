/**
 * components/supabase.js
 * Instância única do cliente Supabase — importar em todas as páginas.
 * ❌ Nunca instanciar createClient fora deste arquivo.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://skczsvooozoyxrazcvqk.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Dhj2rISOx8NucZOWIdMqzA_lAT3Z_zC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
