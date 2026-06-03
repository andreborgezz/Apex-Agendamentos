// routes/agendamentos.js
import express from 'express'
import { supabase } from '../database.js'

const router = express.Router()

// Rota para buscar horários disponíveis (O ponto crucial do sistema)
router.get('/disponibilidade', async (req, res) => {
    const { id_site, data, id_servico } = req.query // Ex: ?id_site=1&data=2026-06-10&id_servico=5

    try {
        // 1. Busca as regras de funcionamento do site para aquele dia da semana
        const dataObj = new Date(data)
        const diaSemana = dataObj.getUTCDay()

        const { data: regras, error: erroRegras } = await supabase
            .from('regras_de_horarios')
            .select('*')
            .eq('id_site', id_site)
            .eq('dia_semana', diaSemana)
            .single()

        if (erroRegras || !regras) {
            return res.status(404).json({ mensagem: 'Estabelecimento fechado neste dia.' })
        }

        // 2. Busca a duração do serviço selecionado
        const { data: servico } = await supabase
            .from('servicos')
            .select('duracao')
            .eq('id_servico', id_servico)
            .single()

        const duracaoServico = servico?.duracao || regras.duracao

        // 3. Lógica para gerar os slots (Aqui entrará a integração com Google Calendar no futuro)
        // Por enquanto, vamos gerar os horários baseados apenas nas regras do banco
        let horariosDisponiveis = []
        let horarioAtual = regras.abertura // Ex: "08:00"
        const horarioFim = regras.fechamento // Ex: "18:00"

        // [LÓGICA SIMPLIFICADA PARA TESTE]
        // Transformar strings de tempo em minutos para facilitar o cálculo
        // No próximo passo, adicionaremos o filtro do Google Calendar aqui

        res.json({
            dia: data,
            servico_duracao: duracaoServico,
            regras_do_dia: { abertura: regras.abertura, fechamento: regras.fechamento },
            mensagem: "Pronto para integrar com Google Calendar e filtrar conflitos."
        })

    } catch (err) {
        res.status(500).json({ mensagem: 'Erro ao processar disponibilidade.' })
    }
})

export default router