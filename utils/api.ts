import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export const API_BASE: string = (import.meta as any).env?.VITE_API_BASE_URL || '';

/**
 * fetch() against our Node API with the Clerk session token attached.
 * The server verifies the token (see server/index.js `requireAuth`).
 */
export function useApi() {
    const { getToken } = useAuth();

    return useCallback(
        async (path: string, init: RequestInit = {}): Promise<Response> => {
            const token = await getToken();
            const headers = new Headers(init.headers);
            if (init.body && !headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }
            if (token) headers.set('Authorization', `Bearer ${token}`);
            return fetch(`${API_BASE}${path}`, { ...init, headers });
        },
        [getToken]
    );
}
