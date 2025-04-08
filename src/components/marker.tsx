import React, { useState } from 'react';
import {redirect} from "next/navigation";
import { normalizeState } from '@/utils/db';

interface MachineMarkerProps {
    lat: number;
    lng: number;
    state: string;
    machine: string;
    thing_id: string;
}

// marker for device on map
export const MachineMarker = ({ lat, lng, state, machine, thing_id }: MachineMarkerProps) => {
  const normalizedState = normalizeState(state);
  let backgroundColor = 'grey';
  if (normalizedState === "on") {
    backgroundColor = 'red';
  } else if (normalizedState === "off") {
    backgroundColor = 'green';
  }
  
  const markerStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    backgroundColor,
    borderRadius: '50%',
    border: '2px solid white',
    textAlign: 'center',
    color: 'white',
    fontSize: '12px',
    lineHeight: '24px',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const imageStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    objectFit: 'cover'
  };

  const popupStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '120%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'white',
    padding: '4px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    zIndex: 10,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.3)'
  };

  const [showPopup, setShowPopup] = useState(false);

  const handleClick = () => {
    localStorage.setItem("lastMachine", JSON.stringify({ thing_id: thing_id, machine: machine }));
    window.location.href = "/analytics";
  }
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
      <div style={markerStyle} onClick={handleClick}>
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
