# Davi Barber - Sistema de Agendamento

Sistema web para barbearia com Supabase, Vercel, agenda inteligente, painel administrativo, mensalistas, bloqueios semanais e integração com Google Agenda.

## Arquitetura

- `Next.js`: frontend e rotas server-side para Vercel.
- `Supabase`: Postgres, dados do sistema e RLS ativado.
- `Google Calendar API`: criação de eventos no Google Agenda pelo servidor.
- `ADMIN_ACCESS_TOKEN`: token simples para login administrativo em `/admin/login`.

As chaves sensíveis ficam no servidor. O navegador não recebe `SUPABASE_SERVICE_ROLE_KEY`, chave privada do Google ou token administrativo.

## Regras implementadas

- Cliente agenda com nome, telefone, serviço, data e horário.
- Cliente precisa criar conta e entrar por `/login` antes de agendar.
- Cliente logado consegue listar os próprios agendamentos.
- Cliente logado consegue cancelar ou reagendar os próprios agendamentos.
- Ao cancelar, o horário volta para a lista de horários disponíveis.
- Ao reagendar, o sistema valida a nova disponibilidade antes de salvar.
- Código privado do agendamento fica como comprovante, não como requisito para listar a agenda do cliente.
- Serviço tem duração própria, como 30 ou 60 minutos.
- Horários só aparecem quando existe espaço suficiente para a duração do serviço.
- Agendamentos ficam restritos à semana de atendimento: segunda a sábado.
- No domingo, o sistema considera a próxima segunda a sábado para preparação da semana.
- O barbeiro pode cadastrar clientes mensalistas.
- O barbeiro pode bloquear dia inteiro ou horários específicos da semana.
- Por padrão, bloqueios só podem ser criados no domingo.
- Ao confirmar agendamento, o sistema tenta criar evento no Google Agenda.

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute `supabase-schema.sql`.
4. Copie `Project URL`, `anon public key` e `service_role key`.
5. Configure as variáveis de ambiente.

O schema deixa RLS ativado e remove políticas públicas amplas. A aplicação usa rotas server-side com service role para aplicar as regras de negócio.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_ACCESS_TOKEN=
GOOGLE_CALENDAR_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
BARBERSHOP_TIMEZONE=America/Sao_Paulo
ALLOW_BLOCKS_OUTSIDE_SUNDAY=false
```

`ADMIN_ACCESS_TOKEN` deve ser um valor longo e difícil de adivinhar. O barbeiro entra por `/admin/login`; o cliente entra por `/login`.

## Google Agenda

A integração usa uma conta de serviço do Google Cloud:

1. Ative a Google Calendar API no projeto Google Cloud.
2. Crie uma Service Account.
3. Gere uma chave JSON.
4. Compartilhe o calendário da barbearia com o email da Service Account.
5. Preencha `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` e `GOOGLE_CALENDAR_ID`.
6. Em `.env.local`, mantenha a chave privada em uma linha usando `\n`, por exemplo:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`GOOGLE_CALENDAR_ID` pode ser o email do calendário principal ou o ID de um calendário específico. Depois de configurar, reinicie `npm run dev`.

O Google Calendar API cria eventos pelo endpoint oficial `events.insert`.
Quando um agendamento é cancelado no painel, o sistema tenta remover o evento correspondente do Google Agenda.

## Rodar localmente

Instale dependências:

```bash
npm install
```

Rode o projeto:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Suba o projeto para um repositório.
2. Importe na Vercel.
3. Configure as mesmas variáveis de ambiente.
4. Faça deploy.

## Custo

Para cerca de 100 clientes, Supabase + Vercel é adequado para começar barato.

Pelos limites oficiais consultados em 14/05/2026:

- Supabase Free: 50.000 usuários ativos mensais, 500 MB de banco e 5 GB de egress.
- Vercel Hobby: gratuito para começar, com deploy, CDN e CI/CD.

Se o uso for comercial ou crescer, pode ser necessário migrar para Vercel Pro ou Supabase Pro.

## Próximos reforços

- Trocar `ADMIN_ACCESS_TOKEN` por Supabase Auth com usuário administrador.
- Trocar o token simples por login completo com Supabase Auth, se quiser autenticação com email/senha.
- Permitir múltiplos barbeiros com agenda própria.
- Criar remarcação pelo cliente.
- Integrar WhatsApp para confirmação, lembrete e reagendamento.
