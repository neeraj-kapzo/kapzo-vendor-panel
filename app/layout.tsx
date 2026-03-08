import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const neulisAlt = localFont({
  src: '../public/fonts/neulisalt-medium.ttf',
  variable: '--font-neulis-alt',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kapzo Vendor Panel',
  description: 'Pharmacy management portal for Kapzo medicine delivery platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={neulisAlt.variable}>
      <body className="font-[family-name:var(--font-neulis-alt)] antialiased bg-white text-[#022135]">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '8px',
              background: '#022135',
              color: '#fff',
              fontSize: '13px',
            },
            success: {
              iconTheme: { primary: '#21A053', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  )
}
