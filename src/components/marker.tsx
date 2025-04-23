import React, { useState, useEffect } from 'react';
import { CustomMarker } from '@/interfaces/marker';
import { imageStyle } from '@/styles/markerStyles';
import { formatState } from '@/utils/common';
import { dynamicMarkerStyle, enhancedPopupStyle } from '@/styles/markerStyles';

export const Marker = ({ lat, lng, state, machine, thing_id, machine_type, floor }: CustomMarker) => {
  const numLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const numLng = typeof lng === 'string' ? parseFloat(lng) : lng;
  
  if (numLat === null || numLat === undefined || isNaN(numLat) || numLat === 0 || 
      numLng === null || numLng === undefined || isNaN(numLng) || numLng === 0) {
    return null;
  }
  
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

  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
      <div style={dynamicMarkerStyle(backgroundColor)} onClick={handleClick}>
        <img src="/gym-icon.webp" alt="Marker" style={imageStyle}/>
      </div>  
      {showPopup && (
        <div style={enhancedPopupStyle}>
          <div><strong>{machine_type}</strong></div>
          <div>State: {formattedStateValue}</div>
          <div>Floor: {floor}</div>
        </div>
      )}
    </div>
  );
};
