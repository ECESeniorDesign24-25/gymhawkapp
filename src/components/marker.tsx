interface MachineMarkerProps {
    lat: number;
    lng: number;
    state: string;
    machine: string;
}

export const MachineMarker = ({ lat, lng, state, machine }: MachineMarkerProps) => {
    let backgroundColor = 'grey';
    if (state === "off") {
      backgroundColor = 'red';
    } else if (state === "on") {
      backgroundColor = 'green';
    }
    const markerStyle: React.CSSProperties = {
      width: '20px',
      height: '20px',
      backgroundColor,
      borderRadius: '50%',
      border: '2px solid white',
      textAlign: 'center',
      color: 'white',
      fontSize: '12px',
      lineHeight: '20px'
    };
  
    return <div style={markerStyle}>{machine}</div>;
  };