export const markerStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    backgroundColor: 'grey',
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

export const imageStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    objectFit: 'cover'
  };

export const popupStyle: React.CSSProperties = {
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