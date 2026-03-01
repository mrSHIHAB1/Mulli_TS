import axios, { AxiosError } from "axios";
import { envVars } from "../config/env";

interface GoogleGeocodeResponse {
  status: string;
  results: {
    formatted_address: string;
    address_components: {
      long_name: string;
      types: string[];
    }[];
  }[];
}

const getPlaceNameGoogle = async (
  lat: number,
  lng: number
): Promise<string> => {
  if (isNaN(lat) || isNaN(lng)) {
    throw new Error("Invalid coordinates provided");
  }

  const apiKey = envVars.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google Maps API key missing");
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
    lat
  )},${encodeURIComponent(lng)}&key=${encodeURIComponent(apiKey)}`;

  try {
    const { data } = await axios.get<GoogleGeocodeResponse>(url, {
      timeout: 5000,
    });

    if (data.status === "REQUEST_DENIED") {
      throw new Error("Google Maps API request denied: Invalid API key");
    }

    if (data.status === "ZERO_RESULTS") {
      return "No results found for the given coordinates.";
    }

    const result = data.results?.[0];
    if (!result) return "Unknown Location";

    const components = result.address_components || [];

    const getComponent = (type: string): string | undefined =>
      components.find((c) => c.types.includes(type))?.long_name;

    const name =
      getComponent("route") || getComponent("neighborhood") || "";
    const city =
      getComponent("locality") ||
      getComponent("administrative_area_level_2") ||
      "";
    const country = getComponent("country") || "";

    return (
      result.formatted_address ||
      [name, city, country].filter(Boolean).join(", ") ||
      "Unknown Location"
    );
  } catch (err: unknown) {
    if (err instanceof AxiosError) {
      throw new Error(
        "Google Maps geocoding error: " +
          (err.response?.data || err.message)
      );
    }

    if (err instanceof Error) {
      throw new Error("Google Maps geocoding error: " + err.message);
    }

    throw new Error("Google Maps geocoding error: Unknown error");
  }
};

export default getPlaceNameGoogle;