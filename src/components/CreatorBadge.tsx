type Props = {
  variant?: 'light' | 'subtle';
};

export function CreatorBadge({ variant = 'subtle' }: Props) {
  const isLight = variant === 'light';

  return (
    <a
      href="https://www.jaybluecreations.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2.5 rounded-xl transition-all ${
        isLight
          ? 'bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2'
          : 'hover:bg-slate-50 px-2 py-1.5'
      }`}
      title="Built by Jay Blue Creations"
    >
      <img
        src="/images/Jay_Blue_Creations_Image.jpg"
        alt="Jay Blue Creations"
        className="w-7 h-7 rounded-lg object-cover ring-1 ring-black/5"
      />
      <span className={`text-xs font-semibold tracking-wide ${isLight ? 'text-slate-300 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
        Built by <span className={isLight ? 'text-white' : 'text-slate-700'}>Jay Blue Creations</span>
      </span>
    </a>
  );
}
