# StreamP2P URL Builder - Documentação

## 🎯 O que foi implementado?

Um sistema automático que pega um arquivo StreamP2P e:
1. **Monta a URL base** a partir do ID: `https://cinestreamtent.strp2p.live/#id`
2. **Busca o arquivo .txt** (manifest) em várias URLs conhecidas
3. **Extrai a URL .m3u8** do arquivo de manifest
4. **Preenche automaticamente** o formulário de importação

## 🔧 Como funciona?

### Fluxo no Admin (botão "Importar")

Quando você clica em **"Importar"** em um arquivo StreamP2P:

```
┌─────────────────────┐
│  Arquivo StreamP2P  │
│  {                  │
│    "id": "afx9mk"   │
│    "name": "..."    │
│  }                  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  API POST /api/admin/extract-m3u8           │
│                                             │
│  1. Monta URL base:                         │
│     https://cinestreamtent.strp2p.live/#id │
│                                             │
│  2. Busca em 5 URLs de manifest:            │
│     - asset.syncp2p.com/.../manifest.txt   │
│     - asset.syncp2p.com/.../index.txt      │
│     - asset.syncp2p.com/.../playlist.txt   │
│     - cinestreamtent.strp2p.live/.../txt   │
│     - sy6.marketprediction.cfd/v4/mf/...   │
│                                             │
│  3. Extrai URL .m3u8 do arquivo             │
│  4. Retorna resultado                       │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Formulário atualizado com:         │
│  - video: "Nome do arquivo"         │
│  - URLvideo: "https://...m3u8"      │
│  - URLTxt: "https://...#id"         │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Salvar no banco (add-media)         │
│  URLs já processadas e prontas ✅    │
└─────────────────────────────────────┘
```

## 📝 Exemplo de uso

### Dados de entrada (StreamP2P)
```json
{
  "id": "afx9mk",
  "name": "O Último Guerreiro das Estrelas",
  "poster": "/ZnDKsyDNtuTwJDzy0M5IfA/pq/r8c1n1nh/9cef6n/poster.png",
  "size": 715462912,
  "duration": 6029,
  "resolution": "HD"
}
```

### O que acontece internamente

1. **ID extraído**: `afx9mk`
2. **URL base construída**: `https://cinestreamtent.strp2p.live/#afx9mk`
3. **Manifest buscado** em:
   - `https://asset.syncp2p.com/afx9mk/manifest.txt`
   - `https://asset.syncp2p.com/afx9mk/index.txt`
   - ... (outras URLs)
4. **Conteúdo do manifest** (exemplo):
   ```
   https://sy6.marketprediction.cfd/v4/hls/afx9mk/index-f1-v1-a1.m3u8
   https://backup.streaming.com/afx9mk.m3u8
   ```
5. **URL .m3u8 extraída**: `https://sy6.marketprediction.cfd/v4/hls/afx9mk/index-f1-v1-a1.m3u8`

### Resultado final no formulário
```
video: "O Último Guerreiro das Estrelas"
URLvideo: "https://sy6.marketprediction.cfd/v4/hls/afx9mk/index-f1-v1-a1.m3u8"
URLTxt: "https://cinestreamtent.strp2p.live/#afx9mk"
```

## 🛠️ Arquivos criados/modificados

### 1. **`src/app/admin/page.tsx`** (modificado)
- Função `importStreamP2PFile` agora é assíncrona
- Chama a API `/api/admin/extract-m3u8`
- Trata erros e exibe mensagens ao usuário

### 2. **`src/app/api/admin/extract-m3u8/route.ts`** (novo)
- API que faz a extração automática
- Busca em múltiplas URLs conhecidas
- Extrai URLs .m3u8 com regex
- Retorna JSON com resultado

### 3. **`src/lib/streamp2p.ts`** (novo)
- Utilitários reutilizáveis
- Funções para construir URLs
- Extração de .m3u8 com regex
- Fetch com timeout
- Processamento de arquivos completo

## 📡 API Reference

### POST `/api/admin/extract-m3u8`

**Request:**
```json
{
  "fileId": "afx9mk",
  "streamUrl": "https://cinestreamtent.strp2p.live/#afx9mk"
}
```

**Response (sucesso):**
```json
{
  "m3u8Url": "https://sy6.marketprediction.cfd/v4/hls/afx9mk/index-f1-v1-a1.m3u8",
  "success": true,
  "message": "URL processada com sucesso"
}
```

**Response (erro):**
```json
{
  "error": "fileId e streamUrl são obrigatórios",
  "status": 400
}
```

## 🔍 Como usar os utilitários em outro lugar

```typescript
import { 
  processStreamP2PFile, 
  buildStreamP2PUrl,
  extractM3U8FromText,
  generateManifestUrls
} from '@/lib/streamp2p'

// Processar arquivo completo
const file = { id: 'afx9mk', name: 'Meu filme' }
const result = await processStreamP2PFile(file)
console.log(result.m3u8Url) // URL .m3u8 pronta

// Ou usar funções individuais
const baseUrl = buildStreamP2PUrl('afx9mk')
const manifestUrls = generateManifestUrls('afx9mk')
const m3u8 = extractM3U8FromText(someText)
```

## ✅ Checklist

- [x] Função de importação automática
- [x] Busca em múltiplas URLs de manifest
- [x] Extração de .m3u8 com regex
- [x] API de processamento
- [x] Mensagens de feedback
- [x] Utilitários reutilizáveis
- [x] Tratamento de erros
- [x] Timeout nas requisições
- [x] User-Agent customizado

## 🚀 Próximos passos (opcional)

1. **Cache**: Salvar URLs processadas para não buscar novamente
2. **Batch processing**: Importar múltiplos arquivos de uma vez
3. **Validação**: Verificar se a URL .m3u8 realmente funciona antes de salvar
4. **Logs**: Registrar todas as tentativas de extração
5. **Admin dashboard**: Mostrar estatísticas de imports

---

**Desenvolvido com ❤️ para CineStream**
