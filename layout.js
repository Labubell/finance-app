export const metadata = {
  title: 'บัญชีส่วนตัว',
  description: 'Personal Finance Tracker',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=Kanit:wght@300;600;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
