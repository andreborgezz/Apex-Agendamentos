// teste-agenda.js
import { google } from 'googleapis';
import path from 'path';

// Seu ID da agenda que você copiou no Passo 1
const GOOGLE_CALENDAR_ID = 'borges01andre@gmail.com';

const KEYPATH = path.join(process.cwd(), 'google-key.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEYPATH,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

async function executarTeste() {
  console.log("Iniciando teste de conexão com o Google Calendar...");
  try {
    const res = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: new Date().toISOString(),
      maxResults: 5,
      singleEvents: true,
      orderBy: 'startTime',
    });

    console.log("\n✅ CONEXÃO CONCLUÍDA COM SUCESSO!");
    console.log(`Próximos compromissos encontrados na agenda (${res.data.items.length}):`);
    
    res.data.items.forEach(evento => {
      console.log(`- ${evento.summary} (${evento.start.dateTime || evento.start.date})`);
    });

  } catch (err) {
    console.error("\n❌ ERRO NA INTEGRAÇÃO:");
    console.error(err.message);
    console.log("\nDica de verificação:");
    console.log("1. Confira se o ID da agenda está correto.");
    console.log("2. Certifique-se de que compartilhou a agenda com o e-mail da Service Account dando permissão para 'Fazer alterações em eventos'.");
  }
}

executarTeste();