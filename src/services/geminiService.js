import { FUNCTION_DECLARATIONS, SYSTEM_INSTRUCTION } from '../config/gemini.js'

export async function generateGeminiContent(contents, accessToken) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }, contents, tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }] })
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível falar com o assistente.')
  return payload
}

export function getModelParts(response) {
  return response?.candidates?.[0]?.content?.parts ?? []
}

export function extractText(parts) {
  return parts.map((part) => part.text ?? '').filter(Boolean).join('\n').trim()
}
