export default function ModulePlaceholder({
  index,
  label,
  icon,
}: {
  index: number;
  label: string;
  icon: string;
}) {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <div className="rounded-card border border-border bg-card px-10 py-8 text-center">
        <div className="mb-3 text-4xl">{icon}</div>
        <div className="text-lg font-medium text-text-primary">
          Module {index} — {label}
        </div>
        <div className="mt-1 text-sm text-text-secondary">en construction</div>
      </div>
    </div>
  );
}
