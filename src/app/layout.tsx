import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ApolloProvider } from '@/lib/apollo-client'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Remote Team Management',
    description: 'Comprehensive remote team and project management system',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <ApolloProvider>{children}</ApolloProvider>
            </body>
        </html>
    )
}
