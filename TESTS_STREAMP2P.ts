/**
 * 🧪 Testes e exemplos de uso
 * Para testar a integração StreamP2P + TMDB
 */

// ============================================
// 1️⃣  TESTE: Extrair .m3u8
// ============================================
async function testExtractM3u8() {
  const response = await fetch('/api/admin/extract-m3u8', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileId: 'afx9mk',
      streamUrl: 'https://cinestreamtent.strp2p.live/#afx9mk',
    }),
  })

  const data = await response.json()
  console.log('✅ Extração de .m3u8:', data)
  return data
}

// ============================================
// 2️⃣  TESTE: Buscar na TMDB
// ============================================
async function testSearchTMDB() {
  const query = 'O Último Guerreiro das Estrelas'
  const response = await fetch(
    `/api/admin/search-tmdb?query=${encodeURIComponent(query)}&type=movie`
  )

  const data = await response.json()
  console.log('✅ Busca TMDB:', data)
  return data
}

// ============================================
// 3️⃣  TESTE: Carregar dados completos TMDB
// ============================================
async function testFetchTMDB(tmdbId = 12345) {
  const response = await fetch(`/api/admin/fetch-tmdb?id=${tmdbId}&type=movie`)
  const data = await response.json()
  console.log('✅ Dados TMDB completos:', data)
  return data
}

// ============================================
// 4️⃣  TESTE COMPLETO: Integração
// ============================================
async function testCompleteFlow() {
  console.log('🚀 Iniciando fluxo completo...\n')

  // Passo 1: Extrair .m3u8
  console.log('📌 Passo 1: Extração de .m3u8')
  const m3u8Data = await testExtractM3u8()
  const m3u8Url = m3u8Data.m3u8Url

  // Passo 2: Buscar na TMDB
  console.log('\n📌 Passo 2: Busca na TMDB')
  const searchData = await testSearchTMDB()
  const tmdbId = searchData.results[0].id

  // Passo 3: Carregar dados completos
  console.log('\n📌 Passo 3: Carregamento de dados completos')
  const tmdbData = await testFetchTMDB(tmdbId)

  // Passo 4: Montar dados do formulário
  console.log('\n📌 Passo 4: Dados do formulário')
  const formData = {
    id: String(tmdbData.id),
    title: tmdbData.title,
    name: tmdbData.name,
    original_title: tmdbData.original_title,
    original_name: tmdbData.original_name,
    poster_path: tmdbData.poster_path,
    backdrop_path: tmdbData.backdrop_path,
    overview: tmdbData.overview,
    release_date: tmdbData.release_date,
    first_air_date: tmdbData.first_air_date,
    vote_average: String(tmdbData.vote_average),
    vote_count: String(tmdbData.vote_count),
    popularity: String(tmdbData.popularity),
    genre_ids: (tmdbData.genre_ids || []).join(', '),
    original_language: tmdbData.original_language,
    adult: tmdbData.adult,
    video: 'O Último Guerreiro das Estrelas',
    URLvideo: m3u8Url,
    URLTxt: 'https://cinestreamtent.strp2p.live/#afx9mk',
  }

  console.log('✅ Formulário montado:', formData)
  return formData
}

// ============================================
// 5️⃣  TESTE: Simular clique em Importar
// ============================================
async function testImportButton(file) {
  /**
   * Simula o que acontece quando você clica
   * em "Importar" no modal StreamP2P
   */
  
  console.log('🎬 Simulando clique em "Importar"...')
  console.log('Arquivo:', file)

  // Isso é o que a função importStreamP2PFile() faz:
  const fileId = file.id
  const fileName = file.name
  const streamP2pUrl = `https://cinestreamtent.strp2p.live/#${fileId}`

  // 1. Extrair m3u8
  console.log('1️⃣  Extraindo .m3u8...')
  const extractRes = await fetch('/api/admin/extract-m3u8', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, streamUrl: streamP2pUrl }),
  })
  const m3u8Data = await extractRes.json()
  console.log('   ✅ .m3u8 extraído:', m3u8Data.m3u8Url)

  // 2. Buscar na TMDB
  console.log('2️⃣  Buscando na TMDB...')
  const searchRes = await fetch(
    `/api/admin/search-tmdb?query=${encodeURIComponent(fileName)}&type=movie`
  )
  const searchData = await searchRes.json()
  console.log('   ✅ Resultados encontrados:', searchData.results.length)

  // 3. Carregar dados completos
  console.log('3️⃣  Carregando dados completos...')
  const tmdbRes = await fetch(
    `/api/admin/fetch-tmdb?id=${searchData.results[0].id}&type=movie`
  )
  const tmdbData = await tmdbRes.json()
  console.log('   ✅ Dados carregados:', tmdbData.title)

  // 4. Montar formulário
  console.log('4️⃣  Montando formulário...')
  const finalFormData = {
    id: String(tmdbData.id),
    title: tmdbData.title,
    video: fileName,
    URLvideo: m3u8Data.m3u8Url,
    URLTxt: streamP2pUrl,
    // ... todos os outros campos
  }
  
  console.log('✅ Tudo pronto! Formulário preenchido:')
  console.log(finalFormData)
  return finalFormData
}

