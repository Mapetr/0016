export default function Layout({
                                 children
                               }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className={"mx-auto max-w-3xl"}>
      {children}
    </main>
  )
}