interface EmptyStateProps {
  title: string;
  description?: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-lg font-semibold text-[#27273D]">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          {description}
        </p>
      )}
    </div>
  );
}
