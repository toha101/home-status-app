import './globals.css';

export const metadata = {
  title: "Who's home",
  description: 'Household status — home or away, day by day.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
