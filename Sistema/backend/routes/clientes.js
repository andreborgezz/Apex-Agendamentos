// routes/clientes.js
import express from 'express'
import { supabase } from '../database.js'

const router = express.Router()

// 1. CREATE - Cadastrar um novo lead (captado pelo robô de atendimento)
router.post('/registrar', async (req, res) => {
    const { id_site, nome_cliente, email_cliente, telefone_cliente } = req.body

    const { data, error } = await supabase
        .from('clientes_do_site')
        .insert([{ id_site, nome_cliente, email_cliente, telefone_cliente }])
        .select()

    if (error) return res.status(400).json(error)
    res.status(201).json(data)
})

// 2. READ - Listar todos os clientes de um estabelecimento específico
router.get('/site/:id_site', async (req, res) => {
    const { id_site } = req.params
    const { data, error } = await supabase
        .from('clientes_do_site')
        .select('*')
        .eq('id_site', id_site)

    if (error) return res.status(400).json(error)
    res.json(data)
})

// 3. READ - Buscar um cliente específico pelo e-mail (para evitar duplicados)
router.get('/busca', async (req, res) => {
    const { email } = req.query
    const { data, error } = await supabase
        .from('clientes_do_site')
        .select('*')
        .eq('email_cliente', email)
        .single()

    if (error) return res.status(404).json({ mensagem: 'cliente não encontrado' })
    res.json(data)
})

// 4. DELETE - Remover um cliente da base (LGPD/Privacidade)
router.delete('/:id', async (req, res) => {
    const { id } = req.params
    const { error } = await supabase
        .from('clientes_do_site')
        .delete()
        .eq('id_cliente', id)

    if (error) return res.status(400).json(error)
    res.json({ mensagem: 'cliente removido com sucesso' })
})

export default router