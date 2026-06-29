-- inserts padronizados em letras minusculas
insert into tipo_estabelecimento (nome_tipo) values ('loja'), ('salao'), ('clinica');

INSERT INTO tipo_estabelecimento (nome_tipo)
VALUES ('barbearia') ON CONFLICT (nome_tipo) DO NOTHING;

-- Usuários de teste (senha em texto plano — APENAS desenvolvimento)
-- Em produção, criar via Supabase Auth (Authentication > Users) e remover senha_usuario
INSERT INTO usuarios (nome_usuario, email_usuario)
VALUES ('Admin', 'admin@apex.com') ON CONFLICT (email_usuario) DO NOTHING;

INSERT INTO usuarios (nome_usuario, email_usuario)
VALUES ('Livia', 'lilipds@gmail.com') ON CONFLICT (email_usuario) DO NOTHING;

-- ── RLS POLICIES ─────────────────────────────────────────────────────────────
-- Rodar no SQL Editor do Supabase após habilitar RLS na tabela usuarios

-- Usuário autenticado lê apenas o próprio registro
CREATE POLICY "usuarios podem ler proprio perfil"
  ON usuarios FOR SELECT
  TO authenticated
  USING (email_usuario = auth.jwt() ->> 'email');

-- Usuário autenticado atualiza apenas o próprio registro
CREATE POLICY "usuarios podem atualizar proprio perfil"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (email_usuario = auth.jwt() ->> 'email');
