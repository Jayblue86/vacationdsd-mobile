type Props = {
  role: string;
  size?: 'sm' | 'md';
};

export function RoleBadge({ role, size = 'sm' }: Props) {
  const isReliever = role === 'reliever';
  const label = isReliever ? 'R' : 'V';
  const title = isReliever ? 'Reliever' : 'Vendor';
  const sizeClasses = size === 'md' ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[10px]';
  const colors = isReliever
    ? 'bg-amber-100 text-amber-700 border-amber-300'
    : 'bg-blue-100 text-blue-700 border-blue-300';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-bold ${sizeClasses} ${colors}`}
      title={title}
    >
      {label}
    </span>
  );
}
