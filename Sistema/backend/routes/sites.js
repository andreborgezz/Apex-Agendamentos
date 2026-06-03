// routes/site.js
import express from 'express'
import { supabase } from '../database.js'

const router = express.Router()

// 1. CREATE - Cadastrar um novo site/cliente
router.post('/cadastrar', async (req, res) => {
    const { id_usuario, id_tipo, nome_site, link, cor_site, logo_loja, layout, calendario_id } = req.body

    const { data, error } = await supabase
        .from('site')
        .insert([{ id_usuario, id_tipo, nome_site, link, cor_site, logo_loja, layout, calendario_id }])
        .select()

    if (error) return res.status(400).json(error)
    res.status(201).json(data)
})

// 2. READ - Buscar dados de um site específico pelo link (o que o front-end usa)
router.get('/:link', async (req, res) => {
    const { link } = req.params
    const { data, error } = await supabase
        .from('site')
        .select('*')
        .eq('link', link)
        .single()

    if (error || !data) return res.status(404).json({ mensagem: 'Site não encontrado' })
    res.json(data)
})

// 3. UPDATE - Atualizar configurações (mudar cor, logo, etc)
router.put('/atualizar/:id_site', async (req, res) => {
    const { id_site } = req.params
    const dadosAtualizados = req.body

    const { data, error } = await supabase
        .from('site')
        .update(dadosAtualizados)
        .eq('id_site', id_site)
        .select()

    if (error) return res.status(400).json(error)
    res.json(data)
})

// 4. DELETE - Remover um site
router.delete('/remover/:id_site', async (req, res) => {
    const { id_site } = req.params
    const { error } = await supabase
        .from('site')
        .delete()
        .eq('id_site', id_site)

    if (error) return res.status(400).json(error)
    res.json({ mensagem: 'Site removido com sucesso' })
})

export default router