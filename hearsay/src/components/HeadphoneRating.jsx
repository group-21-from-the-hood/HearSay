import { useState } from 'react';

export default function HeadphoneRating({ value = 0, onChange, size = 'large', showBox, compact = false, boxSizeOverride, stackOnSmall = false }) {
  const [hoverValue, setHoverValue] = useState(null);
  
  // If a rating is selected (value > 0), don't show hover preview
  // If no rating selected (value === 0), show hover preview
  const headphoneDisplayValue = value > 0 ? value : (hoverValue !== null ? hoverValue : value);
  const boxDisplayValue = value > 0 ? value : (hoverValue !== null ? hoverValue : value);
  
  const sizeClasses = {
    // very compact small variant
    small: 'w-3 h-3',
    medium: 'w-7 h-7',
    large: 'w-10 h-10'
  };

  // numeric box sizes (uniform padding + rounded corners so previews scale predictably)
  const boxSizeClasses = {
    // small used for track-level compact previews (slightly larger than icon size)
    small: 'text-sm px-2 py-1 min-w-[2rem] max-w-[3rem] rounded',
    // medium for in-context album/song controls
    medium: 'text-base px-3 py-1.5 min-w-[2.5rem] max-w-[3.5rem] rounded',
    // large used for forced album-level preview (readable + roomy)
    large: 'text-lg px-4 py-2 min-w-[3rem] max-w-[6rem] rounded'
  };

  // When compact preview is requested for track list, use a slightly larger compact class
  // to keep the number readable while remaining visually compact.
  const compactSmallBoxClass = 'text-base px-3 py-1.5 min-w-[2.5rem] max-w-[3.5rem] font-semibold rounded';

  // Determine box styling based on whether a rating has been selected
  const boxColorClasses = value > 0
    ? 'bg-white dark:bg-gray-900 text-black dark:text-white'
    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400';

  const handleClick = (rating) => {
    onChange?.(rating);
  };

  const handleKey = (rating, event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(rating);
    }
  };

  const handleMouseMove = (index, event) => {
    // Only allow hover preview if no rating has been selected yet
    if (value === 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const isLeftHalf = x < rect.width / 2;
      const newValue = index + (isLeftHalf ? 0.5 : 1);
      setHoverValue(newValue);
    }
  };

  const handleMouseLeave = () => {
    // Only clear hover if no rating is selected
    if (value === 0) {
      setHoverValue(null);
    }
  };

  const HeadphoneIcon = ({ rating }) => {
    const isFull = headphoneDisplayValue >= rating;
    const isHalf = headphoneDisplayValue === rating - 0.5;

    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="transition-colors w-full h-full"
      >
        {/* Headband */}
        <path 
          d="M3 18v-6a9 9 0 0 1 18 0v6" 
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={isFull || isHalf ? 'text-black dark:text-white' : 'text-gray-300 dark:text-gray-600'}
        />
        {/* Left ear cup */}
        <path
          d="M3 18a3 3 0 0 0 3 3h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3z"
          fill={isFull || isHalf ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isFull || isHalf ? 'text-black dark:text-white' : 'text-gray-300 dark:text-gray-600'}
        />
        {/* Right ear cup */}
        <path
          d="M21 18a3 3 0 0 1-3 3h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1a3 3 0 0 1 3 3z"
          fill={isFull ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isFull || isHalf ? 'text-black dark:text-white' : 'text-gray-300 dark:text-gray-600'}
        />
      </svg>
    );
  };

  return (
    // Keep outer container flexible; optionally stack icons above the numeric box on small screens
    <div
      className={`flex ${stackOnSmall ? 'flex-col sm:flex-row items-center' : 'items-center'} gap-1 w-full`}
      role="group"
      aria-label={`Rating control, current ${Number(boxDisplayValue).toFixed(1)} out of 5`}
    >
      {/* headphone icons: extremely tight gap, no grow so control stays compact */}
      <div className="flex gap-0.5 items-center flex-shrink-0" onMouseLeave={handleMouseLeave}>
        {[0, 1, 2, 3, 4].map((index) => {
          const rating = index + 1;
          
          return (
            <button
              key={index}
              type="button"
              aria-label={`Rate ${rating} ${rating === 1 ? 'star' : 'stars'}`}
              // override global min-width with min-w-0 so these can compress on narrow screens
              className={`${sizeClasses[size]} cursor-pointer flex items-center justify-center min-w-0 p-0`}
              onMouseMove={(e) => handleMouseMove(index, e)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const isLeftHalf = x < rect.width / 2;
                handleClick(rating - (isLeftHalf ? 0.5 : 0));
              }}
              onKeyDown={(e) => handleKey(rating, e)}
            >
              <HeadphoneIcon rating={rating} />
            </button>
          );
        })}
      </div>

      {/* Rating Display Box: hide for the very compact small variant to save space */}
      {/*
        Show the numeric box if:
        - caller explicitly set showBox === true OR
        - showBox is not false and size is not 'small' (preserve previous default behavior)
      */}
      {((showBox === true) || (showBox !== false && size !== 'small')) && (
        (() => {
          // choose which box size key to use: override if provided, else default by size
          const chosenBoxSize = boxSizeOverride && boxSizeClasses[boxSizeOverride] ? boxSizeOverride : size;
          const isForcedLarge = boxSizeOverride === 'large';
          const boxClassBase = (compact && size === 'small') ? compactSmallBoxClass : boxSizeClasses[chosenBoxSize];

          // If caller explicitly requests a larger preview (boxSizeOverride === 'large'),
          // allow the box to expand and prevent truncation / ellipsis.
          const expandModifiers = isForcedLarge ? 'max-w-none whitespace-nowrap' : 'truncate';

          return (
            <div
              // use inline-flex so padding is applied uniformly and content is centered
              className={`border-2 border-black dark:border-white ${boxColorClasses} ${boxClassBase} ${expandModifiers} font-medium ml-auto flex-shrink-0 inline-flex items-center justify-center`}
              style={{ lineHeight: 1 }}
              aria-hidden="true"
              title={compact ? `${Number(boxDisplayValue).toFixed(1)}` : `${Number(boxDisplayValue).toFixed(1)}/5`}
            >
              <span className={`${isForcedLarge ? 'whitespace-nowrap' : 'truncate'} inline-block`}>
                {compact ? Number(boxDisplayValue).toFixed(1) : `${Number(boxDisplayValue).toFixed(1)}/5`}
              </span>
            </div>
          );
        })()
      )}
    </div>
  );
}
