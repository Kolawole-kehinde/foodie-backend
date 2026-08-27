type Location = {
  latitude: number;
  longitude: number;
  occurredAt: Date;
};

export type ImpossibleTravelResult = {
  suspicious: boolean;
  distanceKm: number;
  timeDifferenceMinutes: number;
  requiredSpeedKmh: number;
};

const EARTH_RADIUS_KM = 6371;
const MAX_REASONABLE_TRAVEL_SPEED_KMH = 1000;
const MIN_TRAVEL_DISTANCE_KM = 500;

const toRadians = (degrees: number) => degrees * (Math.PI / 180);

const calculateDistanceKm = (first: Location, second: Location): number => {
  const latitudeDifference = toRadians(second.latitude - first.latitude);

  const longitudeDifference = toRadians(second.longitude - first.longitude);

  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

export const createImpossibleTravelService = () => {
  const detect = (
    previous: Location,
    current: Location,
  ): ImpossibleTravelResult => {
    const distanceKm = calculateDistanceKm(previous, current);

    const timeDifferenceMs =
      current.occurredAt.getTime() - previous.occurredAt.getTime();

    const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);

    const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);

    const requiredSpeedKmh =
      timeDifferenceHours > 0 ? distanceKm / timeDifferenceHours : Infinity;

    const suspicious =
      distanceKm > MIN_TRAVEL_DISTANCE_KM &&
      requiredSpeedKmh > MAX_REASONABLE_TRAVEL_SPEED_KMH;

    return {
      suspicious,
      distanceKm,
      timeDifferenceMinutes,
      requiredSpeedKmh,
    };
  };

  return {
    detect,
  };
};

export type ImpossibleTravelService = ReturnType<
  typeof createImpossibleTravelService
>;
