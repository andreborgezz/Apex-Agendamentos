// routes/usuarios.js
import express from 'express'
import { supabase } from '../database.js'

const router = express.Router()

// 1. CREATE - Cadastrar o dono do estabelecimento (SaaS Admin)
router.post('/registrar', async (req, res) => {
    const { nome_usuario, email_usuario, senha_usuario, cnpj } = req.body

    // Dica: No futuro, adicione uma lib como 'bcrypt' para criptografar essa senha!
    const { data, error } = await supabase
        .from('usuarios')
        .insert([{ nome_usuario, email_usuario, senha_usuario, cnpj }])
        .select()

    if (error) return res.status(400).json(error)
    res.status(201).json(data)
})

// 2. READ - Buscar perfil do usuário (para o Dashboard do Core)
router.get('/:id', async (req, res) => {
    const { id } = req.params
    const { data, error } = await supabase
        .from('usuarios')
        .select('id_usuario, nome_usuario, email_usuario, cnpj')
        .eq('id_usuario', id)
        .single()

    if (error || !data) return res.status(404).json({ mensagem: 'Usuário não encontrado' })
    res.json(data)
})

// 3. UPDATE - Atualizar dados do perfil
router.put('/:id', async (req, res) => {
    const { id } = req.params
    const { data, error } = await supabase
        .from('usuarios')
        .update(req.body)
        .eq('id_usuario', id)
        .select()

    if (error) return res.status(400).json(error)
    res.json(data)
})

export default router