import React, { useState } from 'react';

export default function Avatar({ src, name, size = 32, className = '' }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || 'User').trim().charAt(0).toUpperCase();

  if (!src || broken) {
    return (
      <div
        className={`rounded-full border-2 border-black dark:border-white flex items-center justify-center text-xs ${className}`}
        style={{ width: size, height: size }}
        aria-label={name || 'User'}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'User'}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`rounded-full border-2 border-black dark:border-white object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
