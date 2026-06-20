interface EmptyStateProps {
  message: string;
  description?: string;
}

export default function EmptyState({ message, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-slate-400 font-medium">{message}</p>
      {description && (
        <p className="text-slate-600 text-sm mt-1">{description}</p>
      )}
    </div>
  );
}
