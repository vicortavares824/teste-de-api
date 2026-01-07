# 🔐 Sistema de Login - CineStream Admin

## 📋 Visão Geral

Sistema de autenticação simples e seguro para proteger o painel administrativo do CineStream.

## ✨ Funcionalidades

- ✅ **Login com Usuário e Senha**
- ✅ **Sessão com Cookies** (HTTPOnly, Secure)
- ✅ **Proteção de Rotas** (Middleware automático)
- ✅ **Logout Seguro**
- ✅ **Redirecionamento Automático**
- ✅ **Design Moderno** (Tailwind CSS + Heroicons)

---

## 🚀 Como Usar

### 1. **Configurar Credenciais**

Edite o arquivo `.env.local`:

```env
# Credenciais de Login (ALTERE PARA MAIOR SEGURANÇA!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 2. **Acessar o Painel**

1. Acesse: `http://localhost:3000/admin`
2. Você será redirecionado para: `http://localhost:3000/admin/login`
3. Entre com as credenciais configuradas
4. Será redirecionado automaticamente para `/admin`

### 3. **Fazer Logout**

- Clique no botão **"Sair"** no canto superior direito
- Você será deslogado e redirecionado para a tela de login

---

## 🔒 Segurança

### **Cookies Seguros**
```typescript
{
  httpOnly: true,           // Não acessível via JavaScript
  secure: true,             // Apenas HTTPS (produção)
  sameSite: 'lax',          // Proteção contra CSRF
  maxAge: 60 * 60 * 24,     // 24 horas
}
```

### **Middleware de Proteção**
```typescript
// Bloqueia acesso não autorizado a /admin/*
// Exceto /admin/login
```

### **Variáveis de Ambiente**
- ✅ Credenciais nunca no código
- ✅ Arquivo `.env.local` no `.gitignore`
- ✅ Fácil de alterar sem recompilar

---

## 📁 Arquivos Criados

```
src/
├── app/
│   ├── admin/
│   │   ├── login/
│   │   │   └── page.tsx           # ✅ Página de login
│   │   └── page.tsx                # ✅ Painel protegido
│   └── api/
│       └── auth/
│           ├── login/
│           │   └── route.ts        # ✅ API de login
│           └── logout/
│               └── route.ts        # ✅ API de logout
└── middleware.ts                   # ✅ Proteção de rotas
```

---

## 🎨 Design da Tela de Login

```
┌─────────────────────────────────────┐
│          🎬 CineStream Admin        │
│    Faça login para acessar o painel │
├─────────────────────────────────────┤
│                                     │
│  👤 Usuário                         │
│  ┌─────────────────────────────┐   │
│  │ admin                       │   │
│  └─────────────────────────────┘   │
│                                     │
│  🔒 Senha                           │
│  ┌─────────────────────────────┐   │
│  │ ••••••••••                  │ 👁 │
│  └─────────────────────────────┘   │
│                                     │
│  ┌──────────[  Entrar  ]──────┐   │
│  └─────────────────────────────┘   │
│                                     │
│  Credenciais configuradas no        │
│  arquivo .env.local                 │
└─────────────────────────────────────┘
```

---

## ⚙️ Personalização

### **Alterar Credenciais Padrão**

1. Edite `.env.local`:
   ```env
   ADMIN_USERNAME=seu_usuario
   ADMIN_PASSWORD=sua_senha_segura123!
   ```

2. Reinicie o servidor:
   ```bash
   npm run dev
   ```

### **Tempo de Sessão**

Edite `src/app/api/auth/login/route.ts`:
```typescript
maxAge: 60 * 60 * 24 * 7,  // 7 dias ao invés de 24h
```

### **Adicionar Mais Usuários**

Para múltiplos usuários, crie um sistema com banco de dados:
- Sugerimos: Prisma + PostgreSQL
- Ou Firebase Authentication
- Ou NextAuth.js

---

## 🛠️ Melhorias Futuras (Opcional)

- [ ] Banco de dados para múltiplos usuários
- [ ] Hash de senhas (bcrypt)
- [ ] JWT tokens
- [ ] Two-Factor Authentication (2FA)
- [ ] Logs de acesso
- [ ] Rate limiting (proteção contra força bruta)
- [ ] Esqueci minha senha
- [ ] Registro de novos usuários

---

## 📝 Fluxo de Autenticação

```
1. Usuário acessa /admin
   ↓
2. Middleware verifica cookie
   ↓
3a. ✅ Tem sessão? → Acessa /admin
3b. ❌ Sem sessão? → Redireciona para /admin/login
   ↓
4. Usuário faz login
   ↓
5. API valida credenciais
   ↓
6a. ✅ Válido? → Cria cookie + Redireciona para /admin
6b. ❌ Inválido? → Mostra erro
```

---

## 🐛 Troubleshooting

### **Problema: "Usuário ou senha inválidos"**
- Verifique o arquivo `.env.local`
- Confirme que as variáveis `ADMIN_USERNAME` e `ADMIN_PASSWORD` estão corretas
- Reinicie o servidor após alterar `.env.local`

### **Problema: Redirecionamento infinito**
- Limpe os cookies do navegador
- Acesse no modo anônimo/privado
- Verifique se o middleware está configurado corretamente

### **Problema: Sessão expira muito rápido**
- Aumente o `maxAge` no arquivo `login/route.ts`
- Verifique se o cookie está sendo salvo corretamente

---

## 📚 Recursos

- **Next.js Middleware**: https://nextjs.org/docs/app/building-your-application/routing/middleware
- **Cookies em Next.js**: https://nextjs.org/docs/app/api-reference/functions/cookies
- **Tailwind CSS**: https://tailwindcss.com
- **Heroicons**: https://heroicons.com

---

## ⚠️ Avisos Importantes

1. **NÃO commit** o arquivo `.env.local` no Git
2. **Altere as credenciais padrão** antes de fazer deploy
3. **Use HTTPS** em produção para cookies seguros
4. **Implemente hash de senhas** para produção séria

---

## 🎉 Pronto!

Seu painel admin agora está protegido por login! 🔐✨

**Credenciais Padrão:**
- Usuário: `admin`
- Senha: `admin123`

**URLs:**
- Login: `http://localhost:3000/admin/login`
- Painel: `http://localhost:3000/admin`
