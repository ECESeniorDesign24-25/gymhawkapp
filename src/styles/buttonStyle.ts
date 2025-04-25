export const buttonStyle = {
    padding: '5px 10px', 
    borderRadius: '4px', 
    border: '1px solid #ccc',
    backgroundColor: '#5a5a5a',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#3a3a3a',
      transform: 'translateY(-1px)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }
  };
  
  export const todaySelectedStyle = {
    ...buttonStyle,
    backgroundColor: '#2a7aba',
    fontWeight: 'bold' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  };
  
  // CSS for button hover effects
  export const buttonHoverStyles = `
    .date-button:hover {
      background-color: #3a3a3a !important;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .date-button:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    .date-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  `;