# 🎬 Fluxo Completo: StreamP2P + TMDB Integration

## 📋 Resumo do que foi implementado

Um sistema automático que integra:
- **StreamP2P**: Extração de arquivos e URLs
- **TMDB**: Busca automática por título e carregamento de dados
- **Formulário Admin**: Preenchimento automático com todos os dados

---

## 🚀 Como funciona?

### Fluxo Completo (Passo a Passo)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MODAL STREAMP2P                               │
│  Lista de arquivos com botão "Importar"                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Nome: "O Último Guerreiro das Estrelas"                │    │
│  │ ID: afx9mk                                              │    │
│  │ Criado: 2026-02-02 16:08:51                             │    │
│  │ [Importar]                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────────┘
                         │ Clica em [Importar]
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1️⃣  EXTRAIR DADOS DO STREAMP2P                                 │
│                                                                   │
│  const fileId = "afx9mk"                                          │
│  const streamUrl = "https://cinestreamtent.strp2p.live/#afx9mk"  │
│                                                                   │
│  API: POST /api/admin/extract-m3u8                               │
│  └─ Tenta 5 URLs diferentes                                      │
│  └─ Busca por .m3u8 no arquivo .txt                              │
│  └─ Retorna: m3u8Url                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2️⃣  BUSCAR NA TMDB                                              │
│                                                                   │
│  const searchQuery = "O Último Guerreiro das Estrelas"           │
│                                                                   │
│  API: GET /api/admin/search-tmdb                                 │
│  └─ Query: "O Último Guerreiro das Estrelas"                     │
│  └─ Type: movie/tv                                               │
│  └─ Retorna: lista de resultados                                 │
│  └─ Usa o primeiro resultado                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3️⃣  CARREGAR DADOS COMPLETOS DO TMDB                            │
│                                                                   │
│  const tmdbId = 12345 (do resultado anterior)                    │
│                                                                   │
│  API: GET /api/admin/fetch-tmdb?id=12345&type=movie              │
│  └─ Retorna dados completos:                                     │
│     • title, overview, poster, backdrop                          │
│     • vote_average, vote_count, popularity                       │
│     • genre_ids, original_language, etc.                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4️⃣  PREENCHER FORMULÁRIO                                        │
│                                                                   │
│  setFormData({                                                    │
│    id: "12345",                                                  │
│    title: "O Último Guerreiro das Estrelas",                     │
│    poster_path: "/path/to/poster.jpg",                           │
│    overview: "Um épico de ficção científica...",                 │
│    vote_average: "7.5",                                          │
│    video: "O Último Guerreiro das Estrelas",                     │
│    URLvideo: "https://sy6.../index-f1-v1-a1.m3u8",              │
│    URLTxt: "https://cinestreamtent.strp2p.live/#afx9mk",         │
│    ... (todos os outros campos)                                  │
│  })                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  5️⃣  FORMULÁRIO PREENCHIDO E PRONTO PARA SALVAR                  │
│                                                                   │
│  ✅ Título carregado                                              │
│  ✅ Poster e backdrop carregados                                  │
│  ✅ URL do vídeo (m3u8) extraída                                  │
│  ✅ Todos os metadados da TMDB preenchidos                        │
│  ✅ Pronto para clicar em [Adicionar Filme]                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💾 Dados que são carregados automaticamente

### Do StreamP2P:
```json
{
  "id": "afx9mk",
  "name": "O Último Guerreiro das Estrelas",
  "poster": "/ZnDKsyDNtuTwJDzy0M5IfA/...",
  "size": 715462912,
  "duration": 6029,
  "resolution": "HD"
}
```

### Do .txt (manifest):
```
https://sy6.marketprediction.cfd/v4/hls/afx9mk/index-f1-v1-a1.m3u8
```

### Do TMDB:
```json
{
  "id": 12345,
  "title": "O Último Guerreiro das Estrelas",
  "overview": "Um épico de ficção científica...",
  "poster_path": "/path/to/poster.jpg",
  "backdrop_path": "/path/to/backdrop.jpg",
  "vote_average": 7.5,
  "vote_count": 1250,
  "popularity": 45.2,
  "genre_ids": [28, 878, 12],
  "original_language": "pt",
  "release_date": "2024-01-15"
}
```

### Formulário preenchido:
```json
{
  "id": "12345",
  "title": "O Último Guerreiro das Estrelas",
  "name": "O Último Guerreiro das Estrelas",
  "original_title": "...",
  "original_name": "...",
  "video": "O Último Guerreiro das Estrelas",
  "URLvideo": "https://sy6.../index-f1-v1-a1.m3u8",
  "URLTxt": "https://cinestreamtent.strp2p.live/#afx9mk",
  "poster_path": "/path/to/poster.jpg",
  "backdrop_path": "/path/to/backdrop.jpg",
  "overview": "Um épico de ficção científica...",
  "vote_average": "7.5",
  "vote_count": "1250",
  "popularity": "45.2",
  "genre_ids": "28, 878, 12",
  "original_language": "pt",
  "adult": false
}
```

