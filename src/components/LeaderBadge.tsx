type Props = {
  size?: 'sm' | 'md';
};

export function LeaderBadge({ size = 'sm' }: Props) {
  const sizeClasses = size === 'md' ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[10px]';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-bold ${sizeClasses} bg-amber-100 text-amber-700 border-amber-300`}
      title="Leader"
    >
      L
    </span>
  );
}
