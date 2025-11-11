import { useState, useEffect, useRef } from 'react';

export default function HeadphoneRating({ value = 0, onChange, size = 'large' }) {
  const [hoverValue, setHoverValue] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef(null);
  
  const displayValue = hoverValue !== null ? hoverValue : value;
  
  const sizeClasses = {
    small: 'w-5 h-5',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const handleClick = (rating) => {
    onChange?.(rating);
    // Hide tooltip immediately after clicking
    setShowTooltip(false);
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleMouseMove = (index, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const isLeftHalf = x < rect.width / 2;
    const newValue = index + (isLeftHalf ? 0.5 : 1);
    setHoverValue(newValue);
    
    // Update tooltip position
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY
    });

    // Clear existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set new timeout to show tooltip after 500ms
    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    setHoverValue(null);
    // Hide tooltip immediately when mouse leaves
    setShowTooltip(false);
    
    // Clear timeout when mouse leaves
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const HeadphoneIcon = ({ rating, index }) => {
    const isFull = displayValue >= rating;
    const isHalf = displayValue === rating - 0.5;

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
    <>
      <div className="flex gap-2 relative" onMouseLeave={handleMouseLeave}>
        {[0, 1, 2, 3, 4].map((index) => {
          const rating = index + 1;
          
          return (
            <div
              key={index}
              className={`${sizeClasses[size]} cursor-pointer relative`}
              onMouseMove={(e) => handleMouseMove(index, e)}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const isLeftHalf = x < rect.width / 2;
                handleClick(rating - (isLeftHalf ? 0.5 : 0));
              }}
            >
              <HeadphoneIcon rating={rating} index={index} />
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {showTooltip && displayValue > 0 && (
        <div
          className="fixed z-50 px-3 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-lg shadow-sm pointer-events-none bg-opacity-80 dark:bg-opacity-80"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y - 40}px`,
            transform: 'translateX(-50%)'
          }}
        >
          {displayValue} / 5
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-black dark:bg-white rotate-45 bg-opacity-80 dark:bg-opacity-80"
          />
        </div>
      )}
    </>
  );
}
