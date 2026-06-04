// routes/agendamentos.js
import express from 'express'
import { supabase } from '../database.js'
import { listarEventosOcupados, criarEventoNoGoogle } from '../services/googleCalendar.js'

const router = express.Router()

// Função auxiliar para converter "HH:mm" em minutos totais
const paraMinutos = (texto) => {
    const [horas, minutos] = texto.split(':').map(Number);
    return horas * 60 + minutos;
};

// Função auxiliar para converter minutos totais em "HH:mm"
const paraTexto = (minutos) => {
    const h = Math.floor(minutos / 60).toString().padStart(2, '0');
    const m = (minutos % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

// 1. ROTA DE DISPONIBILIDADE (Busca os horários livres cruzando Banco + Google)
router.get('/disponibilidade', async (req, res) => {
    const { id_site, data, id_servico } = req.query

    try {
        // Busca os dados do site para pegar o calendário do google
        const { data: site } = await supabase.from('site').select('calendario_id').eq('id_site', id_site).single();

        // Busca as regras de funcionamento
        const diaSemana = new Date(data).getUTCDay();
        const { data: regras, error: erroRegras } = await supabase
            .from('regras_de_horarios')
            .select('*')
            .eq('id_site', id_site)
            .eq('dia_semana', diaSemana)
            .single();

        if (erroRegras || !regras) {
            return res.status(404).json({ mensagem: 'Estabelecimento fechado neste dia.' });
        }

        // Busca a duração do serviço
        const { data: servico } = await supabase.from('servicos').select('duracao').eq('id_servico', id_servico).single();
        const duracao = servico?.duracao || regras.duracao;

        // Busca eventos ocupados no google calendar
        const inicioBusca = `${data}T${regras.abertura}:00Z`;
        const fimBusca = `${data}T${regras.fechamento}:00Z`;
        const ocupados = await listarEventosOcupados(site.calendario_id, inicioBusca, fimBusca);

        // Lógica de geração e filtragem de slots
        let slotsLivres = [];
        let atual = paraMinutos(regras.abertura);
        const fim = paraMinutos(regras.fechamento);

        while (atual + duracao <= fim) {
            const horarioInicio = paraTexto(atual);
            const isoInicio = `${data}T${horarioInicio}:00Z`;
            
            // Verifica se este slot bate com algum evento do google
            const estaOcupado = ocupados.some(evento => {
                const evInicio = new Date(evento.start.dateTime || evento.start.date).getTime();
                const evFim = new Date(evento.end.dateTime || evento.end.date).getTime();
                const slotInicio = new Date(isoInicio).getTime();
                const slotFim = slotInicio + (duracao * 60000);

                return (slotInicio < evFim && slotFim > evInicio);
            });

            if (!estaOcupado) {
                slotsLivres.push(horarioInicio);
            }
            atual += duracao; // Pula para o próximo bloco
        }

        res.json({
            data,
            horarios_disponiveis: slotsLivres
        });

    } catch (err) {
        res.status(500).json({ mensagem: 'Erro ao calcular disponibilidade.' });
    }
});

// 2. ROTA DE CONFIRMAÇÃO (Salva no Supabase e insere o evento no Google Calendar)
router.post('/confirmar', async (req, res) => {
    const { id_site, id_cliente, id_servico, data_hora } = req.body

    try {
        // Busca detalhes para o convite (nome do site, calendário, nome do serviço)
        const { data: site } = await supabase.from('site').select('*').eq('id_site', id_site).single();
        const { data: servico } = await supabase.from('servicos').select('*').eq('id_servico', id_servico).single();
        const { data: cliente } = await supabase.from('clientes_do_site').select('*').eq('id_cliente', id_cliente).single();

        // Calcula horário de fim baseado na duração
        const inicio = new Date(data_hora);
        const fim = new Date(inicio.getTime() + servico.duracao * 60000);

        // Cria o evento no Google Calendar
        const resumo = `${servico.nome_servico} - ${cliente.nome_cliente}`;
        const descricao = `Agendamento realizado via Core Autonomous.\nCliente: ${cliente.nome_cliente}\nE-mail: ${cliente.email_cliente}`;
        
        const googleEventId = await criarEventoNoGoogle(
            site.calendario_id,
            resumo,
            descricao,
            inicio.toISOString(),
            fim.toISOString()
        );

        // Salva no banco de dados do Supabase
        const { data: agendamento, error } = await supabase
            .from('agendamentos_confirmados')
            .insert([{
                id_site,
                id_cliente,
                id_servico,
                data_hora: inicio.toISOString(),
                google_event_id: googleEventId
            }])
            .select()

        if (error) throw error;

        res.status(201).json({
            mensagem: "Agendamento confirmado com sucesso!",
            detalhes: agendamento[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ mensagem: 'Erro ao confirmar agendamento.' });
    }
});

export default router;