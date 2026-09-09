import { createClient } from '@supabase/supabase-js'

const allowedFunctions = new Set(['consultar_estoque', 'consultar_produto', 'consultar_processo', 'consultar_pessoa', 'atualizar_estoque', 'cadastrar_produto', 'atualizar_produto'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Variáveis do servidor não configuradas.' })
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sessão ausente.' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' })

  const { systemInstruction, contents, tools } = req.body ?? {}
  if (!Array.isArray(contents) || contents.length > 80) return res.status(400).json({ error: 'Histórico inválido ou muito longo.' })
  const declarations = tools?.[0]?.functionDeclarations ?? []
  if (declarations.some((fn) => !allowedFunctions.has(fn.name))) return res.status(400).json({ error: 'Função não permitida.' })

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction, contents, tools, generationConfig: { temperature: 0.2, maxOutputTokens: 1400 } })
  })
  const data = await gemini.json().catch(() => ({}))
  if (!gemini.ok) return res.status(gemini.status).json({ error: data?.error?.message || 'Falha na API do Gemini.' })
  return res.status(200).json(data)
}
