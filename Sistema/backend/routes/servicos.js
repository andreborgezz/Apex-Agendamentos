// routes/servicos.js
import express from 'express'
import { supabase } from '../database.js'

const router = express.Router()

// 1. cadastrar um novo serviço para um site específico
router.post('/', async (req, res) => {
    const { id_site, nome_servico, descricao, duracao, preco } = req.body

    const { data, error } = await supabase
        .from('servicos')
        .insert([{ id_site, nome_servico, descricao, duracao, preco }])
        .select()

    if (error) return res.status(400).json(error)
    res.status(201).json(data)
})

// 2. listar todos os serviços de um site (usado no front-end do agendamento)
router.get('/site/:id_site', async (req, res) => {
    const { id_site } = req.params
    const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('id_site', id_site)

    if (error) return res.status(400).json(error)
    res.json(data)
})

// 3. atualizar um serviço (mudar preço ou tempo)
router.put('/:id_servico', async (req, res) => {
    const { id_servico } = req.params
    const { data, error } = await supabase
        .from('servicos')
        .update(req.body)
        .eq('id_servico', id_servico)
        .select()

    if (error) return res.status(400).json(error)
    res.json(data)
})

// 4. remover um serviço
router.delete('/:id_servico', async (req, res) => {
    const { id_servico } = req.params
    const { error } = await supabase
        .from('servicos')
        .delete()
        .eq('id_servico', id_servico)

    if (error) return res.status(400).json(error)
    res.json({ mensagem: 'serviço removido com sucesso' })
})

export default router