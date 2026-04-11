import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'tippy.js/dist/tippy.css'
import './globals.css'
import { ApolloProvider } from '@/lib/apollo-client'
import SessionExpiryHandler from '@/components/SessionExpiryHandler'
import { ToastProvider } from '@/components/ToastProvider'

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
                <ApolloProvider>
                    <ToastProvider>
                        <SessionExpiryHandler />
                        {children}
                    </ToastProvider>
                </ApolloProvider>
            </body>
        </html>
    )
}
