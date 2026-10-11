import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Frame — Financial control plane for AI agents',
  description: 'Programmable payment authority for autonomous AI agents. Intent-bound payments, policy firewall, human approval. Build AI that spends responsibly.',
  keywords: 'AI agents, payment infrastructure, policy firewall, autonomous payments, MCP',
  openGraph: {
    title: 'Frame — Financial control plane for AI agents',
    description: 'Programmable payment authority for autonomous AI agents.',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
