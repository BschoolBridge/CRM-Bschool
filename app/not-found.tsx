import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container py-5">
      <h1>Page not found</h1>
      <p>That address is not part of Bschool Bridge.</p>
      <Link href="/">Back to login</Link>
    </main>
  );
}
