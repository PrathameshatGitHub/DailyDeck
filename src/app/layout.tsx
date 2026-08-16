import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DailyDeck',
  description: 'Personal task and notes tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-white">{children}</body>
    </html>
  );
}