// ============================================
// 🎯 COMO USAR NO CONSOLE
// ============================================

/*
  Abra o DevTools (F12) e execute:

  // Teste 1: Extrair .m3u8
  testExtractM3u8()

  // Teste 2: Buscar TMDB
  testSearchTMDB()

  // Teste 3: Dados completos TMDB
  testFetchTMDB(12345)

  // Teste 4: Fluxo completo
  testCompleteFlow()

  // Teste 5: Simular clique em Importar
  testImportButton({
    id: 'afx9mk',
    name: 'O Último Guerreiro das Estrelas',
    poster: '/ZnDKsyDNtuTwJDzy0M5IfA/...',
    size: 715462912,
    duration: 6029,
    resolution: 'HD'
  })
*/

// ============================================
// 📊 EXEMPLO DE RESPOSTA
// ============================================

const EXAMPLE_EXTRACT_M3U8_RESPONSE = {
  m3u8Url: 'https://sy6.marketprediction.cfd/v4/hls/afx9mk/index-f1-v1-a1.m3u8',
  success: true,
  message: 'URL processada com sucesso',
}

const EXAMPLE_SEARCH_TMDB_RESPONSE = {
  results: [
    {
      id: 12345,
      title: 'O Último Guerreiro das Estrelas',
      original_title: 'The Last Star Warrior',
      release_date: '2024-01-15',
      poster_path: '/ZnDKsyDNtuTwJDzy0M5IfA.jpg',
      overview: 'Um épico de ficção científica...',
      vote_average: 7.5,
    },
  ],
}

const EXAMPLE_FETCH_TMDB_RESPONSE = {
  id: 12345,
  title: 'O Último Guerreiro das Estrelas',
  original_title: 'The Last Star Warrior',
  release_date: '2024-01-15',
  poster_path: '/ZnDKsyDNtuTwJDzy0M5IfA.jpg',
  backdrop_path: '/xlvhPxLpF50XYbVH5PX0.jpg',
  overview: 'Um épico de ficção científica sobre um guerreiro...',
  vote_average: 7.5,
  vote_count: 1250,
  popularity: 45.2,
  genre_ids: [28, 878, 12],
  original_language: 'pt',
  adult: false,
}

const EXAMPLE_FORM_DATA_FILLED = {
  id: '12345',
  title: 'O Último Guerreiro das Estrelas',
  name: 'O Último Guerreiro das Estrelas',
  original_title: 'The Last Star Warrior',
  original_name: '',
  video: 'O Último Guerreiro das Estrelas',
  URLvideo: 'https://sy6.marketprediction.cfd/v4/hls/afx9mk/index-f1-v1-a1.m3u8',
  URLTxt: 'https://cinestreamtent.strp2p.live/#afx9mk',
  poster_path: '/ZnDKsyDNtuTwJDzy0M5IfA.jpg',
  backdrop_path: '/xlvhPxLpF50XYbVH5PX0.jpg',
  overview: 'Um épico de ficção científica...',
  release_date: '2024-01-15',
  first_air_date: '',
  vote_average: '7.5',
  vote_count: '1250',
  popularity: '45.2',
  genre_ids: '28, 878, 12',
  original_language: 'pt',
  adult: false,
  temporadas: {},
}

export {
  testExtractM3u8,
  testSearchTMDB,
  testFetchTMDB,
  testCompleteFlow,
  testImportButton,
}
