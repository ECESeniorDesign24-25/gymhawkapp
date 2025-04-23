import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'medium', 
  color = '#4f46e5', 
  text 
}) => {
  const sizeMap = {
    small: { div: '24px', border: '3px' },
    medium: { div: '40px', border: '4px' },
    large: { div: '56px', border: '5px' }
  };

  const divStyle = {
    width: sizeMap[size].div,
    height: sizeMap[size].div,
    border: `${sizeMap[size].border} solid rgba(0, 0, 0, 0.1)`,
    borderTop: `${sizeMap[size].border} solid ${color}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={divStyle}></div>
      {text && <p className="mt-2 text-gray-600">{text}</p>}
    </div>
  );
}; 