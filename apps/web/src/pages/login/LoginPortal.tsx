import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../features/auth/context/AuthContext.js';
import type { UserRole } from '@restaurant-qr/core';
import { ChefHat, CreditCard, ShieldCheck, Store, UserCheck, Utensils, Lock, Mail, Eye, EyeOff, UserPlus } from 'lucide-react';

export const LoginPortal: React.FC = () => {
  const { login, signUp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map route paths to roles, seed logins, and themes
  const path = location.pathname;
  let role: UserRole = 'restaurant-admin';
  let title = 'Restaurant Administration';
  let defaultEmail = 'admin@example.com';
  let Icon = Store;
  let accentColor = 'from-emerald-500 to-teal-500';
  let textAccent = 'text-emerald-400';

  if (path.startsWith('/super-admin')) {
    role = 'super-admin';
    title = 'Super Admin SaaS Platform';
    defaultEmail = 'superadmin@example.com';
    Icon = ShieldCheck;
    accentColor = 'from-violet-600 to-indigo-600';
    textAccent = 'text-indigo-400';
  } else if (path.startsWith('/manager')) {
    role = 'manager';
    title = 'Operations Manager Portal';
    defaultEmail = 'manager@example.com';
    Icon = UserCheck;
    accentColor = 'from-sky-500 to-blue-500';
    textAccent = 'text-sky-400';
  } else if (path.startsWith('/kitchen')) {
    role = 'kitchen-staff';
    title = 'Kitchen Station Display (KDS)';
    defaultEmail = 'kitchen@example.com';
    Icon = ChefHat;
    accentColor = 'from-orange-500 to-red-500';
    textAccent = 'text-orange-400';
  } else if (path.startsWith('/waiter')) {
    role = 'waiter';
    title = 'Waiter Service Board';
    defaultEmail = 'waiter@example.com';
    Icon = Utensils;
    accentColor = 'from-amber-500 to-orange-500';
    textAccent = 'text-amber-400';
  } else if (path.startsWith('/cashier')) {
    role = 'cashier';
    title = 'Cashier Billing & POS';
    defaultEmail = 'cashier@example.com';
    Icon = CreditCard;
    accentColor = 'from-teal-500 to-emerald-500';
    textAccent = 'text-teal-400';
  }

  // Pre-fill default email for convenience only in sign-in mode when empty
  useState(() => {
    if (!email) {
      setEmail(defaultEmail);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Please fill in all fields.');
      }

      if (isRegistering) {
        // Enforce basic password strength
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await signUp(email, password, role);
      } else {
        await login(email, password);
      }

      // Route to active portal workspace
      let targetDashboard = '/admin';
      if (role === 'super-admin') targetDashboard = '/super-admin';
      else if (role === 'manager') targetDashboard = '/manager';
      else if (role === 'kitchen-staff') targetDashboard = '/kitchen';
      else if (role === 'waiter') targetDashboard = '/waiter';
      else if (role === 'cashier') targetDashboard = '/cashier';

      navigate(targetDashboard);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white px-4">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-zinc-800/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md border border-zinc-800/80 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-xl rounded-3xl"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center border border-zinc-700/50 bg-zinc-800/30 rounded-2xl mb-4 shadow-lg text-zinc-100">
            {isRegistering ? <UserPlus className="h-7 w-7 text-emerald-400" /> : <Icon className="h-7 w-7" />}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isRegistering ? 'Create Account' : title}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {isRegistering 
              ? `Registering credentials for Role: [${role.toUpperCase()}]`
              : 'Sign in to access your administrative dashboard'}
          </p>
        </div>

        {error && (
          <div className="mb-6 border border-red-500/25 bg-red-500/10 p-3 rounded-xl text-xs text-red-400 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold tracking-wider uppercase text-zinc-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950/80 pl-10 pr-4 py-3 text-sm focus:border-zinc-700 focus:outline-none transition duration-200 text-zinc-200 rounded-xl"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold tracking-wider uppercase text-zinc-400">Password</label>
              {!isRegistering && <a href="#" className={`text-xs ${textAccent} hover:underline`}>Forgot?</a>}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950/80 pl-10 pr-10 py-3 text-sm focus:border-zinc-700 focus:outline-none transition duration-200 text-zinc-200 rounded-xl"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 font-semibold text-white bg-gradient-to-r ${accentColor} hover:brightness-110 active:scale-[0.99] transition duration-200 rounded-xl shadow-lg shadow-zinc-950/40 text-sm mt-2`}
          >
            {isSubmitting 
              ? 'Verifying...' 
              : isRegistering 
              ? 'Create Account' 
              : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-900 text-center text-xs text-zinc-500">
          {isRegistering ? (
            <p>
              Already have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setIsRegistering(false); setError(''); }}
                className={`${textAccent} hover:underline font-semibold`}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setIsRegistering(true); setError(''); }}
                className={`${textAccent} hover:underline font-semibold`}
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
