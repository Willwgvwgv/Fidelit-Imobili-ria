# Segurança — ComissOne

Documento de referência para a equipe. Última atualização:
31/jul/2026.

## Resumo

O ComissOne é um app de gestão de comissões imobiliárias
publicado em https://comissone.vercel.app, com backend no
Supabase (projeto ref: dzcixpzyoxhfvskrftqe). Este documento
resume o modelo de segurança atual.

## Camadas de segurança ativas

### 1. Banco de dados (Supabase / Postgres)

Todas as 8 tabelas do app têm Row Level Security (RLS)
habilitada:

- users
- sales
- broker_splits
- broker_entries
- financial_accounts
- financial_categories
- financial_transactions
- financial_reconciliations

O papel anon (chave pública) não tem grant de SELECT, INSERT,
UPDATE, DELETE nem em tabelas, sequences ou functions — está
revogado desde a migração de 30/jul/2026.

Default privileges configuradas para que tabelas futuras
já nasçam sem acesso do anon.

#### Policies em vigor

- Camada 1: papéis não-anon só acessam se autenticados
  (auth.role() = 'authenticated').
- Camada 2: usuários só veem/editam dados da própria
  agency_id. A função public.current_agency_id() resolve
  o agency_id do JWT via match por e-mail (o app não usa
  auth.uid() para casar com users.id).
- broker_splits não tem agency_id próprio, então herda o
  escopo via subquery em sales (sale_id).
- broker_entries tem agency_id próprio e usa policy direta.
- Tabela users: SELECT vê toda a agência; UPDATE só o próprio
  registro, com trava anti-escalação de role.
- DELETE em users: bloqueado (usar coluna de soft-delete).

#### Função helper de RLS

public.current_agency_id() retorna text. Como a coluna
agency_id é mista (uuid em users/sales/financial_reconciliations;
text em financial_accounts/categories/transactions), as
policies em colunas uuid fazem cast ::text na comparação.

### 2. Sincronização de novos usuários

Trigger on_auth_user_created em auth.users dispara
public.handle_new_user() em cada signup. Cria a linha em
public.users com id = auth.users.id, lendo nome/role/agency_id
de raw_user_meta_data. Fallbacks:
- name: split_part(email, '@', 1)
- role: 'USER'
- agency_id: '11111111-1111-1111-1111-111111111111'

### 3. Headers HTTP (Vercel)

vercel.json na raiz aplica em todas as rotas:

- Content-Security-Policy: default-src 'self'; scripts
  limitados; connect-src para o Supabase do projeto; etc.
- X-Frame-Options: DENY (anti-clickjacking)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: geolocation, camera, microphone,
  payment e usb desativados
- Strict-Transport-Security: max-age=63072000 (Vercel default)

### 4. Sanitização contra XSS

A função de impressão do extrato financeiro (no
src/modules/finance/components/Financial.tsx) usa a helper
escapeHtml() para envolver variáveis de input do usuário
antes de interpolar no template HTML:

  function escapeHtml(input) {
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

Variáveis protegidas: tx.description, categoryName, groupName
(centro de custo), accountName.

## Pendências conhecidas

### Curto prazo

- [ ] Desativar mailer_autoconfirm no Supabase Auth
      (Auth → Providers → Email) e configurar SMTP real.
- [ ] Migrar recibos (broker_splits.receipt_data, hoje em
      base64 dentro do Postgres) para Supabase Storage com
      bucket privado e URLs assinadas.
- [ ] Mover financial_category_groups do localStorage para
      uma tabela no Supabase.
- [ ] Implementar rate-limit real no servidor (Upstash
      Ratelimit + middleware na Vercel). O atual só roda
      no cliente.
- [ ] Sentry para monitoramento de erros + audit log via
      trigger em sales e financial_transactions.

### Médio prazo

- [ ] Integração com emissor de NFS-e (ex: MegaNota) para
      emissão automática de nota fiscal de serviço quando
      uma venda é confirmada.
- [ ] Plano Pro do Supabase (PITR 7 dias, backups diários)
      para recuperação em caso de incidente.

## Contato em caso de incidente

- williangyn10@gmail.com (admin)
- Auditoria inicial: 30/jul/2026
