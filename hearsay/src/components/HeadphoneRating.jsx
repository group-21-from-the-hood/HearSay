import { useState } from 'react';

export default function HeadphoneRating({ value = 0, onChange, size = 'large' }) {
  const [hoverValue, setHoverValue] = useState(null);
  
  // If a rating is selected (value > 0), don't show hover preview
  // If no rating selected (value === 0), show hover preview
  const headphoneDisplayValue = value > 0 ? value : (hoverValue !== null ? hoverValue : value);
  const boxDisplayValue = value > 0 ? value : (hoverValue !== null ? hoverValue : value);
  
  const sizeClasses = {
    small: 'w-5 h-5',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const boxSizeClasses = {
    small: 'text-xs px-2 py-1 min-w-[2.5rem]',
    medium: 'text-sm px-3 py-1 min-w-[3rem]',
    large: 'text-base px-4 py-2 min-w-[3.5rem]'
  };

  // Determine box styling based on whether a rating has been selected
  const boxColorClasses = value > 0
    ? 'bg-white dark:bg-gray-900 text-black dark:text-white'
    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400';

  const handleClick = (rating) => {
    onChange?.(rating);
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
    <div className="flex items-center gap-3 w-full">
      <div className="flex gap-2" onMouseLeave={handleMouseLeave}>
        {[0, 1, 2, 3, 4].map((index) => {
          const rating = index + 1;
          
          return (
            <div
              key={index}
              className={`${sizeClasses[size]} cursor-pointer`}
              onMouseMove={(e) => handleMouseMove(index, e)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const isLeftHalf = x < rect.width / 2;
                handleClick(rating - (isLeftHalf ? 0.5 : 0));
              }}
            >
              <HeadphoneIcon rating={rating} />
            </div>
          );
        })}
      </div>

      {/* Rating Display Box */}
      <div className={`border-2 border-black dark:border-white ${boxColorClasses} ${boxSizeClasses[size]} font-medium text-center ml-auto`}>
        {Number(boxDisplayValue).toFixed(1)}/5
      </div>
    </div>
  );
}
