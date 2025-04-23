import React, { useState, useEffect } from 'react';
import { CustomMarker } from '@/interfaces/marker';
import { imageStyle } from '@/styles/markerStyles';
import { formatState } from '@/utils/common';
import { markerStyle, enhancedPopupStyle } from '@/styles/markerStyles';
import { formatLastUsedTime } from '@/utils/time_utils';

export const Marker = ({ lat, lng, state, machine, thing_id, machine_type, floor, last_used_time, device_status }: CustomMarker) => {
  const numLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const numLng = typeof lng === 'string' ? parseFloat(lng) : lng;
  
  if (numLat === null || numLat === undefined || isNaN(numLat) || numLat === 0 || 
      numLng === null || numLng === undefined || isNaN(numLng) || numLng === 0) {
    return null;
  }

  // set background color based on status
  let backgroundColor;
  if (device_status === "OFFLINE" || device_status === "UNKNOWN") {
    
    // offline/unknown = gray
    backgroundColor = 'rgba(128, 128, 128, 0.75)'; 
  } else if (state === "on") {
   
    // in use = red
    backgroundColor = 'rgba(139, 0, 0, 0.75)';
  } else {
    
    // available = green
    backgroundColor = 'rgba(0, 100, 0, 0.75)'; 
  }


  const customMarkerStyle = {
    ...markerStyle,
    backgroundColor: backgroundColor
  };

  const [showPopup, setShowPopup] = useState(false);
  const [formattedStateValue, setFormattedStateValue] = useState('Loading...');

  // format the current state of each machine
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

  // handle click on marker - take right to analytics page
  const handleClick = () => {
    localStorage.setItem("lastMachine", JSON.stringify({ thing_id: thing_id, machine: machine }));
    window.location.href = "/analytics";
  }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
      <div style={customMarkerStyle} onClick={handleClick}>
        <img src="/gym-icon.webp" alt="Marker" style={imageStyle}/>
      </div>  
      {showPopup && (
        <div style={enhancedPopupStyle}>
          <div><strong>{machine_type || 'Unknown Type'}</strong></div>
          <div>State: {formattedStateValue}</div>
          {device_status !== "ONLINE" && <div>Status: {device_status || 'UNKNOWN'}</div>}
          <div>Floor: {floor}</div>
          <div>Last Used: {formatLastUsedTime(last_used_time)}</div>
        </div>
      )}
    </div>
  );
};
