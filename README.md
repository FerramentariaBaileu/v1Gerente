# Gerente Virtual — Bailéu

Web app React/Vite com login Supabase, chat Gemini com function calling e formulários administrativos.

## Publicação

1. Envie todos os arquivos ao GitHub mantendo esta estrutura.
2. Na Vercel, importe o repositório (framework: Vite; build: `npm run build`; saída: `dist`).
3. Cadastre as variáveis de `.env.example` em **Project Settings → Environment Variables**. `GEMINI_API_KEY` não pode ter prefixo `VITE_`. Use a chave `sb_publishable_...` em `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY`.
4. No Supabase Auth, crie os usuários manualmente. Para cada usuário, crie uma linha em `profiles` com o mesmo UUID de `auth.users`, um `full_name` e `role` igual a `admin` ou `gerente`. Novas contas devem permanecer `active = false` até aprovação.
5. Confira e, se compatível com seu banco, execute `supabase/rls-policies.sql` no SQL Editor. Se já existem políticas, não duplique nomes: adapte/consolide.
6. O app oferece MFA por aplicativo autenticador em **Segurança**. A ativação é voluntária nesta versão para não bloquear os usuários atuais. Depois que um fator for cadastrado, novos logins exigem o código temporário antes de liberar o app.

## Schema esperado

O código usa os nomes de tabela informados e espera:

- `profiles`: `id`, `full_name`, `role`, `active`.
- `inventory_items`: `id`, `internal_code`, `fantasy_name`, `technical_name`, `description`, `category`, `item_type`.
- `finished_products`: `item_id`, `price`.
- `semi_finished_items`: `item_id`, `process_name`.
- `inventory_movements`: `id`, `item_id`, `movement_type`, `quantity_delta`, `created_by`, `notes`, `created_at`.

O saldo é calculado pela soma de `inventory_movements.quantity_delta`. Se o seu banco usa uma tabela própria de saldos ou nomes de colunas diferentes, ajuste somente `src/services/inventoryService.js` e as políticas SQL.

Para imagens, use `src/services/mediaService.js`. Ele chama `gerente-virtual-media-v2` e recebe uma URL assinada temporária; não use URLs públicas do bucket.

## Desenvolvimento local (opcional)

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Segurança

A chave Gemini fica somente na função Vercel `/api/gemini`. O frontend e a API usam somente `VITE_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_PUBLISHABLE_KEY`; a autorização real é feita por RLS e pelo perfil ativo. Nunca use a chave `service_role` neste projeto.

O fluxo MFA inclui cadastro por QR Code, desafio no login, gestão do fator e bloqueio do frontend enquanto uma sessão com fator cadastrado estiver em `aal1`. Não torne MFA obrigatório para todos antes de cadastrar e validar ao menos dois fatores no usuário administrador.
