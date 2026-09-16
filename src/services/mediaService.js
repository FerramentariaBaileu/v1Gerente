import { supabase } from '../lib/supabase.js'

// As imagens retornadas por esta função expiram em cinco minutos.
// Nunca monte URL /storage/v1/object/public no frontend.
export async function consultarImagemProduto({ message = '', term = '', history = [] } = {}) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Faça login para visualizar imagens.')

  const { data, error } = await supabase.functions.invoke('gerente-virtual-media-v2', {
    body: { message, term, history },
  })
  if (error) throw new Error(data?.error || 'Não foi possível carregar a imagem.')
  return data ?? { media: [], found: false }
}
