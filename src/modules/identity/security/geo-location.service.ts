export type GeoLocation = {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type GeoIpResponse = {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
};

export const createGeoLocationService = () => {
  const lookup = async (ipAddress: string): Promise<GeoLocation | null> => {
    try {
      if (
        ipAddress === "unknown" ||
        ipAddress === "127.0.0.1" ||
        ipAddress === "::1"
      ) {
        return null;
      }

      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as GeoIpResponse;

      return {
        country: data.country ?? null,
        city: data.city ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      };
    } catch {
      // Geo-location must never prevent login.
      return null;
    }
  };

  return {
    lookup,
  };
};

export type GeoLocationService = ReturnType<typeof createGeoLocationService>;
