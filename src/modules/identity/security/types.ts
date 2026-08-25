export type LoginLocation = {
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