const UnisPauseButton = () => (
  // Use the same explicit width/height and viewBox for consistent scaling
  <svg 
    width="40px" 
    height="40px" 
    viewBox="0 0 100 100" 
    xmlns="http://www.w3.org/2000/svg"
    // Use the same class name for CSS to apply identical sizing/hover effects
    className="unis-play-button-icon"
  >
    {/* 1. The main circle background in $unis-blue (#163387) */}
    {/* Matched the style attribute you used in the play button */}
    <circle 
      cx="50" 
      cy="50" 
      r="48" 
      fill="#163387" 
      style={{color: "silver"}} 
    />
    
    {/* 2. The pause bars (two vertical lines) in white for contrast */}
    
    {/* First pause bar: 10 units wide, 40 units tall */}
    <rect 
      x="35" // Positioned slightly left of center
      y="30" 
      width="10" 
      height="40" 
      fill="silver" // White inner color
    />
    
    {/* Second pause bar: 10 units wide, 40 units tall */}
    <rect 
      x="55" // Positioned slightly right of center, creating a 10 unit gap
      y="30" 
      width="10" 
      height="40" 
      fill="silver" 
    />
  </svg>
);

export default UnisPauseButton;