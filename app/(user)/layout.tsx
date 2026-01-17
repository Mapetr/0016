export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className={"mx-auto w-full max-w-5xl"}>{children}</main>;
}
