import { useState } from 'react';

export default function HeadphoneRating({ value = 0, onChange, size = 'large' }) {
  const [hoverValue, setHoverValue] = useState(null);
  
  // If a rating is selected (value > 0), don't show hover preview
  // If no rating selected (value === 0), show hover preview
  const headphoneDisplayValue = value > 0 ? value : (hoverValue !== null ? hoverValue : value);
  const boxDisplayValue = value > 0 ? value : (hoverValue !== null ? hoverValue : value);
  
  // Larger icons but tighter visual spacing
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-10 h-10',
    large: 'w-14 h-14'
  };

  const boxSizeClasses = {
    small: 'text-xs px-2 py-1 min-w-[2rem] max-w-[3rem]',
    medium: 'text-sm px-3 py-1 min-w-[2.25rem] max-w-[3.25rem]',
    large: 'text-base px-3 py-2 min-w-[2.5rem] max-w-[4rem]'
  };

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
        className="transition-colors"
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
    <div className="flex items-center gap-2 w-full" role="group" aria-label={`Rating control, current ${Number(boxDisplayValue).toFixed(1)} out of 5`}>
      {/* headphone icons: tighter gap, allow shrink to avoid overflow on small screens */}
      <div className="flex gap-1 items-center" onMouseLeave={handleMouseLeave}>
        {[0, 1, 2, 3, 4].map((index) => {
          const rating = index + 1;
          
          return (
            <button
              key={index}
              type="button"
              aria-label={`Rate ${rating} ${rating === 1 ? 'star' : 'stars'}`}
              // override global min-width with min-w-0 so these can compress on narrow screens
              className={`${sizeClasses[size]} cursor-pointer flex items-center justify-center min-w-0`}
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

      {/* Rating Display Box: responsive, small max width, don't push layout */}
      <div
        className={`border-2 border-black dark:border-white ${boxColorClasses} ${boxSizeClasses[size]} font-medium text-center ml-2 flex-shrink-0 truncate`}
        style={{ lineHeight: 1.2 }}
        aria-hidden="true"
        title={`${Number(boxDisplayValue).toFixed(1)}/5`}
      >
        {Number(boxDisplayValue).toFixed(1)}/5
      </div>
    </div>
  );
}
