// services/googleCalendar.js
import { google } from 'googleapis';
import path from 'path';

const KEYPATH = path.join(process.cwd(), 'google-key.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEYPATH,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

/**
 * Busca compromissos reais no Google para filtrar os horários livres
 */
export const listarEventosOcupados = async (calendarId, inicio, fim) => {
  try {
    const res = await calendar.events.list({
      calendarId: calendarId,
      timeMin: inicio, // Formato ISO: 2026-06-04T08:00:00Z
      timeMax: fim,    // Formato ISO: 2026-06-04T18:00:00Z
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items || [];
  } catch (err) {
    console.error("Erro ao buscar agenda:", err.message);
    return [];
  }
};

/**
 * Cria um novo agendamento no Google Calendar
 */
export const criarEventoNoGoogle = async (calendarId, resumo, descricao, inicio, fim) => {
  const evento = {
    summary: resumo,
    description: descricao,
    start: { dateTime: inicio, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: fim, timeZone: 'America/Sao_Paulo' },
  };

  try {
    const res = await calendar.events.insert({
      calendarId: calendarId,
      resource: evento,
    });
    return res.data.id; // Retorna o ID do evento para salvar no banco
  } catch (err) {
    console.error('Erro ao criar evento no Google:', err.message);
    throw err;
  }
};