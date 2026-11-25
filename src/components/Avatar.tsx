import React, { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-9 h-9 text-xs';

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  if (!src || failed) {
    return (
      <div
        className={`${dims} rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold flex items-center justify-center shrink-0 select-none`}
        aria-label={name}
      >
        {initials || 'U'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dims} rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100`}
    />
  );
}
