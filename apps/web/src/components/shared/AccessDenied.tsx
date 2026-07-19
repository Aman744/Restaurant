import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative max-w-md border border-zinc-800 bg-zinc-900/55 p-8 text-center shadow-2xl backdrop-blur-xl rounded-3xl"
      >
        {/* Decorative Glow */}
        <div className="absolute -top-12 left-1/2 h-24 w-24 -translate-x-1/2 blur-2xl rounded-full bg-red-500/20" />

        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-red-500/30 text-red-500 bg-red-500/10 rounded-2xl mb-6">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Access Denied</h1>
        <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
          Your account permissions do not grant you access to this portal. If you think this is a mistake, please reach out to your administrator.
        </p>

        <button
          onClick={() => navigate(-1)}
          className="group mx-auto flex items-center justify-center gap-2 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white px-5 py-3 transition-all duration-300 font-medium rounded-xl text-zinc-300 text-sm shadow-md"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Go Back
        </button>
      </motion.div>
    </div>
  );
};
