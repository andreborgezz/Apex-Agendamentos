// routes/agendamentos.js
import express from 'express'
import { supabase } from '../database.js'

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

// 1. ROTA DE DISPONIBILIDADE (Busca os horários livres cruzando Banco)
router.get('/disponibilidade', async (req, res) => {
    const { id_site, data, id_servico } = req.query

    try {
        // Busca as regras de funcionamento
        const dataObj = new Date(data);
        const diaSemana = dataObj.getUTCDay();
        
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
        const duracaoStr = servico?.duracao || regras.duracao;
        const duracao = parseInt(duracaoStr, 10);

        // Busca eventos ocupados apenas no banco
        const inicioDia = `${data}T00:00:00.000Z`;
        const fimDia = `${data}T23:59:59.999Z`;

        const { data: agendamentos, error: errAgendamentos } = await supabase
            .from('agendamentos_confirmados')
            .select('data_hora, servicos(duracao)')
            .eq('id_site', id_site)
            .gte('data_hora', inicioDia)
            .lte('data_hora', fimDia);

        if (errAgendamentos) throw errAgendamentos;

        const ocupados = agendamentos.map(ag => {
            const inicio = new Date(ag.data_hora).getTime();
            const dur = parseInt(ag.servicos?.duracao || '30', 10);
            const fim = inicio + (dur * 60000);
            return { inicio, fim };
        });

        // Lógica de geração e filtragem de slots
        let slotsLivres = [];
        let atual = paraMinutos(regras.abertura);
        const fim = paraMinutos(regras.fechamento);

        while (atual + duracao <= fim) {
            const horarioInicio = paraTexto(atual);
            const isoInicio = `${data}T${horarioInicio}:00Z`;
            
            const slotInicio = new Date(isoInicio).getTime();
            const slotFim = slotInicio + (duracao * 60000);
            
            // Verifica se este slot bate com algum evento no banco
            const estaOcupado = ocupados.some(evento => {
                return (slotInicio < evento.fim && slotFim > evento.inicio);
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
        console.error(err);
        res.status(500).json({ mensagem: 'Erro ao calcular disponibilidade.' });
    }
});

// 2. ROTA DE CONFIRMAÇÃO (Salva apenas no Supabase)
router.post('/confirmar', async (req, res) => {
    const { id_site, id_cliente, id_servico, data_hora } = req.body

    try {
        const inicio = new Date(data_hora);

        // Salva no banco de dados do Supabase
        const { data: agendamento, error } = await supabase
            .from('agendamentos_confirmados')
            .insert([{
                id_site,
                id_cliente,
                id_servico,
                data_hora: inicio.toISOString()
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