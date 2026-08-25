export type GeoLocation = {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export const createGeoLocationService = () => {
  const lookup = async (ipAddress: string,): Promise<GeoLocation | null> => {
    // GeoIP provider will be implemented here.
    console.log("Looking up IP:", ipAddress);

    return null;
  };

  return {
    lookup,
  };
};

export type GeoLocationService =  ReturnType<typeof createGeoLocationService>;