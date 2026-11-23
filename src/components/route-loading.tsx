export function RouteLoading({ label }: { label: string }) {
  return (
    <section className="content" aria-busy="true" aria-live="polite">
      <div className="container-fluid">
        <div className="card">
          <div className="card-body">
            <p className="text-muted mb-0">{label}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
