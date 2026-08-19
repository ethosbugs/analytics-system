export const metadata = {
  title: "Sistema de Analítica",
  description: "Panel de control de analítica web",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}