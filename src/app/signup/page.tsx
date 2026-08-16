'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage('Account created. Redirecting...');
    setTimeout(() => router.push('/login'), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-white">Sign up</h1>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-green-400 bg-green-950/50 border border-green-900 rounded px-3 py-2">
            {message}
          </p>
        )}

        <div>
          <label className="text-sm text-neutral-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-white outline-none focus:border-neutral-500"
          />
        </div>

        <div>
          <label className="text-sm text-neutral-400">Password (min 6 chars)</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-white outline-none focus:border-neutral-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded bg-white text-black font-medium disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Sign up'}
        </button>

        <p className="text-sm text-neutral-500 text-center">
          Have an account?{' '}
          <Link href="/login" className="text-white underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
