import './globals.css';

export const metadata = {
  title: 'Portal do Colaborador',
  description: 'Solicitações e comunicados de RH/DP',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
