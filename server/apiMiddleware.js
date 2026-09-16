import handler from '../api/gemini.js'

export function apiMiddleware(req, res, next) {
  if (req.url?.split('?')[0] !== '/api/gemini') return next()
  res.status = code => { res.statusCode = code; return res }
  res.json = data => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)) }
  if (req.method !== 'POST') return handler(req, res)
  let size = 0
  const chunks = []
  req.on('data', chunk => {
    size += chunk.length
    if (size > 512000) {
      if (!res.writableEnded) res.status(413).json({ error: 'Mensagem muito grande.' })
      return
    }
    chunks.push(chunk)
  })
  req.on('end', async () => {
    if (res.writableEnded) return
    try { req.body = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { return res.status(400).json({ error: 'JSON inválido.' }) }
    await handler(req, res)
  })
  req.on('error', () => { if (!res.writableEnded) res.status(400).json({ error: 'Requisição interrompida.' }) })
}
