// routes/usuarios.js
import express  from 'express'
import bcrypt   from 'bcrypt'
import { supabase } from '../database.js'

const router       = express.Router()
const SALT_ROUNDS  = 12

// POST /usuarios/registrar
router.post('/registrar', async (req, res) => {
    const { nome_usuario, email_usuario, senha_usuario, cnpj } = req.body

    if (!nome_usuario || !email_usuario || !senha_usuario) {
        return res.status(400).json({ mensagem: 'Nome, e-mail e senha são obrigatórios.' })
    }

    const { data: existing } = await supabase
        .from('usuarios')
        .select('id_usuario')
        .eq('email_usuario', email_usuario)
        .maybeSingle()

    if (existing) {
        return res.status(409).json({ mensagem: 'Este e-mail já está cadastrado.' })
    }

    const hash = await bcrypt.hash(senha_usuario, SALT_ROUNDS)

    const { data, error } = await supabase
        .from('usuarios')
        .insert([{ nome_usuario, email_usuario, senha_usuario: hash, cnpj: cnpj || null }])
        .select('id_usuario, nome_usuario, email_usuario, cnpj')
        .single()

    if (error) return res.status(400).json({ mensagem: error.message })
    res.status(201).json(data)
})

// POST /usuarios/login
router.post('/login', async (req, res) => {
    const { email_usuario, senha_usuario } = req.body

    if (!email_usuario || !senha_usuario) {
        return res.status(400).json({ mensagem: 'E-mail e senha são obrigatórios.' })
    }

    const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('id_usuario, nome_usuario, email_usuario, cnpj, senha_usuario')
        .eq('email_usuario', email_usuario)
        .maybeSingle()

    if (error) return res.status(500).json({ mensagem: 'Erro ao autenticar.' })
    if (!usuario) return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' })

    const senhaOk = await bcrypt.compare(senha_usuario, usuario.senha_usuario)
    if (!senhaOk) return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' })

    const { senha_usuario: _, ...perfil } = usuario

    const { data: site } = await supabase
        .from('site')
        .select('id_site, nome_site, link')
        .eq('id_usuario', perfil.id_usuario)
        .maybeSingle()

    res.json({ usuario: perfil, site: site || null })
})

// GET /usuarios/:id
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

// PUT /usuarios/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params
    const body = { ...req.body }
    if (body.senha_usuario) {
        body.senha_usuario = await bcrypt.hash(body.senha_usuario, SALT_ROUNDS)
    }
    const { data, error } = await supabase
        .from('usuarios')
        .update(body)
        .eq('id_usuario', id)
        .select('id_usuario, nome_usuario, email_usuario, cnpj')

    if (error) return res.status(400).json({ mensagem: error.message })
    res.json(data)
})

export default router