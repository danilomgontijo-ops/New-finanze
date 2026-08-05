import React, { useState } from 'react';
import { signInGoogle, signInEmail, signUpEmail, signInAnon } from '../services/firebase';
import { Mail, Lock, Loader2, AlertCircle, LogIn, ArrowRight, Wallet, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUpEmail(email, password);
      } else {
        await signInEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Ocorreu um erro ao tentar entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInGoogle();
    } catch (err) {
      console.error(err);
      setError('Erro ao conectar com Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnon = async () => {
    setLoading(true);
    try {
      await signInAnon();
    } catch (err) {
      setError('Erro ao entrar como convidado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 md:p-8 select-none relative overflow-hidden transition-colors duration-300">
      {/* Background shapes for a high-end designer layout */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-100 dark:bg-blue-950/20 rounded-full blur-3xl opacity-40"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-50 dark:bg-blue-950/20 rounded-full blur-3xl opacity-60"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] bg-white dark:bg-zinc-900 rounded-3xl shadow-xl shadow-zinc-200/50 dark:shadow-none border border-zinc-200/60 dark:border-zinc-800/80 overflow-hidden relative z-10"
      >
        {/* Decorative Top Accent Bar */}
        <div className="h-1.5 bg-blue-600 w-full"></div>

        {/* Header */}
        <div className="p-8 pb-4 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-14 h-14 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
          >
            <Wallet className="w-7 h-7 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
          </motion.div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">FinanZe</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5 font-normal px-4">
            Sua jornada para a independência financeira começa aqui
          </p>
        </div>

        <div className="p-8 pt-4">
          {/* Google Button */}
          <motion.button 
            whileHover={{ scale: 1.01, backgroundColor: '#fafafa' }}
            whileTap={{ scale: 0.99 }}
            onClick={handleGoogle}
            disabled={loading}
            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-700/50 transition-colors shadow-sm mb-5 cursor-pointer text-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Entrar com o Google
          </motion.button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200/60 dark:border-zinc-700/60"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 font-medium tracking-wide uppercase">ou com e-mail</span>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-sm rounded-xl flex items-start gap-3"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" /> 
              <span className="font-medium leading-normal">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1.5 ml-1 tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-zinc-800 focus:border-transparent outline-none text-zinc-900 dark:text-zinc-50 font-medium transition-all text-sm placeholder-zinc-400 dark:placeholder-zinc-500"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Senha</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-zinc-800 focus:border-transparent outline-none text-zinc-900 dark:text-zinc-50 font-medium transition-all text-sm placeholder-zinc-400 dark:placeholder-zinc-500"
                  placeholder="Sua senha secreta"
                  minLength={6}
                />
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 dark:bg-blue-500 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2 mt-6 cursor-pointer text-sm"
            >
              {loading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <>
                  <span>{isSignUp ? 'Criar Nova Conta' : 'Entrar na Conta'}</span>
                  <LogIn size={16} />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              className="text-blue-600 dark:text-blue-400 font-semibold text-sm hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
            >
              {isSignUp ? 'Já possui uma conta? Faça login' : 'Primeira vez aqui? Cadastre-se'}
            </button>
          </div>
          
          <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <button 
              onClick={handleAnon} 
              disabled={loading}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>Experimentar sem cadastro (Dados locais)</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
