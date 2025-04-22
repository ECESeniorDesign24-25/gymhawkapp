import React, { useState } from 'react';
import { CustomMarker } from '@/interfaces/marker';
import { markerStyle, imageStyle, popupStyle } from '@/styles/markerStyles';

// marker for device on map
export const Marker = ({ lat, lng, state, machine, thing_id }: CustomMarker) => {
  let backgroundColor = 'grey';
  if (state === "on") {
    backgroundColor = 'red';
  } else if (state === "off") {
    backgroundColor = 'green';
  }

  const [showPopup, setShowPopup] = useState(false);

  const handleClick = () => {
    localStorage.setItem("lastMachine", JSON.stringify({ thing_id: thing_id, machine: machine }));
    window.location.href = "/analytics";
  }
  
  // Create a new style object with the dynamic backgroundColor
  const dynamicMarkerStyle = {
    ...markerStyle,
    backgroundColor
  };
  
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
      <div style={dynamicMarkerStyle} onClick={handleClick}>
        <img src="/gym-icon.webp" alt="Marker" style={imageStyle}/>
      </div>
      {showPopup && (
        <div style={popupStyle}>
          {machine}
        </div>
      )}
    </div>
  );
};
