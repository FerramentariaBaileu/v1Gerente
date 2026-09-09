import { useEffect, useRef, useState } from 'react'
import { Bot, Send, User } from 'lucide-react'
import AppShell from '../components/AppShell.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { executeFunction, isWriteFunction } from '../services/inventoryService.js'
import { extractText, generateGeminiContent, getModelParts } from '../services/geminiService.js'

const affirmative = /^(sim|confirmo|confirmado|pode fazer|pode executar|isso mesmo|correto|ok|pode)$/i

function hasValidConfirmation(messages, functionName) {
  if (!isWriteFunction(functionName)) return true
  const last = messages.at(-1)?.text?.trim() ?? ''
  const previous = [...messages].reverse().find((message) => message.role === 'assistant')?.text ?? ''
  return affirmative.test(last) && /confirma|confirmar|posso (executar|fazer)/i.test(previous)
}

export default function ChatPage() {
  const { session, profile } = useAuth()
  const [messages, setMessages] = useState([{ id: crypto.randomUUID(), role: 'assistant', text: `Olá, ${profile.name}. Como posso ajudar hoje?` }])
  const [contents, setContents] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, busy])

  async function submit(event) {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const userMessage = { id: crypto.randomUUID(), role: 'user', text }
    const nextMessages = [...messages, userMessage]
    const contextualText = `[CONTEXTO DO USUÁRIO AUTENTICADO]\nNome: ${profile.name}\nRole: ${profile.role}\nID: ${profile.id}\n[FIM DO CONTEXTO]\n\nMensagem: ${text}`
    let conversation = [...contents, { role: 'user', parts: [{ text: contextualText }] }]
    setMessages(nextMessages); setInput(''); setBusy(true)

    try {
      for (let round = 0; round < 6; round += 1) {
        const response = await generateGeminiContent(conversation, session.access_token)
        const parts = getModelParts(response)
        if (!parts.length) throw new Error('O assistente não retornou uma resposta.')
        conversation = [...conversation, { role: 'model', parts }]
        const calls = parts.filter((part) => part.functionCall)
        const textReply = extractText(parts)

        if (!calls.length) {
          const finalText = textReply || 'Não consegui formular a resposta. Tente novamente.'
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: finalText }])
          setContents(conversation)
          return
        }

        const responseParts = []
        for (const { functionCall } of calls) {
          let result
          if (isWriteFunction(functionCall.name) && !hasValidConfirmation(nextMessages, functionCall.name)) {
            result = { erro: 'CONFIRMACAO_NECESSARIA', mensagem: 'A operação não foi executada. Apresente todos os dados e peça confirmação explícita ao usuário antes de chamar esta função.' }
          } else {
            result = await executeFunction(functionCall.name, functionCall.args ?? {}, profile)
          }
          responseParts.push({ functionResponse: { name: functionCall.name, response: { result } } })
        }
        conversation = [...conversation, { role: 'user', parts: responseParts }]
      }
      throw new Error('O limite de operações automáticas foi atingido.')
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', error: true, text: `Houve uma instabilidade: ${error.message} Tente novamente em instantes.` }])
    } finally { setBusy(false) }
  }

  return <AppShell><section className="chat-page">
    <header className="page-header"><div><h1>Olá, {profile.name.split(' ')[0]}</h1><p>Consulte informações e acompanhe a operação da Bailéu.</p></div><span className={`role-badge ${profile.role}`}>{profile.role}</span></header>
    <div className="chat-card"><div className="messages" aria-live="polite">
      {messages.map((message) => <div key={message.id} className={`message-row ${message.role}`}><div className="message-avatar">{message.role === 'assistant' ? <Bot size={19} /> : <User size={19} />}</div><div className={`bubble ${message.error ? 'error' : ''}`}>{message.text}</div></div>)}
      {busy && <div className="message-row assistant"><div className="message-avatar"><Bot size={19} /></div><div className="bubble typing"><i /><i /><i /><span>Digitando...</span></div></div>}
      <div ref={endRef} />
    </div>
    <form className="composer" onSubmit={submit}><textarea rows="1" value={input} disabled={busy} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit() } }} placeholder="Pergunte sobre estoque, produtos ou processos..." /><button aria-label="Enviar" disabled={busy || !input.trim()}><Send size={20} /></button></form>
    </div>
  </section></AppShell>
}
