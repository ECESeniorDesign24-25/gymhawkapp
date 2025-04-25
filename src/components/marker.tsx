import React, { useState, useEffect } from 'react';
import { CustomMarker } from '@/interfaces/marker';
import { imageStyle } from '@/styles/markerStyles';
import { formatState } from '@/utils/common';
import { markerStyle, enhancedPopupStyle } from '@/styles/markerStyles';
import { formatLastUsedTime } from '@/utils/time_utils';
import { statusStrToEnum, Status, StateColor } from '@/enums/state';

export const Marker = ({ lat, lng, state, machine, thing_id, machine_type, floor, last_used_time, device_status }: CustomMarker) => {

  // convert lat and lng to numbers
  const numLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const numLng = typeof lng === 'string' ? parseFloat(lng) : lng;
  
  // check if lat and lng are valid
  if (numLat === null || numLat === undefined || isNaN(numLat) || numLat === 0 || 
      numLng === null || numLng === undefined || isNaN(numLng) || numLng === 0) {
    return null;
  }

  // convert device_status to enum
  const status = statusStrToEnum(device_status);

  // set background color based on status
  let backgroundColor;
  if (status === Status.OFFLINE || status === Status.UNKNOWN) {
    backgroundColor = StateColor.OFFLINE; 
  } else if (state === "on") {
    backgroundColor = StateColor.IN_USE;
  } else {
    backgroundColor = StateColor.AVAILABLE;
  }

  // set custom marker style
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
