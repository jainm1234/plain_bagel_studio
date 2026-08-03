import Link from "next/link";

export default function Header() {
  return (
    <>
      <Link href="/" className="logo">
        plain bagel studios
      </Link>
      <nav className="nav">
        <Link href="/work-bench">work bench</Link>
        <Link href="/publication">publication</Link>
        <Link href="/about">about</Link>
        <a href="mailto:malvika.jain@icloud.com">contact us</a>
      </nav>
    </>
  );
}
