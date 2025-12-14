

const UnisPlayButton = () => (
  <svg 
    width="40px" 
    height="40px" 
    viewBox="0 0 100 100" 
    xmlns="http://www.w3.org/2000/svg"
    // Apply CSS class for easy targeting/sizing in your SCSS
    className="unis-play-button-icon"
  >
    {/* 1. The main circle background in $unis-blue (#163387) */}
    <circle 
      cx="50" 
      cy="50" 
      r="48" 
      fill="#163387" 
      style={{color: "silver"}}
    />
    
    {/* 2. The play icon (triangle) in white for contrast */}
    {/* The points define an equilateral triangle centered in the circle */}
    <path 
      d="M38 30 L70 50 L38 70 Z" 
      fill="#transparent" 
    />
    
    {/* Note: I slightly adjusted the triangle position (M38) to visually center it, 
         as a perfect geometric center can sometimes look off-center to the eye. */}
  </svg>
);

export default UnisPlayButton;