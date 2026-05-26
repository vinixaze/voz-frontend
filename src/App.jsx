import { useEffect, useRef, useState } from 'react'

const C = {
  bgEscuro: '#0f2318',
  bgCard: '#1a3328',
  bgInput: '#152a1e',
  bgCardHover: '#1f3d30',
  borda: '#2d5240',
  bordaHover: '#3d6e55',
  textoPrincipal: '#e8f5ec',
  textoSuave: '#8ab89a',
  textoMudo: '#5a7a67',
  verdeAcao: '#4ade80',
  verdeHover: '#22c55e',
  verdeEscuro: '#166534',
  amarelo: '#fbbf24',
  vermelho: '#f87171',
  rodape: '#0a1a10',
}

const API = 'http://localhost:3001'
const LIMITE_MENSAGENS = 20
const REACTION_EMOJIS = ['🤍', '💪', '🫂', '😢', '🕊']
const MURAL_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
]
const RESPOSTA_SUGESTOES = [
  'Estou aqui com você 🤝',
  'Obrigado por compartilhar',
  'Isso é muito difícil',
  'Você foi corajoso em falar',
  'Não precisa passar por isso sozinho',
  'Sentindo contigo 💙',
  'Você não está só',
  'Um dia de cada vez 🌱',
]
const STORAGE_KEYS = {
  draft: 'voz-frontend:desabafo-draft',
  reactions: 'voz-frontend:mensagens-reagidas',
  boosts: 'voz-frontend:mensagens-amplificadas',
}

function readStorageJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function readStorageText(key) {
  if (typeof window === 'undefined') return ''

  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStorageJSON(key, value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignora falhas de armazenamento sem interromper o fluxo do app.
  }
}

function writeStorageText(key, value) {
  if (typeof window === 'undefined') return

  try {
    if (value) {
      window.localStorage.setItem(key, value)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Ignora falhas de armazenamento sem interromper o fluxo do app.
  }
}

function removeStorageItem(key) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignora falhas de armazenamento sem interromper o fluxo do app.
  }
}

function toSafeCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function normalizeReacoes(reacoes) {
  const base = Object.fromEntries(REACTION_EMOJIS.map((emoji) => [emoji, 0]))

  if (!reacoes || typeof reacoes !== 'object') return base

  REACTION_EMOJIS.forEach((emoji) => {
    base[emoji] = toSafeCount(reacoes[emoji])
  })

  return base
}

function normalizeResposta(resposta) {
  const texto =
    typeof resposta?.texto === 'string'
      ? resposta.texto
      : typeof resposta?.conteudo === 'string'
        ? resposta.conteudo
        : ''

  return {
    id: resposta?.id ? String(resposta.id) : `${texto}-${resposta?.timestamp || 'resposta'}`,
    texto,
    timestamp: resposta?.timestamp || null,
    tempoRelativo: resposta?.tempoRelativo || 'há pouco',
  }
}

function normalizeMensagem(mensagem) {
  return {
    ...mensagem,
    id: mensagem?.id ? String(mensagem.id) : '',
    texto: typeof mensagem?.texto === 'string' ? mensagem.texto : '',
    tempoRelativo: mensagem?.tempoRelativo || 'há pouco',
    timestamp: mensagem?.timestamp || null,
    boostedUntil: mensagem?.boostedUntil || null,
    reacoes: normalizeReacoes(mensagem?.reacoes),
  }
}

function pickRandomSuggestions() {
  const pool = [...RESPOSTA_SUGESTOES]

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, 3)
}

function isValidDate(dateLike) {
  const date = new Date(dateLike)
  return !Number.isNaN(date.getTime())
}

function isBoosted(boostedUntil) {
  if (!isValidDate(boostedUntil)) return false
  return new Date(boostedUntil).getTime() > Date.now()
}

