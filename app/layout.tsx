import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KOC Goveoai — AI Image & Video Generator',
  description: 'Tạo ảnh AI 4K và video cinematic miễn phí với Nano Banana 2 & Veo 3.1. Công cụ AI sáng tạo nội dung cho KOC, Affiliate & Seller.',
  keywords: 'AI image generator, AI video generator, KOC, affiliate, Goveoai, Nano Banana, Veo 3.1',
  openGraph: {
    title: 'KOC Goveoai — AI Image & Video Generator',
    description: 'Tạo ảnh AI 4K và video cinematic miễn phí',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <div className="bg-animated" />
        {children}
      </body>
    </html>
  );
}
