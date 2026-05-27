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
  turquesa: '#2dd4bf',
  azulBruma: '#7dd3fc',
  lima: '#bef264',
  rosa: '#fb7185',
  brilhoVerde: 'rgba(74,222,128,0.18)',
  brilhoAzul: 'rgba(125,211,252,0.16)',
  vidro: 'rgba(18, 37, 27, 0.76)',
  vidroForte: 'rgba(13, 28, 20, 0.9)',
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

function PageAura({ variant = 'inicio' }) {
  const palettes = {
    inicio: [
      {
        top: '-8%',
        left: '-10%',
        width: 320,
        height: 320,
        background: 'radial-gradient(circle, rgba(74,222,128,0.22) 0%, rgba(74,222,128,0) 72%)',
      },
      {
        top: '10%',
        right: '-8%',
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(125,211,252,0.18) 0%, rgba(125,211,252,0) 70%)',
      },
      {
        bottom: '-10%',
        left: '18%',
        width: 260,
        height: 260,
        background: 'radial-gradient(circle, rgba(251,191,36,0.14) 0%, rgba(251,191,36,0) 72%)',
      },
    ],
    desabafo: [
      {
        top: '-10%',
        right: '-6%',
        width: 340,
        height: 340,
        background: 'radial-gradient(circle, rgba(74,222,128,0.18) 0%, rgba(74,222,128,0) 70%)',
      },
      {
        top: '28%',
        left: '-10%',
        width: 260,
        height: 260,
        background: 'radial-gradient(circle, rgba(251,113,113,0.1) 0%, rgba(251,113,113,0) 68%)',
      },
      {
        bottom: '-14%',
        right: '20%',
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(45,212,191,0.12) 0%, rgba(45,212,191,0) 70%)',
      },
    ],
    enviado: [
      {
        top: '4%',
        left: '8%',
        width: 280,
        height: 280,
        background: 'radial-gradient(circle, rgba(190,242,100,0.16) 0%, rgba(190,242,100,0) 68%)',
      },
      {
        bottom: '-8%',
        right: '-6%',
        width: 360,
        height: 360,
        background: 'radial-gradient(circle, rgba(74,222,128,0.18) 0%, rgba(74,222,128,0) 72%)',
      },
      {
        top: '18%',
        right: '16%',
        width: 220,
        height: 220,
        background: 'radial-gradient(circle, rgba(125,211,252,0.14) 0%, rgba(125,211,252,0) 72%)',
      },
    ],
    mural: [
      {
        top: '-6%',
        left: '-8%',
        width: 340,
        height: 340,
        background: 'radial-gradient(circle, rgba(45,212,191,0.18) 0%, rgba(45,212,191,0) 72%)',
      },
      {
        top: '6%',
        right: '-8%',
        width: 320,
        height: 320,
        background: 'radial-gradient(circle, rgba(74,222,128,0.16) 0%, rgba(74,222,128,0) 72%)',
      },
      {
        bottom: '-12%',
        right: '14%',
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(251,191,36,0.12) 0%, rgba(251,191,36,0) 72%)',
      },
    ],
  }

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div className="grid-lines" />
      {(palettes[variant] || palettes.inicio).map((orb, index) => (
        <div
          key={`${variant}-${index}`}
          className="ambient-orb"
          style={{
            ...orb,
            animationDelay: `${index * 1.8}s`,
            animationDuration: `${14 + index * 3}s`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: '0',
          background:
            'linear-gradient(180deg, rgba(8,20,13,0.18) 0%, rgba(8,20,13,0.02) 20%, rgba(8,20,13,0.34) 100%)',
        }}
      />
    </div>
  )
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
  const shellStyle = { position: 'relative', minHeight: '100vh', overflow: 'hidden' }
  const layerStyle = { position: 'relative', zIndex: 1 }
  const glassPanel = {
    background: `linear-gradient(180deg, rgba(31,61,48,0.78) 0%, ${C.vidroForte} 100%)`,
    border: `1px solid rgba(138,184,154,0.16)`,
    boxShadow: '0 28px 80px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(16px)',
  }
  const softPanel = {
    background: `linear-gradient(180deg, rgba(27,53,41,0.92) 0%, rgba(15,35,24,0.96) 100%)`,
    border: `1px solid ${C.borda}`,
    boxShadow: '0 18px 50px rgba(0,0,0,0.18)',
  }
  const primaryButtonBase = {
    background: `linear-gradient(135deg, ${C.verdeAcao} 0%, ${C.turquesa} 100%)`,
    color: C.bgEscuro,
    border: 'none',
    boxShadow: '0 16px 40px rgba(74,222,128,0.22)',
  }
  const secondaryButtonBase = {
    background: 'rgba(255,255,255,0.02)',
    color: C.textoPrincipal,
    border: `1px solid rgba(138,184,154,0.16)`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  }
  const chipStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid rgba(138,184,154,0.16)`,
    color: C.textoSuave,
    fontSize: '12px',
    fontWeight: 600,
  }

  useEffect(() => {
    document.body.style.cssText = `
      margin: 0;
      padding: 0;
      background:
        radial-gradient(circle at top left, rgba(74,222,128,0.14) 0%, rgba(74,222,128,0) 28%),
        radial-gradient(circle at top right, rgba(125,211,252,0.12) 0%, rgba(125,211,252,0) 24%),
        radial-gradient(circle at bottom center, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0) 18%),
        linear-gradient(180deg, #08140d 0%, ${C.bgEscuro} 42%, #09150f 100%);
      color: ${C.textoPrincipal};
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      background-attachment: fixed;
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
      @keyframes floatDrift {
        0%   { transform: translate3d(0, 0, 0) scale(1); }
        50%  { transform: translate3d(16px, -18px, 0) scale(1.06); }
        100% { transform: translate3d(-10px, 14px, 0) scale(0.98); }
      }
      @keyframes softSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      * { box-sizing: border-box; }
      #root { min-height: 100vh; position: relative; isolation: isolate; }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: ${C.bgEscuro}; }
      ::-webkit-scrollbar-thumb { background: ${C.borda}; border-radius: 3px; }
      ::selection { background: rgba(74,222,128,0.22); color: ${C.textoPrincipal}; }
      textarea:focus { outline: none; border-color: ${C.verdeAcao} !important; }
      textarea::placeholder { color: ${C.textoMudo}; }
      button { font: inherit; }
      .ambient-orb {
        position: absolute;
        border-radius: 999px;
        filter: blur(22px);
        animation: floatDrift 18s ease-in-out infinite alternate;
      }
      .grid-lines {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(138,184,154,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(138,184,154,0.04) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: radial-gradient(circle at center, black, transparent 78%);
      }
      .hero-outline {
        position: absolute;
        inset: auto;
        border: 1px solid rgba(138,184,154,0.12);
        border-radius: 999px;
        animation: softSpin 22s linear infinite;
      }
      .rich-card:hover {
        transform: translateY(-4px);
      }
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
        .hero-split {
          grid-template-columns: 1fr;
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
        <div style={shellStyle}>
          <PageAura variant="inicio" />

          <div
            className="hero-outline"
            style={{
              width: '28rem',
              height: '28rem',
              top: '-10rem',
              right: '-8rem',
              opacity: 0.24,
            }}
          />

          <div
            style={{
              ...layerStyle,
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
            }}
          >
            <div
              className="hero-split"
              style={{
                width: 'min(1120px, 100%)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)',
                gap: '1.5rem',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  ...glassPanel,
                  borderRadius: '30px',
                  padding: 'clamp(1.6rem, 4vw, 2.8rem)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '0 auto auto 0',
                    width: '12rem',
                    height: '12rem',
                    background: `radial-gradient(circle, ${C.brilhoVerde} 0%, rgba(74,222,128,0) 72%)`,
                  }}
                />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ ...chipStyle, width: 'fit-content', marginBottom: '1rem' }}>
                    <span>💚</span>
                    <span>acolhimento anônimo, leve e imediato</span>
                  </div>

                  <div
                    style={{
                      width: '74px',
                      height: '74px',
                      borderRadius: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.6rem',
                      marginBottom: '1.25rem',
                      background:
                        'linear-gradient(145deg, rgba(74,222,128,0.24) 0%, rgba(45,212,191,0.14) 100%)',
                      border: `1px solid rgba(74,222,128,0.2)`,
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  >
                    💚
                  </div>

                  <h1
                    style={{
                      fontSize: 'clamp(2.8rem, 7vw, 5rem)',
                      fontWeight: 800,
                      color: C.textoPrincipal,
                      margin: 0,
                      letterSpacing: '-0.05em',
                      lineHeight: 0.96,
                      textWrap: 'balance',
                    }}
                  >
                    Sua voz merece
                    <span style={{ color: C.verdeAcao }}> cuidado</span>.
                  </h1>

                  <p
                    style={{
                      fontSize: '1.08rem',
                      color: C.textoSuave,
                      maxWidth: '560px',
                      lineHeight: 1.8,
                      margin: '1.15rem 0 0',
                    }}
                  >
                    Um espaço seguro, colorido e sereno para transformar silêncio em desabafo,
                    coragem em presença e presença em apoio real.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      gap: '0.8rem',
                      flexWrap: 'wrap',
                      marginTop: '1.5rem',
                    }}
                  >
                    {[
                      { icone: '🔒', texto: 'Anônimo' },
                      { icone: '🤍', texto: 'Sem julgamento' },
                      { icone: '🌱', texto: 'Gratuito' },
                    ].map((item) => (
                      <div key={item.texto} style={chipStyle}>
                        <span>{item.icone}</span>
                        <span>{item.texto}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '0.9rem',
                      flexWrap: 'wrap',
                      marginTop: '1.75rem',
                    }}
                  >
                    <button
                      onClick={() => {
                        setErro(null)
                        setTela('desabafo')
                      }}
                      style={{
                        ...primaryButtonBase,
                        padding: '15px 28px',
                        borderRadius: '999px',
                        fontSize: '16px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        letterSpacing: '0.01em',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)'
                        e.target.style.boxShadow = '0 20px 48px rgba(74,222,128,0.3)'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)'
                        e.target.style.boxShadow = '0 16px 40px rgba(74,222,128,0.22)'
                      }}
                    >
                      Quero desabafar
                    </button>

                    <button
                      onClick={irParaMural}
                      style={{
                        ...secondaryButtonBase,
                        padding: '15px 22px',
                        borderRadius: '999px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'transform 0.2s, border-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)'
                        e.target.style.borderColor = C.bordaHover
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)'
                        e.target.style.borderColor = 'rgba(138,184,154,0.16)'
                      }}
                    >
                      Ver o mural de coragens →
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: '1.6rem',
                      paddingTop: '1.2rem',
                      borderTop: `1px solid rgba(138,184,154,0.12)`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <p style={{ fontSize: '12px', color: C.textoMudo, margin: 0 }}>
                      Se estiver em crise, ligue <strong style={{ color: C.textoSuave }}>188</strong> —
                      CVV, gratuito 24h
                    </p>

                    <p style={{ fontSize: '12px', color: C.textoMudo, margin: 0 }}>
                      Nada de cadastro. Nada de exposição. Só espaço.
                    </p>
                  </div>

                  {!backendOk && (
                    <p style={{ fontSize: '12px', color: C.vermelho, margin: '1rem 0 0', maxWidth: '420px' }}>
                      O mural está indisponível no momento. Confira se o backend está ativo na porta 3001.
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div
                  style={{
                    ...softPanel,
                    borderRadius: '26px',
                    padding: '1.35rem',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 'auto -2rem -2rem auto',
                      width: '8rem',
                      height: '8rem',
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${C.brilhoAzul} 0%, rgba(125,211,252,0) 74%)`,
                    }}
                  />
                  <p style={{ fontSize: '12px', color: C.azulBruma, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    antes de começar
                  </p>
                  <h3 style={{ fontSize: '1.25rem', color: C.textoPrincipal, margin: '0.55rem 0 0' }}>
                    Um espaço com temperatura humana
                  </h3>
                  <p style={{ fontSize: '14px', color: C.textoSuave, lineHeight: 1.7, margin: '0.75rem 0 0' }}>
                    Entre, respire e escreva no seu ritmo. O ambiente foi pensado para parecer acolhedor,
                    não clínico.
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {[
                    { valor: '100%', label: 'anônimo', cor: C.verdeAcao },
                    { valor: '24h', label: 'apoio CVV', cor: C.azulBruma },
                    { valor: '500', label: 'caracteres livres', cor: C.amarelo },
                    { valor: '∞', label: 'sem julgamento', cor: C.turquesa },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        ...softPanel,
                        borderRadius: '22px',
                        padding: '1.1rem',
                      }}
                    >
                      <div style={{ fontSize: '1.55rem', fontWeight: 800, color: item.cor }}>{item.valor}</div>
                      <div style={{ fontSize: '12px', color: C.textoMudo, marginTop: '6px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      break

    case 'desabafo':
      conteudo = (
        <div style={shellStyle}>
          <PageAura variant="desabafo" />

          <div
            style={{
              ...layerStyle,
              maxWidth: '920px',
              margin: '0 auto',
              padding: '2rem 1.25rem 6rem',
              minHeight: '100vh',
            }}
          >
            <button
              onClick={() => {
                setErro(null)
                setTela('inicio')
              }}
              style={{
                ...chipStyle,
                background: 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                marginBottom: '1.2rem',
              }}
            >
              <span>←</span>
              <span>Voltar</span>
            </button>

            <div
              className="hero-split"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)',
                gap: '1rem',
                alignItems: 'start',
              }}
            >
              <div
                style={{
                  ...glassPanel,
                  borderRadius: '30px',
                  padding: 'clamp(1.4rem, 3vw, 2rem)',
                  animation: 'fadeUp 0.4s ease-out',
                }}
              >
                <div style={{ ...chipStyle, width: 'fit-content', marginBottom: '1rem' }}>
                  <span>🫶</span>
                  <span>escreva no seu tempo</span>
                </div>

                <h2
                  style={{
                    fontSize: 'clamp(2rem, 5vw, 2.9rem)',
                    fontWeight: 800,
                    margin: '0 0 10px',
                    color: C.textoPrincipal,
                    letterSpacing: '-0.04em',
                  }}
                >
                  O que está ocupando seu peito hoje?
                </h2>
                <p style={{ fontSize: '15px', color: C.textoSuave, margin: 0, lineHeight: 1.75 }}>
                  Pode ser confuso, pequeno, urgente ou sem nome. Aqui cabe tudo o que ainda não
                  encontrou espaço lá fora.
                </p>

                {avisoRascunho && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: C.azulBruma,
                      margin: '12px 0 0',
                      padding: '8px 10px',
                      width: 'fit-content',
                      borderRadius: '999px',
                      background: 'rgba(125,211,252,0.08)',
                      border: '1px solid rgba(125,211,252,0.14)',
                    }}
                  >
                    {avisoRascunho}
                  </p>
                )}

                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '14px',
                    borderRadius: '22px',
                    background: 'linear-gradient(180deg, rgba(19,42,31,0.92) 0%, rgba(15,31,23,0.96) 100%)',
                    border: `1px solid rgba(138,184,154,0.14)`,
                  }}
                >
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
                      minHeight: '220px',
                      background:
                        'linear-gradient(180deg, rgba(21,42,30,0.92) 0%, rgba(10,24,17,0.92) 100%)',
                      border: `1px solid ${C.borda}`,
                      borderRadius: '18px',
                      padding: '18px',
                      color: C.textoPrincipal,
                      fontSize: '15px',
                      lineHeight: '1.8',
                      resize: 'none',
                      overflow: 'hidden',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '10px',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: C.textoMudo }}>
                      {texto.trim().length < 5 && texto.length > 0
                        ? `Escreva pelo menos ${5 - texto.trim().length} caractere(s) a mais`
                        : 'Seu rascunho é salvo automaticamente enquanto você escreve.'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: corRestantesDesabafo,
                        whiteSpace: 'nowrap',
                        padding: '6px 10px',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {restantesDesabafo} restantes
                    </div>
                  </div>
                </div>

                {erro && (
                  <div
                    style={{
                      background: 'rgba(248,113,113,0.1)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      marginTop: '14px',
                      fontSize: '13px',
                      color: C.vermelho,
                      lineHeight: 1.6,
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
                    ...primaryButtonBase,
                    background:
                      texto.trim().length >= 5
                        ? `linear-gradient(135deg, ${C.verdeAcao} 0%, ${C.turquesa} 100%)`
                        : C.borda,
                    color: texto.trim().length >= 5 ? C.bgEscuro : C.textoMudo,
                    padding: '15px',
                    borderRadius: '18px',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: texto.trim().length >= 5 ? 'pointer' : 'not-allowed',
                    transition: 'transform 0.2s, opacity 0.2s, box-shadow 0.2s',
                    opacity: enviando ? 0.7 : 1,
                    boxShadow:
                      texto.trim().length >= 5 ? '0 18px 40px rgba(74,222,128,0.2)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (texto.trim().length >= 5) e.target.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    if (texto.trim().length >= 5) e.target.style.transform = 'translateY(0)'
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
                    lineHeight: 1.7,
                  }}
                >
                  🔒 Sua mensagem é anônima. Nenhum dado pessoal é coletado.
                </p>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ ...softPanel, borderRadius: '24px', padding: '1.2rem' }}>
                  <p style={{ fontSize: '12px', color: C.lima, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    lembrete gentil
                  </p>
                  <p style={{ fontSize: '15px', color: C.textoPrincipal, lineHeight: 1.75, margin: '0.65rem 0 0' }}>
                    Você não precisa organizar tudo antes de escrever. Pode começar do meio, do caos,
                    da raiva ou do cansaço.
                  </p>
                </div>

                <div style={{ ...softPanel, borderRadius: '24px', padding: '1.2rem' }}>
                  <p style={{ fontSize: '12px', color: C.azulBruma, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    se travar
                  </p>
                  <div style={{ display: 'grid', gap: '10px', marginTop: '0.8rem' }}>
                    {[
                      'Hoje está doendo porque...',
                      'O que eu queria dizer era...',
                      'Se alguém me ouvisse agora, eu diria...',
                    ].map((linha) => (
                      <div
                        key={linha}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid rgba(138,184,154,0.12)`,
                          color: C.textoSuave,
                          fontSize: '13px',
                        }}
                      >
                        {linha}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(180deg, rgba(10,26,16,0.92) 0%, rgba(10,26,16,0.98) 100%)',
              padding: '12px 14px',
              textAlign: 'center',
              fontSize: '12px',
              color: C.textoMudo,
              borderTop: `1px solid rgba(138,184,154,0.12)`,
              backdropFilter: 'blur(12px)',
              zIndex: 3,
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
        <div style={shellStyle}>
          <PageAura variant="enviado" />

          <div
            style={{
              ...layerStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              padding: '2rem',
            }}
          >
            <div
              style={{
                ...glassPanel,
                borderRadius: '32px',
                padding: 'clamp(1.8rem, 4vw, 2.6rem)',
                width: 'min(720px, 100%)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 'auto auto -5rem -4rem',
                  width: '14rem',
                  height: '14rem',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${C.brilhoVerde} 0%, rgba(74,222,128,0) 74%)`,
                }}
              />

              <div
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '28px',
                  margin: '0 auto 1.25rem',
                  background: 'linear-gradient(145deg, rgba(74,222,128,0.26) 0%, rgba(45,212,191,0.18) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.2rem',
                  border: '1px solid rgba(74,222,128,0.24)',
                  boxShadow: '0 20px 50px rgba(74,222,128,0.16)',
                  animation: 'popIn 0.5s ease-out forwards',
                }}
              >
                ✓
              </div>

              <div style={{ ...chipStyle, width: 'fit-content', margin: '0 auto 1rem' }}>
                <span>✨</span>
                <span>sua coragem já fez movimento</span>
              </div>

              <h2
                style={{
                  fontSize: 'clamp(2.1rem, 5vw, 3.1rem)',
                  fontWeight: 800,
                  color: C.textoPrincipal,
                  margin: 0,
                  letterSpacing: '-0.04em',
                  animation: 'fadeUp 0.5s ease-out 0.2s both',
                }}
              >
                Recebemos sua voz.
              </h2>

              <p
                style={{
                  fontSize: '1.08rem',
                  color: C.textoSuave,
                  maxWidth: '500px',
                  lineHeight: 1.8,
                  margin: '1rem auto 0',
                  animation: 'fadeUp 0.5s ease-out 0.3s both',
                }}
              >
                Obrigado pela coragem de falar. O que você sente importa, merece espaço e não
                precisa mais ficar totalmente sozinho.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginTop: '1.5rem',
                  animation: 'fadeUp 0.5s ease-out 0.36s both',
                }}
              >
                {[
                  { titulo: 'Respire', texto: 'Seu desabafo já saiu de dentro e agora está acolhido.' },
                  { titulo: 'Volte quando quiser', texto: 'Este espaço continua aqui para você.' },
                  { titulo: 'Conexão', texto: 'O mural mostra que outras vozes também existem.' },
                ].map((item) => (
                  <div
                    key={item.titulo}
                    style={{
                      ...softPanel,
                      borderRadius: '20px',
                      padding: '1rem',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: C.verdeAcao, fontWeight: 700 }}>{item.titulo}</div>
                    <p style={{ fontSize: '13px', color: C.textoSuave, lineHeight: 1.7, margin: '8px 0 0' }}>
                      {item.texto}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  ...softPanel,
                  borderRadius: '22px',
                  padding: '1.15rem',
                  maxWidth: '440px',
                  margin: '1.3rem auto 0',
                  animation: 'fadeUp 0.5s ease-out 0.4s both',
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    color: C.textoSuave,
                    margin: 0,
                    lineHeight: 1.8,
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
                  maxWidth: '340px',
                  margin: '1.5rem auto 0',
                  animation: 'fadeUp 0.5s ease-out 0.5s both',
                }}
              >
                <button
                  onClick={irParaMural}
                  style={{
                    ...primaryButtonBase,
                    padding: '15px',
                    borderRadius: '18px',
                    fontSize: '15px',
                    fontWeight: 800,
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
                    ...secondaryButtonBase,
                    padding: '15px',
                    borderRadius: '18px',
                    fontSize: '15px',
                    cursor: 'pointer',
                  }}
                >
                  Desabafar de novo
                </button>
              </div>
            </div>
          </div>
        </div>
      )
      break

    case 'mural':
      conteudo = (
        <div style={shellStyle}>
          <PageAura variant="mural" />

          <div
            style={{
              ...layerStyle,
              maxWidth: '980px',
              margin: '0 auto',
              padding: '2rem 1.25rem',
              paddingBottom: '7rem',
            }}
          >
            <div
              style={{
                ...glassPanel,
                borderRadius: '30px',
                padding: '1.35rem',
                marginBottom: '1.25rem',
              }}
            >
              <button
                onClick={() => {
                  setErro(null)
                  setTela('inicio')
                }}
                style={{
                  ...chipStyle,
                  background: 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  marginBottom: '1rem',
                }}
              >
                <span>←</span>
                <span>Voltar</span>
              </button>

              <div
                className="hero-split"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)',
                  gap: '1rem',
                  alignItems: 'end',
                }}
              >
                <div>
                  <div style={{ ...chipStyle, width: 'fit-content', marginBottom: '0.9rem' }}>
                    <span>🌿</span>
                    <span>vozes reais, acolhimento coletivo</span>
                  </div>

                  <h2
                    style={{
                      fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                      fontWeight: 800,
                      margin: '0 0 8px',
                      color: C.textoPrincipal,
                      letterSpacing: '-0.05em',
                    }}
                  >
                    Mural de Coragens
                  </h2>
                  <p style={{ fontSize: '15px', color: C.textoSuave, margin: 0, lineHeight: 1.75, maxWidth: '640px' }}>
                    Um mosaico de sentimentos compartilhados. Mais textura, mais presença e mais
                    calor visual para cada voz que passa por aqui.
                  </p>
                </div>

                <div
                  style={{
                    ...softPanel,
                    borderRadius: '24px',
                    padding: '1rem 1.1rem',
                  }}
                >
                  <div style={{ fontSize: '12px', color: C.azulBruma, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    panorama
                  </div>
                  <p style={{ fontSize: '14px', color: C.textoPrincipal, lineHeight: 1.7, margin: '10px 0 0' }}>
                    {carregando
                      ? 'Carregando vozes...'
                      : filtroMural === 'todos'
                        ? `${totalMural} pessoa${totalMural !== 1 ? 's' : ''} já falaram aqui · ${stats.hoje} hoje`
                        : `${totalMural} voz${totalMural !== 1 ? 'es' : ''} em ${filtroAtivoLabel}`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1.1rem' }}>
                {MURAL_FILTERS.map((item) => {
                  const ativo = filtroMural === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => trocarFiltro(item.id)}
                      style={{
                        background: ativo
                          ? `linear-gradient(135deg, ${C.verdeAcao} 0%, ${C.turquesa} 100%)`
                          : 'rgba(255,255,255,0.04)',
                        color: ativo ? C.bgEscuro : C.textoSuave,
                        border: `1px solid ${ativo ? 'rgba(74,222,128,0.12)' : 'rgba(138,184,154,0.14)'}`,
                        padding: '10px 14px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: ativo ? '0 14px 32px rgba(74,222,128,0.16)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)'
                      }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

          {!carregando && (
            <div
              className="mural-stats"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '12px',
                marginBottom: '1.4rem',
              }}
            >
              {[
                { label: 'Total de vozes', valor: stats.total, icone: '💬', cor: C.verdeAcao },
                { label: 'Hoje', valor: stats.hoje, icone: '☀️', cor: C.amarelo },
                { label: 'Esta semana', valor: stats.esta_semana, icone: '🌱', cor: C.turquesa },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...softPanel,
                    borderRadius: '22px',
                    padding: '15px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: C.textoMudo, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: item.cor, marginTop: '6px' }}>
                        {item.valor}
                      </div>
                    </div>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid rgba(138,184,154,0.12)`,
                        fontSize: '1.15rem',
                      }}
                    >
                      {item.icone}
                    </div>
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
                borderRadius: '16px',
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
                gap: '14px',
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  style={{
                    ...softPanel,
                    borderRadius: '20px',
                    padding: '16px',
                    height: '220px',
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
                ...glassPanel,
                borderRadius: '28px',
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
                  gap: '14px',
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
                      className="rich-card"
                      key={msg.id}
                      style={{
                        ...glassPanel,
                        background: emDestaque
                          ? 'linear-gradient(180deg, rgba(31,61,48,0.92) 0%, rgba(14,31,22,0.96) 100%)'
                          : 'linear-gradient(180deg, rgba(24,48,37,0.9) 0%, rgba(13,28,20,0.94) 100%)',
                        border: `1px solid ${emDestaque ? 'rgba(74,222,128,0.22)' : 'rgba(138,184,154,0.12)'}`,
                        borderRadius: '24px',
                        padding: '18px',
                        animation: `fadeUp 0.4s ease-out ${index * 60}ms both`,
                        transition: 'transform 0.2s, border-color 0.2s, background 0.2s, box-shadow 0.2s',
                        boxShadow: emDestaque
                          ? '0 0 0 1px rgba(74,222,128,0.08), 0 24px 60px rgba(0,0,0,0.18)'
                          : '0 20px 50px rgba(0,0,0,0.16)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.bordaHover
                        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(31,61,48,0.94) 0%, rgba(16,36,26,0.98) 100%)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = emDestaque ? 'rgba(74,222,128,0.22)' : 'rgba(138,184,154,0.12)'
                        e.currentTarget.style.background = emDestaque
                          ? 'linear-gradient(180deg, rgba(31,61,48,0.92) 0%, rgba(14,31,22,0.96) 100%)'
                          : 'linear-gradient(180deg, rgba(24,48,37,0.9) 0%, rgba(13,28,20,0.94) 100%)'
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
                        <span
                          style={{
                            fontSize: '11px',
                            color: C.textoMudo,
                            padding: '6px 10px',
                            borderRadius: '999px',
                            background: 'rgba(255,255,255,0.03)',
                          }}
                        >
                          {msg.tempoRelativo}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {emDestaque && (
                            <span
                              style={{
                                fontSize: '10px',
                                color: C.textoSuave,
                                padding: '5px 9px',
                                borderRadius: '999px',
                                background: 'rgba(74,222,128,0.12)',
                                border: `1px solid rgba(74,222,128,0.2)`,
                              }}
                            >
                              em destaque
                            </span>
                          )}

                          <button
                            onClick={() => amplificarMensagem(msg.id)}
                            disabled={jaAmplificou || republicando[msg.id]}
                            style={{
                              background: jaAmplificou ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${jaAmplificou ? 'rgba(138,184,154,0.08)' : 'rgba(138,184,154,0.12)'}`,
                              color: jaAmplificou ? C.textoMudo : C.textoSuave,
                              fontSize: '12px',
                              cursor: jaAmplificou ? 'not-allowed' : 'pointer',
                              padding: '7px 10px',
                              borderRadius: '999px',
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
                          lineHeight: 1.85,
                          margin: '0 0 16px',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.texto}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
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
                                background: ativa
                                  ? 'linear-gradient(135deg, rgba(74,222,128,0.16) 0%, rgba(45,212,191,0.12) 100%)'
                                  : 'rgba(255,255,255,0.04)',
                                color: ativa ? C.textoPrincipal : C.textoSuave,
                                border: `1px solid ${ativa ? 'rgba(74,222,128,0.22)' : 'rgba(138,184,154,0.12)'}`,
                                borderRadius: '999px',
                                padding: '7px 11px',
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
                          borderTop: `1px solid rgba(138,184,154,0.12)`,
                          paddingTop: '14px',
                          marginTop: '14px',
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
                                      background: 'rgba(255,255,255,0.03)',
                                      border: `1px solid rgba(138,184,154,0.12)`,
                                      borderRadius: '16px',
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
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid rgba(138,184,154,0.12)`,
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
                                    background: 'rgba(255,255,255,0.04)',
                                    border: `1px solid rgba(138,184,154,0.12)`,
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
                                background: 'linear-gradient(180deg, rgba(21,42,30,0.94) 0%, rgba(11,24,18,0.94) 100%)',
                                border: `1px solid rgba(138,184,154,0.12)`,
                                borderRadius: '16px',
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
                                background: respostaAtual.trim()
                                  ? `linear-gradient(135deg, ${C.verdeAcao} 0%, ${C.turquesa} 100%)`
                                  : C.borda,
                                color: respostaAtual.trim() ? C.bgEscuro : C.textoMudo,
                                border: 'none',
                                borderRadius: '16px',
                                padding: '12px 14px',
                                fontSize: '14px',
                                fontWeight: 800,
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
                        ...softPanel,
                        borderRadius: '20px',
                        padding: '16px',
                        height: '220px',
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
                      ...secondaryButtonBase,
                      color: C.textoSuave,
                      borderRadius: '999px',
                      padding: '13px 20px',
                      fontSize: '14px',
                      fontWeight: 800,
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
                ...primaryButtonBase,
                padding: '14px 22px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              💬 Quero desabafar
            </button>
          </div>
        </div>
      </div>
      )
      break

    default:
      conteudo = null
  }

  return conteudo
}
