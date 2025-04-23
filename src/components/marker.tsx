import React, { useState, useEffect } from 'react';
import { CustomMarker } from '@/interfaces/marker';
import { markerStyle, imageStyle, popupStyle } from '@/styles/markerStyles';
import { formatState } from '@/utils/common';
import { dynamicMarkerStyle, enhancedPopupStyle } from '@/styles/markerStyles';

export const Marker = ({ lat, lng, state, machine, thing_id }: CustomMarker) => {
  // Ensure lat and lng are valid numbers
  const numLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const numLng = typeof lng === 'string' ? parseFloat(lng) : lng;
  
  // More rigorous validation - check for NaN, 0, null, undefined
  if (numLat === null || numLat === undefined || isNaN(numLat) || numLat === 0 || 
      numLng === null || numLng === undefined || isNaN(numLng) || numLng === 0) {
    console.log(`Skipping invalid marker for ${machine}: lat=${lat}, lng=${lng}`);
    return null;
  }
  
  // Log valid coordinates to confirm they're being used
  console.log(`Rendering marker at: lat=${numLat}, lng=${numLng} for ${machine}`);
  
  let backgroundColor = 'grey';
  if (state === "on") {
    backgroundColor = 'red';
  } else if (state === "off") {
    backgroundColor = 'green';
  }

  const [showPopup, setShowPopup] = useState(false);
  const [formattedStateValue, setFormattedStateValue] = useState('Loading...');

  useEffect(() => {
    let isMounted = true;
    
    async function loadFormattedState() {
      try {
        const formatted = await formatState(state);
        if (isMounted) {
          setFormattedStateValue(formatted || 'N/A');
        }
      } catch (error) {
        console.error('Error formatting state:', error);
        if (isMounted) {
          setFormattedStateValue('Error');
        }
      }
    }
    
    loadFormattedState();
    
    return () => {
      isMounted = false;
    };
  }, [state]);

  const handleClick = () => {
    localStorage.setItem("lastMachine", JSON.stringify({ thing_id: thing_id, machine: machine }));
    window.location.href = "/analytics";
  }

  // Format coordinates to 6 decimal places for readability
  const formattedLat = numLat ? numLat.toFixed(6) : 0;
  const formattedLng = numLng ? numLng.toFixed(6) : 0;
  
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
      <div style={dynamicMarkerStyle(backgroundColor)} onClick={handleClick}>
        <img src="/gym-icon.webp" alt="Marker" style={imageStyle}/>
      </div>  
      {showPopup && (
        <div style={enhancedPopupStyle}>
          <div><strong>{machine}</strong></div>
          <div>Lat: {formattedLat}</div>
          <div>Lng: {formattedLng}</div>
          <div>State: {formattedStateValue}</div>
        </div>
      )}
    </div>
  );
};
