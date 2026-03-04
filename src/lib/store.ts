import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    _hasHydrated: boolean;
    setAuth: (user: User, accessToken: string, refreshToken: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                user: null,
                accessToken: null,
                refreshToken: null,
                _hasHydrated: false,
                setAuth: (user, accessToken, refreshToken) => {
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', refreshToken);
                    set({ user, accessToken, refreshToken });
                },
                logout: () => {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    set({ user: null, accessToken: null, refreshToken: null });
                },
            }),
            {
                name: 'auth-storage',
                storage: createJSONStorage(() => localStorage),
                onRehydrateStorage: () => (state) => {
                    if (state) {
                        state._hasHydrated = true;
                    }
                },
            }
        )
    )
);

export const useAuth = () => {
    const auth = useAuthStore();
    
    return {
        ...auth,
        isAuthenticated: !!(auth.user && auth.accessToken && auth.refreshToken),
        hasHydrated: auth._hasHydrated,
    };
};
