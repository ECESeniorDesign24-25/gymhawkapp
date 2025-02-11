export const HOME_STYLE = {
    control: (provided: any) => ({
      ...provided,
      backgroundColor: 'transparent',
      border: '1px solid black',
      boxShadow: 'none',
      color: 'black',
    }),
    singleValue: (provided: any) => ({
      ...provided,
      color: 'black',
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: 'rgba(0,0,0,0.5)',
    }),
    input: (provided: any) => ({
      ...provided,
      color: 'black',
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: '#f3f4f6',
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#e5e7eb' : 'transparent',
      color: 'black',
      cursor: 'pointer',
    }),
};

export const ZOOM_LEVEL = 22

/* 
    dark mode taken from: 
    https://developers.google.com/maps/documentation/javascript/examples/style-array#maps_style_array-typescript 
*/
export const DARK_MAP_THEME = {
    center: { lat: 40.674, lng: -73.945 },
    zoom: ZOOM_LEVEL,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
      },
      {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
      },
    ],
  }