---

## 🔧 Arquivos Modificados/Criados

### 1. **`src/app/admin/page.tsx`** ✏️
- **Função modificada**: `importStreamP2PFile()`
  - Agora faz o fluxo completo
  - Chama `extract-m3u8`, `search-tmdb`, `fetch-tmdb`
  - Preenche o formulário automaticamente
  - Mostra mensagens de progresso

### 2. **`src/app/components/admin/media-form.tsx`** ✏️
- **Adicionado**: Seção de informações StreamP2P
  - Mostra qual arquivo foi importado
  - Mostra URL base do StreamP2P
  - Mostra URL .m3u8 extraída

### 3. **`src/app/api/admin/extract-m3u8/route.ts`** ✨ (criado)
- Busca arquivo .txt do StreamP2P
- Extrai URL .m3u8 com regex
- Tenta 5 URLs diferentes

### 4. **`src/app/api/admin/process-streamp2p/route.ts`** ✨ (criado)
- Integração completa (opcional)
- Faz tudo em uma chamada

### 5. **`src/lib/streamp2p.ts`** ✨ (criado)
- Utilitários reutilizáveis
- Funções para construir URLs
- Extração de .m3u8

---

## 🎯 Como usar

### Cenário 1: Importar um arquivo StreamP2P

1. **Abrir Admin Panel**
   - Acesse `/admin`
   - Clique em **"Buscar arquivos StreamP2P"**

2. **Modal aparece** com lista de arquivos

3. **Clique em "Importar"** no arquivo desejado

4. **Sistema faz automaticamente**:
   - ✅ Extrai ID
   - ✅ Monta URL base
   - ✅ Busca .m3u8
   - ✅ Busca na TMDB
   - ✅ Carrega dados completos
   - ✅ Preenche formulário

5. **Revise os dados** (se necessário, edite)

6. **Clique em "Adicionar Filme"** para salvar

---

## 📡 APIs disponíveis

### 1. POST `/api/admin/extract-m3u8`
Extrai URL .m3u8 de um arquivo StreamP2P
```json
POST /api/admin/extract-m3u8
{
  "fileId": "afx9mk",
  "streamUrl": "https://cinestreamtent.strp2p.live/#afx9mk"
}

Response:
{
  "m3u8Url": "https://sy6.../index-f1-v1-a1.m3u8",
  "success": true
}
```

### 2. GET `/api/admin/search-tmdb`
Busca na TMDB
```
GET /api/admin/search-tmdb?query=O+Último+Guerreiro&type=movie

Response:
{
  "results": [
    {
      "id": 12345,
      "title": "O Último Guerreiro das Estrelas",
      "poster_path": "/...",
      "release_date": "2024-01-15"
    }
  ]
}
```

### 3. GET `/api/admin/fetch-tmdb`
Carrega dados completos
```
GET /api/admin/fetch-tmdb?id=12345&type=movie

Response:
{
  "id": 12345,
  "title": "...",
  "overview": "...",
  "poster_path": "...",
  ... (dados completos)
}
```

### 4. POST `/api/admin/process-streamp2p` (opcional)
Faz tudo em uma chamada
```json
POST /api/admin/process-streamp2p
{
  "fileId": "afx9mk",
  "fileName": "O Último Guerreiro das Estrelas",
  "mediaType": "movie"
}

Response:
{
  "success": true,
  "formData": { ... },
  "metadata": { ... }
}
```

---

## 🛡️ Tratamento de Erros

Se algo der errado, o sistema mostra mensagens amigáveis:

- **❌ ID do arquivo não encontrado** → Volte e selecione outro arquivo
- **❌ Nenhum resultado na TMDB** → Feche modal e tente manualmente
- **❌ Erro ao carregar dados** → Pode haver problema com a conexão

---

## 🎨 Mensagens de feedback

Durante o processo:
- 🔄 "Processando arquivo StreamP2P..."
- 🔍 "Buscando na TMDB..."
- 📺 "Carregando dados..."
- ✅ "Arquivo importado com sucesso!"

---

## 🚀 Próximas melhorias (opcional)

- [ ] Cache de resultados TMDB
- [ ] Validação de URL antes de salvar
- [ ] Importação em lote
- [ ] Histórico de imports
- [ ] Sincronização com conta StreamP2P

---

**Desenvolvido com ❤️ para CineStream Admin**
