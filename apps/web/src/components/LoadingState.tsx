interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({ label = 'Carregando...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-[#CCE4F4] border-t-[#2A658F] rounded-full animate-spin" />
      <p className="mt-4 text-sm text-[#2A658F]">{label}</p>
    </div>
  );
}
