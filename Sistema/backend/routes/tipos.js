// routes/tipos.js
import express from 'express'
import { supabase } from '../database.js'

const router = express.Router()

// 1. CREATE - Adicionar um novo nicho de mercado
router.post('/cadastrar', async (req, res) => {
  const { nome_tipo } = req.body

  const { data, error } = await supabase
    .from('tipo_estabelecimento')
    .insert([{ nome_tipo: nome_tipo.toLowerCase() }])
    .select()

  if (error) return res.status(400).json(error)
  res.status(201).json(data)
})

// 2. READ - Listar todos os tipos (usado no Select do Front-end)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('tipo_estabelecimento')
    .select('*')
    .order('nome_tipo', { ascending: true })

  if (error) return res.status(400).json(error)
  res.json(data)
})

// 3. UPDATE - Editar o nome de um tipo existente
router.put('/atualizar/:id', async (req, res) => {
  const { id } = req.params
  const { nome_tipo } = req.body

  const { data, error } = await supabase
    .from('tipo_estabelecimento')
    .update({ nome_tipo: nome_tipo.toLowerCase() })
    .eq('id_tipo', id)
    .select()

  if (error) return res.status(400).json(error)
  res.json(data)
})

// 4. DELETE - Remover um tipo de estabelecimento
router.delete('/remover/:id', async (req, res) => {
  const { id } = req.params
  const { error } = await supabase
    .from('tipo_estabelecimento')
    .delete()
    .eq('id_tipo', id)

  if (error) return res.status(400).json(error)
  res.json({ mensagem: 'Tipo de estabelecimento removido com sucesso' })
})

export default router