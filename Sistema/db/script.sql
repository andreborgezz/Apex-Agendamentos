-- tabela: usuarios
create table usuarios (
  id_usuario int generated always as identity primary key,
  nome_usuario varchar(255) not null,
  email_usuario varchar(255) unique not null,
  senha_usuario varchar(255) not null,
  cnpj varchar(20)
);

-- tabela: tipo_estabelecimento
create table tipo_estabelecimento (
  id_tipo int generated always as identity primary key,
  nome_tipo varchar(100) not null unique
);

-- tabela: site
create table site (
  id_site int generated always as identity primary key,
  id_usuario int not null references usuarios(id_usuario) on delete cascade,
  id_tipo int not null references tipo_estabelecimento(id_tipo) on delete restrict,
  nome_site varchar(255) not null,
  link varchar(255) unique not null,
  cor_site varchar(100),
  logo_loja varchar(255),
  layout varchar(50),
  calendario_id varchar(255) not null
);

-- tabela: clientes_do_site
create table clientes_do_site (
  id_cliente int generated always as identity primary key,
  id_site int not null references site(id_site) on delete cascade,
  nome_cliente varchar(255) not null,
  email_cliente varchar(255) unique not null,
  telefone_cliente varchar(20)
);

-- tabela: servicos
create table servicos (
  id_servico int generated always as identity primary key,
  id_site int not null references site(id_site) on delete cascade,
  nome_servico varchar(255) not null,
  descricao varchar(500),
  duracao varchar(50),
  preco decimal(10, 2) 
);

-- tabela: regras_de_horarios
create table regras_de_horarios (
  id int generated always as identity primary key,
  id_site int references site(id_site) on delete cascade, -- corrigido: a regra pertence ao site
  dia_semana int check (dia_semana >= 0 and dia_semana <= 6),
  abertura time not null,
  fechamento time not null,
  duracao varchar(50) not null
);

-- tabela: agendamentos_confirmados
create table agendamentos_confirmados (
  id int generated always as identity primary key,
  id_site int references site(id_site) on delete cascade, -- corrigido: o agendamento pertence ao site
  id_cliente int references clientes_do_site(id_cliente) on delete cascade, -- adicionado para saber qual cliente agendou
  id_servico int references servicos(id_servico) on delete set null, -- adicionado para vincular o serviço real da tabela
  data_hora timestamp with time zone not null
);

