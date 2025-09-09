export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-wide">{title}</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      {description && <p className="text-sm text-muted-foreground -mt-2">{description}</p>}
      {children}
    </section>
  );
}
