-- inserts padronizados em letras minusculas
insert into tipo_estabelecimento (nome_tipo) values ('loja'), ('salao'), ('clinica');

INSERT INTO tipo_estabelecimento (nome_tipo) 
VALUES ('barbearia') ON CONFLICT (nome_tipo) DO NOTHING; 
INSERT INTO usuarios (nome_usuario, email_usuario, senha_usuario) 
VALUES ('Admin', 'admin@apex.com', 'Andre10efaixa!') ON CONFLICT (email_usuario) DO NOTHING;

insert into usuarios (nome_usuario, email_usuario, senha_usuario) 
values ('Livia','lilipds@gmail.com','123456') on conflict (email_usuario) do nothing;