import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import { AuthProvider } from '../components/AuthContext';
import { ClientShell } from '../components/ClientShell';

export const metadata: Metadata = {
  title: 'Calyvia Wellness Center | Clinic Management System',
  description: 'Enterprise HMIS/EMR & Administration Portal for Calyvia Wellness Center, Ruiru, Kenya',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Calyvia',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/calyvia-emblem-light.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/brand/calyvia-emblem-light.svg', type: 'image/svg+xml' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-background text-foreground min-h-screen antialiased flex flex-col font-sans transition-colors duration-200">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('calyvia_theme');
                if (t === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}
            `,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            {children}
            <ClientShell />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
