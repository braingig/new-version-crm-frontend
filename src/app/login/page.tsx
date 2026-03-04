'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { LOGIN_MUTATION } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const [login, { loading }] = useMutation(LOGIN_MUTATION, {
        onCompleted: (data) => {
            const { accessToken, refreshToken, user } = data.login;
            setAuth(user, accessToken, refreshToken);
            if (typeof window !== 'undefined' && (window as any).electron) {
                (window as any).electron.saveToken(accessToken);
            }
            router.push('/dashboard');
        },
        onError: (error) => {
            setError(error.message);
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        await login({ variables: { email, password } });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        Welcome Back
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Sign in to your account to continue
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="label">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="label">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 text-lg"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                        <p>Demo Credentials:</p>
                        <p className="mt-2">Admin: admin@example.com / admin123</p>
                        <p>Developer: developer@example.com / dev123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
