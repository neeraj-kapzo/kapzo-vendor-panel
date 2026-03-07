import type { Metadata } from 'next'
import { DM_Sans, Sora } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kapzo Vendor Panel',
  description: 'Pharmacy management portal for Kapzo medicine delivery platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${sora.variable}`}>
      <body className="font-sans antialiased bg-white text-[#022135]">
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
