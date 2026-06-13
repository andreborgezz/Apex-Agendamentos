import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import usuariosRoutes from './routes/usuarios.js'
import sitesRoutes from './routes/sites.js'
import servicosRoutes from './routes/servicos.js'
import agendamentosRoutes from './routes/agendamentos.js'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const PORT = process.env.PORT || 3333
const app = express()

// CORS — permite o frontend local chamar a API
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json())

// Rotas
app.use('/usuarios', usuariosRoutes)
app.use('/site', sitesRoutes)
app.use('/servicos', servicosRoutes)
app.use('/agendamentos', agendamentosRoutes)

// Verifica se as variáveis foram carregadas para não dar erro de conexão
if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: Variáveis SUPABASE_URL ou SUPABASE_ANON_KEY não encontradas no .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Teste simples de conexão (opcional)
async function testConnection() {
    const { data, error } = await supabase.from('tipo_estabelecimento').select('count').single()
    if (error) {
        console.error('Erro ao conectar no Supabase:', error.message)
    } else {
        console.log('Conexão com o Supabase estabelecida com sucesso!')
    }
}

testConnection()

app.listen(PORT, () => {
    console.log(`🚀 API Apex rodando em http://localhost:${PORT}`)
})