import '@/styles/globals.css'
import Link from 'next/link'
export default function MyApp({ Component, pageProps }) {
  return (<>
    <header className="container">
      <nav><div className="logo">Launch6</div></nav>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/faq">FAQ</Link>
        <a className="button" href="/dashboard/new">Create your page</a>
      </nav>
    </header>
    <Component {...pageProps} />
  </>);
}
