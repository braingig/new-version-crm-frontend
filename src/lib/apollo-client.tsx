'use client';

import { ApolloClient, InMemoryCache, createHttpLink, ApolloProvider as Provider, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { fromPromise } from '@apollo/client/link/utils';
import { REFRESH_TOKEN } from './graphql/queries';

const httpLink = createHttpLink({
    uri: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql',
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeToRefresh = (callback: (token: string) => void) => {
    refreshSubscribers.push(callback);
};

const onRefreshed = (token: string) => {
    refreshSubscribers.forEach(callback => callback(token));
    refreshSubscribers = [];
};

const getNewToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: `
                mutation RefreshToken($refreshToken: String!) {
                    refreshToken(refreshToken: $refreshToken) {
                        accessToken
                        refreshToken
                    }
                }
            `,
            variables: { refreshToken },
        }),
    });

    const result = await response.json();
    
    if (result.errors) {
        throw new Error('Failed to refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } = result.data.refreshToken;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    
    return accessToken;
};

const errorLink = onError(({ graphQLErrors, operation, forward }) => {
    if (graphQLErrors) {
        for (const err of graphQLErrors) {
            if (err.extensions?.code === 'UNAUTHENTICATED' || err.message.includes('Unauthorized')) {
                if (!isRefreshing) {
                    isRefreshing = true;
                    
                    fromPromise(
                        getNewToken()
                            .catch(() => {
                                localStorage.removeItem('accessToken');
                                localStorage.removeItem('refreshToken');
                                window.location.href = '/login';
                                return null;
                            })
                            .finally(() => {
                                isRefreshing = false;
                            })
                    ).subscribe({
                        next: (newToken) => {
                            if (newToken) {
                                onRefreshed(newToken);
                            }
                        },
                    });
                }

                return fromPromise(
                    new Promise<string>((resolve) => {
                        subscribeToRefresh((token) => {
                            resolve(token);
                        });
                    })
                ).flatMap((token) => {
                    const oldHeaders = operation.getContext().headers;
                    operation.setContext({
                        headers: {
                            ...oldHeaders,
                            authorization: `Bearer ${token}`,
                        },
                    });
                    return forward(operation);
                });
            }
        }
    }
});

const authLink = setContext((_, { headers }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : '',
        },
    };
});

const client = new ApolloClient({
    link: from([errorLink, authLink.concat(httpLink)]),
    cache: new InMemoryCache(),
});

export function ApolloProvider({ children }: { children: React.ReactNode }) {
    return <Provider client={client}>{children}</Provider>;
}

export { client };
