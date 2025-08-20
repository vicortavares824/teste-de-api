# CineStreamApi - Documentação dos Endpoints

## Visão Geral
Esta API fornece endpoints para consulta de filmes, séries, animes e pesquisa de títulos, retornando dados estruturados para uso em aplicativos ou sistemas.

---

## Endpoints Disponíveis

### 1. Filmes
#### `GET /api/filmes`
**Descrição:** Retorna uma lista paginada de filmes populares ou recentes.
**Parâmetros:**
  - `page` (opcional): número da página (default: 1)
**Exemplo de requisição:**
  ```http
  GET https://cine-stream-api.vercel.app/api/filmes?page=1
  ```
**Retorno:**
```json
{
  "page": 1,
  "totalPaginas": 751,
  "totalResults": 15010,
  "results": [
    {
      "id": 527641,
      "title": "A Cinco Passos de Você",
      "original_title": "Five Feet Apart",
      "overview": "Dois pacientes com fibrose cística se apaixonam...",
      "release_date": "2019-03-14",
      "genres": [
        { "id": 10749, "name": "Romance" },
        { "id": 18, "name": "Drama" }
      ],
      "poster_path": "/uwyySfv4kybDpVebZhyb0Bnk3dz.jpg",
      "backdrop_path": "/27ZkYMWynuK2qiDP6awc3MsCaOs.jpg",
      "vote_average": 8.233,
      "vote_count": 5764,
      "imdb_id": "tt6472976",
      "tmdb_media_type": "movie",
      ...outros campos...
    },
    ...
  ]
}
```
**Principais campos de cada filme:**
- `id`: ID do filme
- `title`: título
- `original_title`: título original
- `overview`: sinopse
- `release_date`: data de lançamento
- `genres`: array de gêneros
- `poster_path`: imagem do pôster
- `backdrop_path`: imagem de fundo
- `vote_average`: nota média
- `vote_count`: número de votos
- `imdb_id`: ID do IMDB

---

### 2. Séries
#### `GET /api/series`
**Descrição:** Retorna uma lista paginada de séries populares ou recentes.
**Parâmetros:**
  - `page` (opcional): número da página (default: 1)
**Exemplo de requisição:**
  ```http
  GET https://cine-stream-api.vercel.app/api/series?page=1
  ```
**Retorno:**
```json
{
  "page": 1,
  "totalPaginas": 500,
  "totalResults": 10000,
  "results": [
    {
      "id": 94605,
      "name": "Nome da Série",
      "original_name": "Original Name",
      "overview": "Sinopse da série...",
      "first_air_date": "2024-01-01",
      "genres": [ ... ],
      "poster_path": "/imagem.jpg",
      "backdrop_path": "/imagem_fundo.jpg",
      "vote_average": 8.0,
      "vote_count": 1000,
      "tmdb_media_type": "tv",
      ...outros campos...
    },
    ...
  ]
}
```
**Principais campos de cada série:**
- `id`: ID da série
- `name`: nome
- `original_name`: nome original
- `overview`: sinopse
- `first_air_date`: data de estreia
- `genres`: array de gêneros
- `poster_path`: imagem do pôster
- `backdrop_path`: imagem de fundo

---

### 3. Animes
#### `GET /api/animes`
**Descrição:** Retorna uma lista paginada de animes populares ou recentes.
**Parâmetros:**
  - `page` (opcional): número da página (default: 1)
**Exemplo de requisição:**
  ```http
  GET https://cine-stream-api.vercel.app/api/animes?page=1
  ```
**Retorno:**
```json
{
  "page": 1,
  "totalPaginas": 100,
  "totalResults": 2000,
  "results": [
    {
      "id": 12345,
      "title": "Nome do Anime",
      "overview": "Sinopse do anime...",
      "release_date": "2023-01-01",
      "genres": [ ... ],
      "poster_path": "/imagem.jpg",
      "backdrop_path": "/imagem_fundo.jpg",
      "vote_average": 7.5,
      "vote_count": 500,
      "tmdb_media_type": "anime",
      ...outros campos...
    },
    ...
  ]
}
```
**Principais campos de cada anime:**
- `id`: ID do anime
- `title`: nome
- `overview`: sinopse
- `release_date`: data de lançamento
- `genres`: array de gêneros
- `poster_path`: imagem do pôster
- `backdrop_path`: imagem de fundo

---

### 4. Pesquisa
#### `GET https://cine-stream-api.vercel.app/api/pesquisa?q=palavra`
**Descrição:** Pesquisa filmes, séries ou animes pelo nome.
**Parâmetros:**
  - `query` (obrigatório): termo de busca
  - `page` (opcional): número da página (default: 1)
**Exemplo de requisição:**
  ```http
  GET https://cine-stream-api.vercel.app/api/pesquisa?q=matrix
  ```
**Retorno:**
```json
{
  "resultados": [
    {
      "title": "Matrix",
      "ano": "1999",
      "tipo": "Filme",
      "img": "https://d1muf25xaso8hp.cloudfront.net/https://image.tmdb.org/t/p/w500/lDqMDI3xpbB9UQRyeXfei0MXhqb.jpg",
      "link": "https://superflixapi.mom/filme/603",
      "imdb_id": "tt0133093",
      "score": "82"
    },
    // ...outros resultados...
  ]
}
```
**Principais campos de cada resultado:**
- `title`: nome do item
- `ano`: ano de lançamento
- `tipo`: tipo do item (Filme, Série, Anime)
- `img`: URL da imagem do pôster
- `link`: URL para acessar o item
- `imdb_id`: ID do IMDB
- `score`: pontuação

---

## Observações Gerais
- Todos os métodos são `GET`.
- Os retornos são arrays de objetos, cada um representando um item encontrado.
- Os campos mais comuns: `id`, `titulo`, `ano`, `imagem`, `sinopse`, `tipo` (na pesquisa).
- Para detalhes de um item específico, utilize o `id` retornado em cada objeto.

---

## Exemplo de uso com fetch (JavaScript)
```js
fetch('https://cine-stream-api.vercel.app/api/filmes')
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## Autor
- Deploy: https://cine-stream-api.vercel.app
