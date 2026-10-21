import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { FormIcon, CheckCircleIcon, XMarkIcon, TceprLogoIcon } from './icons';

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const translateAuthError = (code: string, fallbackMessage: string): string => {
    switch (code) {
      case 'auth/invalid-email':
        return 'O endereço de e-mail informado é inválido.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'E-mail ou senha incorretos. Por favor, verifique suas credenciais.';
      case 'auth/email-already-in-use':
        return 'Este e-mail já está cadastrado no sistema. Tente fazer login ou redefinir sua senha.';
      case 'auth/weak-password':
        return 'A senha deve conter no mínimo 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas sem sucesso. Por favor, aguarde alguns instantes e tente novamente.';
      case 'auth/user-disabled':
        return 'Sua conta de usuário foi desativada pelo administrador.';
      case 'auth/network-request-failed':
        return 'Falha na conexão de rede. Verifique sua internet.';
      default:
        return fallbackMessage || 'Ocorreu um erro ao processar a solicitação.';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha para continuar.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(translateAuthError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const emailLower = email.trim().toLowerCase();
    if (!emailLower.endsWith('@tce.pr.gov.br') && emailLower !== 'danilomgontijo@gmail.com') {
      setError('Apenas e-mails com domínio @tce.pr.gov.br são permitidos para cadastro.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim() && userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: displayName.trim(),
        });
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(translateAuthError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Digite seu e-mail para receber o link de redefinição de senha.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage('E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(translateAuthError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Image of TCEPR Building positioned on the left with translucent fade */}
      <div className="absolute inset-y-0 left-0 w-full md:w-2/3 lg:w-1/2 pointer-events-none overflow-hidden z-0">
        <img
          src="/tceprlogo.png"
          alt="Edifício TCEPR"
          className="w-full h-full object-cover object-left opacity-50 filter contrast-[1.05] saturate-[0.95]"
        />
        {/* Soft linear gradient fading the image into the page background on the right and bottom */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/50 to-slate-100" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-100/30 via-transparent to-slate-100/60" />
      </div>

      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-tcepr-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-tcepr-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-md mb-4">
            <TceprLogoIcon className="h-12 w-12" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-850 tracking-tight drop-shadow-2xs">
            TCEPR <span className="text-tcepr-600">Fiscalização</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 font-bold mt-1 drop-shadow-2xs">
            Tribunal de Contas do Estado do Paraná
          </p>
          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
            Sistema Gestão de Fiscalizações
          </p>
        </div>

        {/* Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl shadow-slate-900/10 rounded-3xl p-6 sm:p-8"
        >
          {/* Mode Switcher Tabs */}
          {mode !== 'forgot' && (
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-white text-tcepr-700 shadow-xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-white text-tcepr-700 shadow-xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                Criar Conta
              </button>
            </div>
          )}

          {/* Alert Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
              >
                <XMarkIcon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </motion.div>
            )}

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-750 text-xs sm:text-sm flex items-start gap-2.5"
              >
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forms */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  E-mail institucional
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@tce.pr.gov.br"
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 transition-colors outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs font-bold text-tcepr-600 hover:text-tcepr-800 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 transition-colors outline-none pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors px-1 py-0.5"
                  >
                    {showPassword ? 'Ocultar' : 'Exibir'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 bg-gradient-to-r from-tcepr-700 to-tcepr-600 hover:from-tcepr-600 hover:to-tcepr-500 text-white font-bold rounded-xl shadow-xs transition-all duration-200 active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer border border-tcepr-600/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <span>Entrar no Sistema</span>
                )}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 transition-colors outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@tce.pr.gov.br"
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 transition-colors outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Senha (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 transition-colors outline-none pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors px-1 py-0.5"
                  >
                    {showPassword ? 'Ocultar' : 'Exibir'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Confirmar Senha
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 transition-colors outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 bg-gradient-to-r from-tcepr-700 to-tcepr-600 hover:from-tcepr-600 hover:to-tcepr-500 text-white font-bold rounded-xl shadow-xs transition-all duration-200 active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer border border-tcepr-600/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Criando Conta...</span>
                  </>
                ) : (
                  <span>Cadastrar e Acessar</span>
                )}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="mb-2">
                <h3 className="text-base font-bold text-slate-800 mb-1">Redefinição de Senha</h3>
                <p className="text-xs text-slate-500">
                  Informe o e-mail cadastrado na sua conta. Enviaremos um link seguro para criar uma nova senha.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  E-mail cadastrado
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@tce.pr.gov.br"
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-tcepr-500 focus:ring-1 focus:ring-tcepr-500 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 transition-colors outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-tcepr-600 hover:bg-tcepr-700 text-white font-bold rounded-xl shadow-xs transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer border border-tcepr-550"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Enviando e-mail...</span>
                  </>
                ) : (
                  <span>Enviar E-mail de Recuperação</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors text-center"
              >
                ← Voltar para o Login
              </button>
            </form>
          )}
        </motion.div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-slate-400 font-medium mt-6">
          Sua sessão é mantida de forma segura e persistente.
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
