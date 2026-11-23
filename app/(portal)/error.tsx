"use client";

import Link from "next/link";

export default function PortalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <section className="content">
      <div className="container-fluid">
        <div className="card">
          <div className="card-body">
            <h1 className="h4">This page could not be loaded</h1>
            <p>Try again. If it keeps failing, go back to your home page.</p>
            <button className="btn btn-primary mr-2" type="button" onClick={() => retry()}>
              Try again
            </button>
            <Link className="btn btn-default" href="/">
              Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
