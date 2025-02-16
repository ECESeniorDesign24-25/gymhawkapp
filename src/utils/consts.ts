import { getCoords, getBuildingOutline } from "./mapsAPI";

export const MAPS_API_KEY = process.env.NEXT_PUBLIC_MAPS_API_KEY
export const MAPS_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json'

const building_ids = {
    rec: "ChIJp6ru8-xB5IcRntwQ-Z4Qgj8",
    fitness_east: "ChIJVdzQUfJB5IcR31wO6EpXyms"
}
export const GYMS = [
    {
      value: 'rec',
      label: 'Iowa Campus Recreation and Wellness Center',
      id: building_ids.rec,
      floors: [1, 2, 3],
      coords: await getCoords(building_ids.rec),
      building: await getBuildingOutline(building_ids.rec)
    },
    {
      value: 'fitness_east',
      label: 'Fitness East',
      id: building_ids.fitness_east,
      floors: [1, 2],
      coords: await getCoords(building_ids.fitness_east),
      building: await getBuildingOutline(building_ids.fitness_east)
    },
  ];
