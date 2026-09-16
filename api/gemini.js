import { createClient } from '@supabase/supabase-js'
import { FUNCTION_DECLARATIONS, SYSTEM_INSTRUCTION } from '../src/config/gemini.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return res.status(401).json({ error: 'Sessão ausente.' })
  if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return res.status(503).json({ error: 'Configure a conexão Supabase e GEMINI_API_KEY no arquivo .env.local.' })
  const { contents } = req.body ?? {}
  if (!Array.isArray(contents) || !contents.length || contents.length > 80 || contents.some(row => !row || !['user', 'model'].includes(row.role) || !Array.isArray(row.parts))) return res.status(400).json({ error: 'Histórico inválido ou muito longo. Inicie uma nova conversa.' })
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' })
    const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name, role, active').eq('id', user.id).single()
    if (profileError || !profile?.active || !['admin', 'gerente'].includes(profile.role)) return res.status(403).json({ error: 'Perfil sem permissão.' })
    const declarations = FUNCTION_DECLARATIONS.filter(fn => profile.role === 'admin' || fn.name.startsWith('consultar_'))
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: `${SYSTEM_INSTRUCTION}\nUsuário validado pelo servidor: ${JSON.stringify({ name: profile.full_name, role: profile.role })}` }] }, contents, tools: [{ functionDeclarations: declarations }], generationConfig: { temperature: 0.2, maxOutputTokens: 1400 } })
    })
    const data = await gemini.json().catch(() => ({}))
    if (!gemini.ok) return res.status(gemini.status === 429 ? 429 : 502).json({ error: gemini.status === 429 ? 'Limite do Gemini atingido. Aguarde e tente novamente.' : 'Não foi possível consultar o Gemini. Verifique a configuração do servidor.' })
    return res.status(200).json(data)
  } catch (error) {
    return res.status(error.name === 'TimeoutError' ? 504 : 502).json({ error: 'Falha de conexão com o assistente. Tente novamente.' })
  }
}
