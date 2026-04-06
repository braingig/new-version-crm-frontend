/** Base URL for REST routes (global prefix `api`). GraphQL URL is often `.../graphql`. */
export function getRestApiBaseUrl(): string {
    const graphql =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    return graphql.replace(/\/graphql\/?$/, '');
}
