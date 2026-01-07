# 🎬 Painel Administrativo - CineStream

Painel web para adicionar filmes, séries e animes no seu sistema de streaming.

## ✨ Funcionalidades

- 🔍 **Busca por título** no TMDB
- 📋 **Lista visual** de resultados com posters
- ✅ **Preenchimento automático** de dados (sinopse, poster, gêneros, etc)
- 🎥 **Suporte para filmes** (URL única)
- 📺 **Suporte para séries/animes** (múltiplas temporadas e episódios)
- 🚀 **Commit automático** no GitHub via API

## 🛠️ Configuração

### 1. Criar Token do GitHub

1. Acesse: https://github.com/settings/tokens/new
2. Dê um nome: `CineStream Admin`
3. Marque a permissão: **`repo`** (Full control of private repositories)
4. Clique em **Generate token**
5. **Copie o token gerado** (você não verá novamente!)

### 2. Configurar Variável de Ambiente

#### Para desenvolvimento local:

Crie/edite o arquivo `.env.local` na raiz do projeto:

```env
GITHUB_TOKEN=seu_token_aqui
TMDB_API_KEY=60b55db2a598d09f914411a36840d1cb
```

#### Para produção (Vercel):

1. Acesse: https://vercel.com/seu-usuario/teste-de-api/settings/environment-variables
2. Adicione a variável:
   - **Name:** `GITHUB_TOKEN`
   - **Value:** `seu_token_aqui`
   - **Environment:** Production, Preview, Development
3. Clique em **Save**
4. Faça um novo deploy

### 3. Instalar Dependências

```bash
npm install
```

## 🚀 Como Usar

### 1. Acessar o Painel

```
http://localhost:3000/admin
```

Ou em produção:
```
https://seu-site.vercel.app/admin
```

### 2. Adicionar Conteúdo

#### Para Filmes:

1. Clique na aba **🎥 Filmes**
2. Digite o nome do filme (ex: "Five Nights at Freddy's 2")
3. Clique em **🔍 Buscar**
4. Escolha o filme da lista de resultados
5. **Adicione apenas a URL do vídeo** no campo vermelho
6. Clique em **✅ Adicionar Filme**

#### Para Séries/Animes:

1. Clique na aba **📺 Séries** ou **🎌 Animes**
2. Busque pelo título
3. Selecione da lista
4. **Adicione episódios:**
   - Digite a temporada (ex: 1)
   - Digite o episódio (ex: 1)
   - Cole a URL do episódio
   - Clique em **➕ Adicionar**
   - Repita para cada episódio
5. Clique em **✅ Adicionar Série/Anime**

### 3. Resultado

O sistema irá:
- ✅ Adicionar o item no arquivo JSON correspondente (`filmes.json`, `series.json` ou `animes.json`)
- ✅ Fazer commit automático no GitHub
- ✅ O conteúdo ficará disponível na API imediatamente após o commit

## 📁 Estrutura de Arquivos

```
src/
├── app/
│   ├── admin/
│   │   └── page.tsx              # Página principal do admin
│   └── api/
│       └── admin/
│           ├── search-tmdb/
│           │   └── route.ts      # API: Buscar por título no TMDB
│           ├── fetch-tmdb/
│           │   └── route.ts      # API: Buscar detalhes por ID
│           └── add-media/
│               └── route.ts      # API: Adicionar mídia via GitHub
```

## 🔧 APIs Criadas

### 1. `GET /api/admin/search-tmdb`

Busca conteúdo por título no TMDB.

**Parâmetros:**
- `query` (string): Termo de busca
- `type` (string): `movie` ou `tv`

**Exemplo:**
```
GET /api/admin/search-tmdb?query=Avengers&type=movie
```

### 2. `GET /api/admin/fetch-tmdb`

Busca detalhes completos por ID do TMDB.

**Parâmetros:**
- `id` (number): ID do TMDB
- `type` (string): `movie` ou `tv`

**Exemplo:**
```
GET /api/admin/fetch-tmdb?id=24428&type=movie
```

### 3. `POST /api/admin/add-media`

Adiciona mídia no GitHub.

**Body:**
```json
{
  "type": "filmes",
  "data": {
    "id": "1228246",
    "title": "Five Nights at Freddy's 2",
    "video": "https://cdn.example.com/video.m3u8",
    ...
  }
}
```

## 🎨 Gêneros do TMDB (para referência)

| ID | Gênero |
|----|--------|
| 28 | Ação |
| 12 | Aventura |
| 16 | Animação |
| 35 | Comédia |
| 80 | Crime |
| 99 | Documentário |
| 18 | Drama |
| 10751 | Família |
| 14 | Fantasia |
| 36 | História |
| 27 | Terror |
| 10402 | Música |
| 9648 | Mistério |
| 10749 | Romance |
| 878 | Ficção Científica |
| 10770 | Cinema TV |
| 53 | Thriller |
| 10752 | Guerra |
| 37 | Faroeste |

## 🔒 Segurança

⚠️ **IMPORTANTE:**

1. **Nunca** commite o arquivo `.env.local` no GitHub
2. O `.env.local` já está no `.gitignore`
3. Mantenha seu `GITHUB_TOKEN` seguro
4. Considere adicionar autenticação na rota `/admin` para produção

### Adicionar Proteção por Senha (Opcional)

Crie um middleware em `src/app/admin/layout.tsx`:

```typescript
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Adicione sua lógica de autenticação aqui
  const isAuthenticated = true; // Implementar verificação

  if (!isAuthenticated) {
    return <div>Acesso negado</div>;
  }

  return <>{children}</>;
}
```

## 📝 Notas

- Os dados do TMDB são em **português (pt-BR)** por padrão
- As imagens são carregadas do CDN do TMDB
- Os commits no GitHub são automáticos e incluem o título do conteúdo
- Para séries/animes, o formato de episódio é `eps_01`, `eps_02`, etc
- Para temporadas, o formato é `temporada_1`, `temporada_2`, etc

## 🐛 Troubleshooting

### Erro: "GITHUB_TOKEN não configurado"
- Verifique se adicionou o token no `.env.local` ou nas variáveis do Vercel

### Erro: "Erro ao buscar no TMDB"
- Verifique se o `TMDB_API_KEY` está correto
- Confirme que tem conexão com a internet

### Erro ao fazer commit
- Verifique se o token do GitHub tem permissão `repo`
- Confirme que o repositório `vicortavares824/teste-de-api` existe

### Página /admin não carrega
- Execute `npm run dev` novamente
- Verifique se há erros no console do navegador

## 📞 Suporte

Em caso de dúvidas ou problemas, verifique:
1. Console do navegador (F12)
2. Logs do terminal onde o Next.js está rodando
3. Variáveis de ambiente configuradas corretamente

---

**Desenvolvido para CineStream** 🎬✨
