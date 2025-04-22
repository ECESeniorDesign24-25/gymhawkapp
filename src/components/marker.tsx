import React, { useState, useEffect } from 'react';
import { CustomMarker } from '@/interfaces/marker';
import { markerStyle, imageStyle, popupStyle } from '@/styles/markerStyles';
import { formatState } from '@/utils/common';
// marker for device on map
export const Marker = ({ lat, lng, state, machine, thing_id }: CustomMarker) => {
  let backgroundColor = 'grey';
  if (state === "on") {
    backgroundColor = 'red';
  } else if (state === "off") {
    backgroundColor = 'green';
  }

  const [showPopup, setShowPopup] = useState(false);
  const [formattedStateValue, setFormattedStateValue] = useState('Loading...');

  // Handle async formatState function
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
  
  // Create a new style object with the dynamic backgroundColor
  const dynamicMarkerStyle = {
    ...markerStyle,
    backgroundColor
  };
  
  // Enhanced popup style with more width for multiple lines
  const enhancedPopupStyle = {
    ...popupStyle,
    width: 'auto',
    minWidth: '120px',
    whiteSpace: 'normal',
    textAlign: 'left' as const
  };

  // Format coordinates to 6 decimal places for readability
  const formattedLat = lat ? lat.toFixed(6) : 'N/A';
  const formattedLng = lng ? lng.toFixed(6) : 'N/A';
  
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
      <div style={dynamicMarkerStyle} onClick={handleClick}>
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
