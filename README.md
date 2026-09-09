# Gerente Virtual — Bailéu

Web app React/Vite com login Supabase, chat Gemini com function calling e formulários administrativos.

## Publicação

1. Envie todos os arquivos ao GitHub mantendo esta estrutura.
2. Na Vercel, importe o repositório (framework: Vite; build: `npm run build`; saída: `dist`).
3. Cadastre as cinco variáveis de `.env.example` em **Project Settings → Environment Variables**. `GEMINI_API_KEY` não pode ter prefixo `VITE_`.
4. No Supabase Auth, crie os usuários manualmente. Para cada usuário, crie uma linha em `profiles` com o mesmo UUID de `auth.users`, um `name` e `role` igual a `admin` ou `gerente`.
5. Confira e, se compatível com seu banco, execute `supabase/rls-policies.sql` no SQL Editor. Se já existem políticas, não duplique nomes: adapte/consolide.

## Schema esperado

O código usa os nomes de tabela informados e espera:

- `profiles`: `id`, `name`, `role`.
- `inventory_items`: `id`, `internal_code`, `fantasy_name`, `technical_name`, `description`, `category`, `item_type`.
- `finished_products`: `item_id`, `price`.
- `semi_finished_items`: `item_id`, `process_name`.
- `inventory_movements`: `id`, `item_id`, `movement_type`, `quantity_delta`, `created_by`, `notes`, `created_at`.

O saldo é calculado pela soma de `inventory_movements.quantity_delta`. Se o seu banco usa uma tabela própria de saldos ou nomes de colunas diferentes, ajuste somente `src/services/inventoryService.js` e as políticas SQL.

## Desenvolvimento local (opcional)

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Segurança

A chave Gemini fica somente na função Vercel `/api/gemini`. A chave anon/publishable do Supabase pode existir no frontend porque a autorização real deve ser feita por RLS. Nunca use a chave `service_role` neste projeto.
