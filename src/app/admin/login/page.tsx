'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockClosedIcon, UserIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Login bem-sucedido
        router.push('/admin');
        router.refresh();
      } else {
        setError(data.error || 'Usuário ou senha inválidos');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4">
            <span className="text-4xl">🎬</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">CineStream Admin</h1>
          <p className="text-zinc-400">Faça login para acessar o painel</p>
        </div>

        {/* Card de Login */}
        <div className="bg-zinc-900/50 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Mensagem de Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Campo de Usuário */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Usuário
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="Digite seu usuário"
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Campo de Senha */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Senha
              </label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Digite sua senha"
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl pl-11 pr-11 py-3 text-white placeholder-zinc-500 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Botão de Login */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                loading
                  ? 'bg-zinc-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg hover:shadow-green-500/30 hover:scale-[1.02]'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Informação */}
          <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
            <p className="text-sm text-zinc-500">
              Credenciais padrão configuradas no arquivo <code className="text-green-400">.env.local</code>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-zinc-600">
          <p>© 2026 CineStream. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}
