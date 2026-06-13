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

// 4. LOGIN - Autenticar o dono do estabelecimento
router.post('/login', async (req, res) => {
    const { email_usuario, senha_usuario } = req.body

    if (!email_usuario || !senha_usuario) {
        return res.status(400).json({ mensagem: 'E-mail e senha são obrigatórios.' })
    }

    const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('id_usuario, nome_usuario, email_usuario, cnpj')
        .eq('email_usuario', email_usuario)
        .eq('senha_usuario', senha_usuario)
        .maybeSingle()

    if (error) return res.status(500).json({ mensagem: 'Erro ao autenticar.' })
    if (!usuario) return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' })

    // Busca o site vinculado ao usuário
    const { data: site } = await supabase
        .from('site')
        .select('id_site, nome_site, link')
        .eq('id_usuario', usuario.id_usuario)
        .maybeSingle()

    res.json({
        usuario,
        site: site || null,
    })
})

export default router