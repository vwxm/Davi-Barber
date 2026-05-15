import './globals.css';

export const metadata = {
  title: 'Davi Barber | Agendamento',
  description: 'Sistema de agendamento inteligente para barbearia'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