async function readJsonSafe(response) {
  const text = await response.text()

  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function getFriendlyErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function mergeMensagens(existing, incoming) {
  const map = new Map(existing.map((item) => [item.id, item]))

  incoming.forEach((item) => {
    map.set(item.id, { ...map.get(item.id), ...item })
  })

  return Array.from(map.values())
}

export default function App() {
  const [tela, setTela] = useState('inicio')
  const [texto, setTexto] = useState('')
  const [mensagens, setMensagens] = useState([])
  const [stats, setStats] = useState({ total: 0, hoje: 0, esta_semana: 0 })
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [backendOk, setBackendOk] = useState(true)
  const [filtroMural, setFiltroMural] = useState('todos')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalMural, setTotalMural] = useState(0)
  const [temMais, setTemMais] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [avisoRascunho, setAvisoRascunho] = useState('')
  const [reacoesUsuario, setReacoesUsuario] = useState(() =>
    readStorageJSON(STORAGE_KEYS.reactions, {})
  )
  const [cardsAmplificados, setCardsAmplificados] = useState(() =>
    readStorageJSON(STORAGE_KEYS.boosts, {})
  )
  const [reacoesEmEnvio, setReacoesEmEnvio] = useState({})
  const [feedbackReacoes, setFeedbackReacoes] = useState({})
  const [animacaoReacao, setAnimacaoReacao] = useState('')
  const [respostaAberta, setRespostaAberta] = useState({})
  const [textoResposta, setTextoResposta] = useState({})
  const [sugestoesPorMensagem, setSugestoesPorMensagem] = useState({})
  const [respostasPorMensagem, setRespostasPorMensagem] = useState({})
  const [respostasCarregando, setRespostasCarregando] = useState({})
  const [respostasEnviando, setRespostasEnviando] = useState({})
  const [feedbackRespostas, setFeedbackRespostas] = useState({})
  const [respostasVisiveis, setRespostasVisiveis] = useState({})
  const [republicando, setRepublicando] = useState({})
  const [feedbackRepublicacao, setFeedbackRepublicacao] = useState({})

  const textareaRef = useRef(null)
  const draftRef = useRef('')
  const respostaRefs = useRef({})

  draftRef.current = texto

  const restantesDesabafo = 500 - texto.length
  const corRestantesDesabafo =
    restantesDesabafo < 30 ? C.vermelho : restantesDesabafo < 100 ? C.amarelo : C.textoMudo
  const filtroAtivoLabel =
    MURAL_FILTERS.find((item) => item.id === filtroMural)?.label.toLowerCase() || 'todos'

  useEffect(() => {
    document.body.style.cssText = `
      margin: 0;
      padding: 0;
      background: ${C.bgEscuro};
      color: ${C.textoPrincipal};
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    `

    const style = document.createElement('style')
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.12); }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes popIn {
        0%   { opacity: 0; transform: scale(0.5); }
        70%  { transform: scale(1.1); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes shimmer {
        0%   { opacity: 0.4; }
        50%  { opacity: 0.8; }
        100% { opacity: 0.4; }
      }
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: ${C.bgEscuro}; }
      ::-webkit-scrollbar-thumb { background: ${C.borda}; border-radius: 3px; }
      textarea:focus { outline: none; border-color: ${C.verdeAcao} !important; }
      textarea::placeholder { color: ${C.textoMudo}; }
      button { font: inherit; }
      @media (max-width: 640px) {
        .mural-stats {
          grid-template-columns: 1fr;
        }
        .mural-floating-button {
          right: 1rem;
          bottom: 1rem;
          left: 1rem;
        }
        .mural-floating-button button {
          width: 100%;
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    writeStorageJSON(STORAGE_KEYS.reactions, reacoesUsuario)
  }, [reacoesUsuario])

  useEffect(() => {
    writeStorageJSON(STORAGE_KEYS.boosts, cardsAmplificados)
  }, [cardsAmplificados])

  useEffect(() => {
    if (tela !== 'desabafo') return

    const draft = readStorageText(STORAGE_KEYS.draft)

    if (draft && !texto) {
      setTexto(draft)
      setAvisoRascunho('Rascunho restaurado')
    }
  }, [tela])

  useEffect(() => {
    if (tela !== 'desabafo') return

    const interval = window.setInterval(() => {
      writeStorageText(STORAGE_KEYS.draft, draftRef.current.trim() ? draftRef.current : '')
    }, 2000)

    return () => {
      window.clearInterval(interval)
      writeStorageText(STORAGE_KEYS.draft, draftRef.current.trim() ? draftRef.current : '')
    }
  }, [tela])

  useEffect(() => {
    if (!avisoRascunho) return

    const timer = window.setTimeout(() => {
      setAvisoRascunho('')
    }, 2800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [avisoRascunho])

  useEffect(() => {
    if (tela !== 'desabafo' || !textareaRef.current) return

    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
  }, [tela, texto])

  const updateMensagem = (mensagemId, updater) => {
    setMensagens((prev) => prev.map((msg) => (msg.id === mensagemId ? updater(msg) : msg)))
  }

  const fetchMensagens = async ({ page = 1, filtro = filtroMural, append = false } = {}) => {
    if (append) {
      setCarregandoMais(true)
    } else {
      setCarregando(true)
    }

    setErro(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMITE_MENSAGENS),
      })

      if (filtro !== 'todos') {
        params.set('filtro', filtro)
      }

      const [resMsgs, resStats] = await Promise.all([
        fetch(`${API}/api/mensagens?${params.toString()}`),
        fetch(`${API}/api/stats`),
      ])

      const [dataMsgs, dataStats] = await Promise.all([readJsonSafe(resMsgs), readJsonSafe(resStats)])

      if (!resMsgs.ok || !resStats.ok) {
        throw new Error(
          dataMsgs.erro ||
            dataStats.erro ||
            'Não foi possível carregar o mural agora. Tente novamente em instantes.'
        )
      }

      const novasMensagens = Array.isArray(dataMsgs.mensagens)
        ? dataMsgs.mensagens.map(normalizeMensagem)
        : []

      setMensagens((prev) => (append ? mergeMensagens(prev, novasMensagens) : novasMensagens))
      setStats({
        total: Number(dataStats.total) || 0,
        hoje: Number(dataStats.hoje) || 0,
        esta_semana: Number(dataStats.esta_semana) || 0,
      })
      setPaginaAtual(page)
      setTotalMural(Number(dataMsgs.total) || novasMensagens.length)
      setTemMais(Boolean(dataMsgs.hasMore))
      setBackendOk(true)
    } catch (e) {
      setErro(
        getFriendlyErrorMessage(
          e,
          'Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 3001.'
        )
      )
      setBackendOk(false)

      if (!append) {
        setMensagens([])
        setTotalMural(0)
      }
    } finally {
      setCarregando(false)
      setCarregandoMais(false)
    }
  }

  const enviarMensagem = async () => {
    if (texto.trim().length < 5) return

    setEnviando(true)
    setErro(null)

    try {
      const res = await fetch(`${API}/api/mensagem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim() }),
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        throw new Error(data.erro || 'Não foi possível enviar sua mensagem agora.')
      }

      removeStorageItem(STORAGE_KEYS.draft)
      draftRef.current = ''
      setAvisoRascunho('')
      setTela('enviado')
      setTexto('')
    } catch (e) {
      setErro(getFriendlyErrorMessage(e, 'Erro ao enviar. Tente novamente.'))
    } finally {
      setEnviando(false)
    }
  }

  const irParaMural = () => {
    setErro(null)
    setTela('mural')
    fetchMensagens({ page: 1, filtro: filtroMural, append: false })
  }

  const carregarMaisMensagens = () => {
    if (!temMais || carregandoMais) return
    fetchMensagens({ page: paginaAtual + 1, filtro: filtroMural, append: true })
  }

  const trocarFiltro = (novoFiltro) => {
    if (novoFiltro === filtroMural && mensagens.length > 0) return

    setFiltroMural(novoFiltro)
    setErro(null)
    setMensagens([])
    setPaginaAtual(1)
    setTotalMural(0)
    fetchMensagens({ page: 1, filtro: novoFiltro, append: false })
  }

  const fetchRespostas = async (mensagemId, options = {}) => {
    setRespostasCarregando((prev) => ({ ...prev, [mensagemId]: true }))

    if (!options.preserveFeedback) {
      setFeedbackRespostas((prev) => ({ ...prev, [mensagemId]: null }))
    }

    try {
      const res = await fetch(`${API}/api/mensagens/${mensagemId}/respostas`)
      const data = await readJsonSafe(res)

      if (!res.ok) {
        throw new Error(data.erro || 'Não foi possível carregar as respostas agora.')
      }

      const respostas = Array.isArray(data.respostas)
        ? data.respostas.map(normalizeResposta)
        : Array.isArray(data.respostasAprovadas)
          ? data.respostasAprovadas.map(normalizeResposta)
          : []

      setRespostasPorMensagem((prev) => ({ ...prev, [mensagemId]: respostas }))
      setRespostasVisiveis((prev) => ({ ...prev, [mensagemId]: prev[mensagemId] || 3 }))
    } catch (e) {
      setFeedbackRespostas((prev) => ({
        ...prev,
        [mensagemId]: {
          type: 'erro',
          text: getFriendlyErrorMessage(e, 'Não foi possível carregar as respostas agora.'),
        },
      }))
    } finally {
      setRespostasCarregando((prev) => ({ ...prev, [mensagemId]: false }))
    }
  }

  const alternarResposta = (mensagemId) => {
    const vaiAbrir = !respostaAberta[mensagemId]

    setRespostaAberta((prev) => ({ ...prev, [mensagemId]: vaiAbrir }))

    if (!vaiAbrir) return

    setSugestoesPorMensagem((prev) =>
      prev[mensagemId] ? prev : { ...prev, [mensagemId]: pickRandomSuggestions() }
    )

    if (!respostasPorMensagem[mensagemId]) {
      fetchRespostas(mensagemId, { preserveFeedback: true })
    }

    window.setTimeout(() => {
      const field = respostaRefs.current[mensagemId]

      if (!field) return

      if (window.innerWidth <= 768) {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }

      field.focus()
    }, 180)
  }

  const enviarResposta = async (mensagemId) => {
    const conteudo = (textoResposta[mensagemId] || '').trim()

    if (!conteudo) return

    setRespostasEnviando((prev) => ({ ...prev, [mensagemId]: true }))
    setFeedbackRespostas((prev) => ({ ...prev, [mensagemId]: null }))

    try {
      const res = await fetch(`${API}/api/mensagens/${mensagemId}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: conteudo }),
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        throw new Error(data.erro || 'Não foi possível enviar sua resposta agora.')
      }

      setTextoResposta((prev) => ({ ...prev, [mensagemId]: '' }))
      setFeedbackRespostas((prev) => ({
        ...prev,
        [mensagemId]: {
          type: 'sucesso',
          text: 'Sua resposta será exibida em breve',
        },
      }))

      fetchRespostas(mensagemId)
    } catch (e) {
      setFeedbackRespostas((prev) => ({
        ...prev,
        [mensagemId]: {
          type: 'erro',
          text: getFriendlyErrorMessage(e, 'Não foi possível enviar sua resposta agora.'),
        },
      }))
    } finally {
      setRespostasEnviando((prev) => ({ ...prev, [mensagemId]: false }))
    }
  }

  const reagirMensagem = async (mensagemId, emoji) => {
    if (reacoesUsuario[mensagemId] || reacoesEmEnvio[mensagemId]) return

    setAnimacaoReacao(`${mensagemId}:${emoji}`)
    window.setTimeout(() => {
      setAnimacaoReacao('')
    }, 350)

    updateMensagem(mensagemId, (msg) => ({
      ...msg,
      reacoes: {
        ...normalizeReacoes(msg.reacoes),
        [emoji]: normalizeReacoes(msg.reacoes)[emoji] + 1,
      },
    }))

    setReacoesUsuario((prev) => ({ ...prev, [mensagemId]: emoji }))
    setReacoesEmEnvio((prev) => ({ ...prev, [mensagemId]: true }))
    setFeedbackReacoes((prev) => ({ ...prev, [mensagemId]: null }))

    try {
      const res = await fetch(`${API}/api/mensagens/${mensagemId}/reacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        throw new Error(data.erro || 'Não foi possível registrar sua reação agora.')
      }

      updateMensagem(mensagemId, (msg) => ({
        ...msg,
        reacoes: normalizeReacoes(data.reacoes || msg.reacoes),
      }))

      setFeedbackReacoes((prev) => ({
        ...prev,
        [mensagemId]: { type: 'sucesso', text: 'Reação registrada com carinho.' },
      }))
    } catch (e) {
      updateMensagem(mensagemId, (msg) => ({
        ...msg,
        reacoes: {
          ...normalizeReacoes(msg.reacoes),
          [emoji]: Math.max(0, normalizeReacoes(msg.reacoes)[emoji] - 1),
        },
      }))

      setReacoesUsuario((prev) => {
        const next = { ...prev }
        delete next[mensagemId]
        return next
      })

      setFeedbackReacoes((prev) => ({
        ...prev,
        [mensagemId]: {
          type: 'erro',
          text: getFriendlyErrorMessage(e, 'Não foi possível registrar sua reação agora.'),
        },
      }))
    } finally {
      setReacoesEmEnvio((prev) => ({ ...prev, [mensagemId]: false }))
    }
  }

  const amplificarMensagem = async (mensagemId) => {
    if (cardsAmplificados[mensagemId] || republicando[mensagemId]) return

    setRepublicando((prev) => ({ ...prev, [mensagemId]: true }))
    setFeedbackRepublicacao((prev) => ({ ...prev, [mensagemId]: null }))

    try {
      const res = await fetch(`${API}/api/mensagens/${mensagemId}/republicar`, {
        method: 'POST',
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        throw new Error(data.erro || 'Não foi possível amplificar esta mensagem agora.')
      }

      const boostedUntil =
        data.boostedUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      updateMensagem(mensagemId, (msg) => ({
        ...msg,
        boostedUntil,
      }))

      setCardsAmplificados((prev) => ({ ...prev, [mensagemId]: true }))
      setFeedbackRepublicacao((prev) => ({
        ...prev,
        [mensagemId]: { type: 'sucesso', text: 'Mensagem amplificada com cuidado.' },
      }))
    } catch (e) {
      setFeedbackRepublicacao((prev) => ({
        ...prev,
        [mensagemId]: {
          type: 'erro',
          text: getFriendlyErrorMessage(e, 'Não foi possível amplificar esta mensagem agora.'),
        },
      }))
    } finally {
      setRepublicando((prev) => ({ ...prev, [mensagemId]: false }))
    }
  }

  let conteudo

  switch (tela) {
    case 'inicio':
      conteudo = (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            gap: '1.5rem',
          }}
        >
          <div style={{ fontSize: '4rem', animation: 'pulse 2s ease-in-out infinite' }}>
            💚
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 700,
              color: C.textoPrincipal,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Voz que Acolhe
          </h1>

          <p
            style={{
              fontSize: '1.1rem',
              color: C.textoSuave,
              maxWidth: '420px',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Um espaço seguro e anônimo para falar o que você não consegue dizer para ninguém.
          </p>

          <div style={{ width: '40px', height: '2px', background: C.borda, borderRadius: '2px' }} />

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icone: '🔒', texto: 'Anônimo' },
              { icone: '🤍', texto: 'Sem julgamento' },
              { icone: '🌱', texto: 'Gratuito' },
            ].map((item) => (
              <div
                key={item.texto}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: C.textoSuave,
                }}
              >
                <span>{item.icone}</span>
                <span>{item.texto}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setErro(null)
              setTela('desabafo')
            }}
            style={{
              background: C.verdeAcao,
              color: C.bgEscuro,
              border: 'none',
              padding: '14px 40px',
              borderRadius: '999px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '0.5rem',
              transition: 'all 0.2s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => (e.target.style.background = C.verdeHover)}
            onMouseLeave={(e) => (e.target.style.background = C.verdeAcao)}
          >
            Quero desabafar
          </button>

          <button
            onClick={irParaMural}
            style={{
              background: 'none',
              border: 'none',
              color: C.textoSuave,
              fontSize: '13px',
              cursor: 'pointer',
              padding: '4px 8px',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            Ver o mural de coragens →
          </button>

          <p style={{ fontSize: '12px', color: C.textoMudo, marginTop: '1rem' }}>
            Se estiver em crise, ligue <strong style={{ color: C.textoSuave }}>188</strong> — CVV,
            gratuito 24h
          </p>

          {!backendOk && (
            <p style={{ fontSize: '12px', color: C.vermelho, margin: 0, maxWidth: '420px' }}>
              O mural está indisponível no momento. Confira se o backend está ativo na porta 3001.
            </p>
          )}
        </div>
      )
      break

    case 'desabafo':
      conteudo = (
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '2rem 1.5rem', minHeight: '100vh' }}>
          <button
            onClick={() => {
              setErro(null)
              setTela('inicio')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: C.textoSuave,
              fontSize: '14px',
              cursor: 'pointer',
              padding: '0',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Voltar
          </button>

          <div style={{ animation: 'fadeUp 0.4s ease-out', marginBottom: '2rem' }}>
            <h2
              style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                margin: '0 0 8px',
                color: C.textoPrincipal,
              }}
            >
              O que você está sentindo?
            </h2>
            <p style={{ fontSize: '14px', color: C.textoSuave, margin: 0, lineHeight: 1.6 }}>
              Escreva livremente. Ninguém saberá que foi você. Sem nome, sem conta, sem rastro.
            </p>

            {avisoRascunho && (
              <p style={{ fontSize: '12px', color: C.textoSuave, margin: '10px 0 0' }}>
                {avisoRascunho}
              </p>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              if (e.target.value.length <= 500) setTexto(e.target.value)
              setErro(null)
            }}
            placeholder="Escreva aqui. Pode ser qualquer coisa. Não tem resposta certa. Não tem jeito errado de sentir."
            rows={6}
            style={{
              width: '100%',
              minHeight: '180px',
              background: C.bgInput,
              border: `1px solid ${C.borda}`,
              borderRadius: '12px',
              padding: '16px',
              color: C.textoPrincipal,
              fontSize: '15px',
              lineHeight: '1.7',
              resize: 'none',
              overflow: 'hidden',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: C.textoMudo }}>
              {texto.trim().length < 5 && texto.length > 0
                ? `Escreva pelo menos ${5 - texto.trim().length} caractere(s) a mais`
                : ''}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: corRestantesDesabafo,
                whiteSpace: 'nowrap',
              }}
            >
              {restantesDesabafo} restantes
            </div>
          </div>

          {erro && (
            <div
              style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '12px',
                fontSize: '13px',
                color: C.vermelho,
                lineHeight: 1.5,
              }}
            >
              {erro}
            </div>
          )}

          <button
            onClick={enviarMensagem}
            disabled={texto.trim().length < 5 || enviando}
            style={{
              width: '100%',
              marginTop: '16px',
              background: texto.trim().length >= 5 ? C.verdeAcao : C.borda,
              color: texto.trim().length >= 5 ? C.bgEscuro : C.textoMudo,
              border: 'none',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: texto.trim().length >= 5 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: enviando ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (texto.trim().length >= 5) e.target.style.background = C.verdeHover
            }}
            onMouseLeave={(e) => {
              if (texto.trim().length >= 5) e.target.style.background = C.verdeAcao
            }}
          >
            {enviando ? 'Enviando...' : 'Enviar meu desabafo'}
          </button>

          <p
            style={{
              fontSize: '12px',
              color: C.textoMudo,
              textAlign: 'center',
              marginTop: '16px',
              lineHeight: 1.6,
            }}
          >
            🔒 Sua mensagem é anônima. Nenhum dado pessoal é coletado.
          </p>

          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: C.rodape,
              padding: '10px',
              textAlign: 'center',
              fontSize: '12px',
              color: C.textoMudo,
              borderTop: `1px solid ${C.borda}`,
            }}
          >
            Se estiver em crise, ligue <strong style={{ color: C.textoSuave }}>188</strong> — CVV,
            gratuito 24h
          </div>
        </div>
      )
      break

    case 'enviado':
      conteudo = (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            gap: '1.5rem',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: C.verdeAcao,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              animation: 'popIn 0.5s ease-out forwards',
            }}
          >
            ✓
          </div>

          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: C.textoPrincipal,
              margin: 0,
              animation: 'fadeUp 0.5s ease-out 0.2s both',
            }}
          >
            Recebemos sua voz.
          </h2>

          <p
            style={{
              fontSize: '1.1rem',
              color: C.textoSuave,
              maxWidth: '380px',
              lineHeight: 1.7,
              margin: 0,
              animation: 'fadeUp 0.5s ease-out 0.3s both',
            }}
          >
            Obrigado pela coragem de falar. O que você sente importa. Você não está sozinho(a).
          </p>

          <div
            style={{
              background: C.bgCard,
              border: `1px solid ${C.borda}`,
              borderRadius: '12px',
              padding: '1.25rem',
              maxWidth: '380px',
              animation: 'fadeUp 0.5s ease-out 0.4s both',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: C.textoSuave,
                margin: 0,
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              "Pedir ajuda é um ato de coragem, não de fraqueza."
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
              maxWidth: '320px',
              animation: 'fadeUp 0.5s ease-out 0.5s both',
            }}
          >
            <button
              onClick={irParaMural}
              style={{
                background: C.verdeAcao,
                color: C.bgEscuro,
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ver o mural de coragens
            </button>
            <button
              onClick={() => {
                setTexto('')
                setErro(null)
                setTela('desabafo')
              }}
              style={{
                background: 'none',
                color: C.textoSuave,
                border: `1px solid ${C.borda}`,
                padding: '14px',
                borderRadius: '12px',
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Desabafar de novo
            </button>
          </div>
        </div>
      )
      break

    case 'mural':
      conteudo = (
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem', paddingBottom: '7rem' }}>
          <button
            onClick={() => {
              setErro(null)
              setTela('inicio')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: C.textoSuave,
              fontSize: '14px',
              cursor: 'pointer',
              padding: '0',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Voltar
          </button>

          <div style={{ marginBottom: '1.5rem' }}>
            <h2
              style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                margin: '0 0 8px',
                color: C.textoPrincipal,
              }}
            >
              Mural de Coragens
            </h2>
            <p style={{ fontSize: '14px', color: C.textoSuave, margin: 0 }}>
              {carregando
                ? 'Carregando vozes...'
                : filtroMural === 'todos'
                  ? `${totalMural} pessoa${totalMural !== 1 ? 's' : ''} já falaram aqui · ${stats.hoje} hoje`
                  : `${totalMural} voz${totalMural !== 1 ? 'es' : ''} em ${filtroAtivoLabel}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {MURAL_FILTERS.map((item) => {
              const ativo = filtroMural === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => trocarFiltro(item.id)}
                  style={{
                    background: ativo ? C.verdeAcao : C.bgCard,
                    color: ativo ? C.bgEscuro : C.textoSuave,
                    border: `1px solid ${ativo ? C.verdeAcao : C.borda}`,
                    padding: '10px 14px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          {!carregando && (
            <div
              className="mural-stats"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '10px',
                marginBottom: '2rem',
              }}
            >
              {[
                { label: 'Total de vozes', valor: stats.total },
                { label: 'Hoje', valor: stats.hoje },
                { label: 'Esta semana', valor: stats.esta_semana },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: C.bgCard,
                    border: `1px solid ${C.borda}`,
                    borderRadius: '10px',
                    padding: '14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: C.verdeAcao }}>
                    {item.valor}
                  </div>
                  <div style={{ fontSize: '11px', color: C.textoMudo, marginTop: '4px' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {erro && (
            <div
              style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '1rem',
                fontSize: '13px',
                color: C.vermelho,
                lineHeight: 1.6,
              }}
            >
              {erro}
            </div>
          )}

          {carregando && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '12px',
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  style={{
                    background: C.bgCard,
                    border: `1px solid ${C.borda}`,
                    borderRadius: '12px',
                    padding: '16px',
                    height: '160px',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          )}

          {!carregando && mensagens.length === 0 && !erro && (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: C.textoMudo,
                fontSize: '15px',
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
              <p>
                {filtroMural === 'todos'
                  ? 'Este mural ainda está em silêncio.'
                  : `Ainda não há vozes em ${filtroAtivoLabel}.`}
              </p>
              <p>Seja o primeiro a deixar sua voz aqui.</p>
            </div>
          )}

          {!carregando && mensagens.length > 0 && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px',
                }}
              >
                {mensagens.map((msg, index) => {
                  const respostaAtual = textoResposta[msg.id] || ''
                  const restantesResposta = 120 - respostaAtual.length
                  const corRestantesResposta =
                    restantesResposta < 20 ? C.vermelho : restantesResposta < 40 ? C.amarelo : C.textoMudo
                  const respostasDoCard = respostasPorMensagem[msg.id] || []
                  const respostasExibidas = respostasDoCard.slice(0, respostasVisiveis[msg.id] || 3)
                  const jaReagiu = Boolean(reacoesUsuario[msg.id])
                  const jaAmplificou = Boolean(cardsAmplificados[msg.id])
                  const emDestaque = isBoosted(msg.boostedUntil)
                  const feedbackResposta = feedbackRespostas[msg.id]
                  const feedbackReacao = feedbackReacoes[msg.id]
                  const feedbackBoost = feedbackRepublicacao[msg.id]

                  return (
                    <div
                      key={msg.id}
                      style={{
                        background: C.bgCard,
                        border: `1px solid ${emDestaque ? C.bordaHover : C.borda}`,
                        borderRadius: '12px',
                        padding: '16px',
                        animation: `fadeUp 0.4s ease-out ${index * 60}ms both`,
                        transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                        boxShadow: emDestaque ? '0 0 0 1px rgba(74,222,128,0.08)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.bordaHover
                        e.currentTarget.style.background = C.bgCardHover
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = emDestaque ? C.bordaHover : C.borda
                        e.currentTarget.style.background = C.bgCard
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '12px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: C.textoMudo }}>{msg.tempoRelativo}</span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {emDestaque && (
                            <span
                              style={{
                                fontSize: '10px',
                                color: C.textoSuave,
                                padding: '4px 8px',
                                borderRadius: '999px',
                                background: 'rgba(74,222,128,0.08)',
                                border: `1px solid ${C.borda}`,
                              }}
                            >
                              em destaque
                            </span>
                          )}

                          <button
                            onClick={() => amplificarMensagem(msg.id)}
                            disabled={jaAmplificou || republicando[msg.id]}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: jaAmplificou ? C.textoMudo : C.textoSuave,
                              fontSize: '12px',
                              cursor: jaAmplificou ? 'not-allowed' : 'pointer',
                              padding: 0,
                              opacity: republicando[msg.id] ? 0.7 : 1,
                            }}
                          >
                            {republicando[msg.id]
                              ? 'Amplificando...'
                              : jaAmplificou
                                ? 'Amplificado'
                                : '↑ Amplificar'}
                          </button>
                        </div>
                      </div>

                      <p
                        style={{
                          fontSize: '14px',
                          color: C.textoPrincipal,
                          lineHeight: 1.7,
                          margin: '0 0 14px',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.texto}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        {REACTION_EMOJIS.map((emoji) => {
                          const ativa = reacoesUsuario[msg.id] === emoji
                          const desabilitada = reacoesEmEnvio[msg.id] || (jaReagiu && !ativa)

                          return (
                            <button
                              key={emoji}
                              onClick={() => reagirMensagem(msg.id, emoji)}
                              disabled={desabilitada || ativa}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: ativa ? 'rgba(74,222,128,0.12)' : C.bgInput,
                                color: ativa ? C.textoPrincipal : C.textoSuave,
                                border: `1px solid ${ativa ? C.bordaHover : C.borda}`,
                                borderRadius: '999px',
                                padding: '6px 10px',
                                cursor: ativa || desabilitada ? 'default' : 'pointer',
                                fontSize: '12px',
                                animation:
                                  animacaoReacao === `${msg.id}:${emoji}` ? 'pulse 0.35s ease-out' : 'none',
                                opacity: reacoesEmEnvio[msg.id] ? 0.7 : 1,
                              }}
                            >
                              <span>{emoji}</span>
                              <span>{msg.reacoes?.[emoji] || 0}</span>
                            </button>
                          )
                        })}
                      </div>

                      {feedbackReacao && (
                        <p
                          style={{
                            fontSize: '11px',
                            color: feedbackReacao.type === 'erro' ? C.vermelho : C.textoSuave,
                            margin: '0 0 10px',
                            lineHeight: 1.5,
                          }}
                        >
                          {feedbackReacao.text}
                        </p>
                      )}

                      {feedbackBoost && (
                        <p
                          style={{
                            fontSize: '11px',
                            color: feedbackBoost.type === 'erro' ? C.vermelho : C.textoSuave,
                            margin: '0 0 10px',
                            lineHeight: 1.5,
                          }}
                        >
                          {feedbackBoost.text}
                        </p>
                      )}

                      <div
                        style={{
                          borderTop: `1px solid ${C.borda}`,
                          paddingTop: '12px',
                          marginTop: '12px',
                        }}
                      >
                        {(respostasCarregando[msg.id] ||
                          respostasDoCard.length > 0 ||
                          respostaAberta[msg.id]) && (
                          <>
                            {respostasCarregando[msg.id] && (
                              <p style={{ fontSize: '12px', color: C.textoMudo, margin: '0 0 10px' }}>
                                Carregando respostas aprovadas...
                              </p>
                            )}

                            {!respostasCarregando[msg.id] && respostasDoCard.length > 0 && (
                              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                                {respostasExibidas.map((resposta) => (
                                  <div
                                    key={resposta.id}
                                    style={{
                                      background: C.bgInput,
                                      border: `1px solid ${C.borda}`,
                                      borderRadius: '10px',
                                      padding: '10px 12px',
                                    }}
                                  >
                                    <p
                                      style={{
                                        margin: 0,
                                        fontSize: '13px',
                                        color: C.textoSuave,
                                        lineHeight: 1.6,
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      {resposta.texto}
                                    </p>
                                    <span
                                      style={{
                                        display: 'block',
                                        marginTop: '6px',
                                        fontSize: '11px',
                                        color: C.textoMudo,
                                      }}
                                    >
                                      {resposta.tempoRelativo}
                                    </span>
                                  </div>
                                ))}

                                {respostasDoCard.length > respostasExibidas.length && (
                                  <button
                                    onClick={() =>
                                      setRespostasVisiveis((prev) => ({
                                        ...prev,
                                        [msg.id]: (prev[msg.id] || 3) + 3,
                                      }))
                                    }
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: C.textoSuave,
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      padding: 0,
                                      textAlign: 'left',
                                    }}
                                  >
                                    ver mais
                                  </button>
                                )}
                              </div>
                            )}

                            {!respostasCarregando[msg.id] &&
                              respostaAberta[msg.id] &&
                              respostasDoCard.length === 0 &&
                              !feedbackResposta?.text && (
                                <p style={{ fontSize: '12px', color: C.textoMudo, margin: '0 0 10px' }}>
                                  Nenhuma resposta aprovada ainda.
                                </p>
                              )}
                          </>
                        )}

                        <button
                          onClick={() => alternarResposta(msg.id)}
                          style={{
                            background: 'none',
                            border: `1px solid ${C.borda}`,
                            color: C.textoSuave,
                            borderRadius: '999px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginBottom: respostaAberta[msg.id] ? '12px' : 0,
                          }}
                        >
                          {respostaAberta[msg.id] ? 'Fechar resposta' : 'Responder'}
                        </button>

                        {respostaAberta[msg.id] && (
                          <div style={{ display: 'grid', gap: '10px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {(sugestoesPorMensagem[msg.id] || []).map((sugestao) => (
                                <button
                                  key={sugestao}
                                  onClick={() =>
                                    setTextoResposta((prev) => ({ ...prev, [msg.id]: sugestao.slice(0, 120) }))
                                  }
                                  style={{
                                    background: C.bgInput,
                                    border: `1px solid ${C.borda}`,
                                    color: C.textoSuave,
                                    borderRadius: '999px',
                                    padding: '8px 10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                >
                                  {sugestao}
                                </button>
                              ))}
                            </div>

                            <textarea
                              ref={(node) => {
                                respostaRefs.current[msg.id] = node
                              }}
                              value={respostaAtual}
                              onChange={(e) =>
                                setTextoResposta((prev) => ({
                                  ...prev,
                                  [msg.id]: e.target.value.slice(0, 120),
                                }))
                              }
                              rows={3}
                              placeholder="Escreva uma resposta curta e acolhedora."
                              style={{
                                width: '100%',
                                background: C.bgInput,
                                border: `1px solid ${C.borda}`,
                                borderRadius: '12px',
                                padding: '12px',
                                color: C.textoPrincipal,
                                fontSize: '14px',
                                lineHeight: 1.6,
                                resize: 'none',
                                fontFamily: 'inherit',
                              }}
                            />

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px',
                              }}
                            >
                              <span style={{ fontSize: '12px', color: C.textoMudo }}>
                                Resposta curta, gentil e anônima.
                              </span>
                              <span style={{ fontSize: '12px', color: corRestantesResposta }}>
                                {restantesResposta} restantes
                              </span>
                            </div>

                            {feedbackResposta && (
                              <p
                                style={{
                                  fontSize: '12px',
                                  color: feedbackResposta.type === 'erro' ? C.vermelho : C.textoSuave,
                                  margin: 0,
                                  lineHeight: 1.5,
                                }}
                              >
                                {feedbackResposta.text}
                              </p>
                            )}

                            <button
                              onClick={() => enviarResposta(msg.id)}
                              disabled={!respostaAtual.trim() || respostasEnviando[msg.id]}
                              style={{
                                background: respostaAtual.trim() ? C.verdeAcao : C.borda,
                                color: respostaAtual.trim() ? C.bgEscuro : C.textoMudo,
                                border: 'none',
                                borderRadius: '12px',
                                padding: '12px 14px',
                                fontSize: '14px',
                                fontWeight: 700,
                                cursor: respostaAtual.trim() ? 'pointer' : 'not-allowed',
                                opacity: respostasEnviando[msg.id] ? 0.7 : 1,
                              }}
                            >
                              {respostasEnviando[msg.id] ? 'Enviando...' : 'Enviar resposta'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {carregandoMais &&
                  [1, 2, 3].map((i) => (
                    <div
                      key={`loading-more-${i}`}
                      style={{
                        background: C.bgCard,
                        border: `1px solid ${C.borda}`,
                        borderRadius: '12px',
                        padding: '16px',
                        height: '160px',
                        animation: 'shimmer 1.5s ease-in-out infinite',
                      }}
                    />
                  ))}
              </div>

              {temMais && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button
                    onClick={carregarMaisMensagens}
                    disabled={carregandoMais}
                    style={{
                      background: C.bgCard,
                      color: C.textoSuave,
                      border: `1px solid ${C.borda}`,
                      borderRadius: '999px',
                      padding: '12px 18px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: carregandoMais ? 'wait' : 'pointer',
                    }}
                  >
                    {carregandoMais ? 'Carregando...' : 'Carregar mais'}
                  </button>
                </div>
              )}
            </>
          )}

          <div className="mural-floating-button" style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}>
            <button
              onClick={() => {
                setErro(null)
                setTela('desabafo')
              }}
              style={{
                background: C.verdeAcao,
                color: C.bgEscuro,
                border: 'none',
                padding: '14px 22px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(74,222,128,0.25)',
              }}
            >
              💬 Quero desabafar
            </button>
          </div>
        </div>
      )
      break

    default:
      conteudo = null
  }

  return conteudo
}
