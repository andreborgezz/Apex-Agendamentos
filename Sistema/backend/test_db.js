import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Connecting to:', supabaseUrl);
console.log('Key prefix:', supabaseKey ? supabaseKey.slice(0, 15) : 'undefined');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  try {
    console.log('\n--- 1. TIPO ESTABELECIMENTO ---');
    const { data: tipos, error: tErr } = await supabase.from('tipo_estabelecimento').select('*');
    if (tErr) console.error('Erro:', tErr);
    else console.log('Tipos found:', tipos.length, tipos);

    console.log('\n--- 2. USUARIOS ---');
    const { data: users, error: uErr } = await supabase.from('usuarios').select('id_usuario, nome_usuario, email_usuario');
    if (uErr) console.error('Erro:', uErr);
    else console.log('Users found:', users.length, users);

    console.log('\n--- 3. SITE ---');
    const { data: sites, error: sErr } = await supabase.from('site').select('*');
    if (sErr) console.error('Erro:', sErr);
    else console.log('Sites found:', sites.length, sites);

    console.log('\n--- 4. SERVICOS ---');
    const { data: servicos, error: svErr } = await supabase.from('servicos').select('*');
    if (svErr) console.error('Erro:', svErr);
    else console.log('Servicos found:', servicos.length);

    console.log('\n--- 5. AGENDAMENTOS ---');
    const { data: agendamentos, error: aErr } = await supabase.from('agendamentos_confirmados').select('*');
    if (aErr) console.error('Erro:', aErr);
    else console.log('Agendamentos found:', agendamentos.length);

  } catch (err) {
    console.error('Fatal error:', err);
  }
}

checkAll();
