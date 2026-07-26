/**
 * Service to calculate sunrise and sunset times based on location and date.
 * Uses a simplified calculation - for production, consider using a more accurate
 * astronomical library or API.
 */

interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Calculate sunrise and sunset times for a given date and location
 * Uses a simplified solar calculation algorithm
 */
export const calculateSunriseSunset = (date: Date, location: Location): { sunrise: Date; sunset: Date } => {
  // Convert date to Julian Day
  const julianDay = getJulianDay(date);
  
  // Calculate solar declination
  const n = julianDay - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  const lambda = (L + 1.915 * Math.sin(g * Math.PI / 180) + 0.020 * Math.sin(2 * g * Math.PI / 180)) % 360;
  const declination = Math.asin(0.39779 * Math.sin(lambda * Math.PI / 180)) * 180 / Math.PI;
  
  // Calculate hour angle
  const latRad = location.latitude * Math.PI / 180;
  const declRad = declination * Math.PI / 180;
  const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declRad)) * 180 / Math.PI;
  
  // Calculate sunrise and sunset in UTC
  const sunriseUTC = (12 - hourAngle / 15) % 24;
  const sunsetUTC = (12 + hourAngle / 15) % 24;
  
  // Adjust for longitude (approximate timezone offset)
  const timezoneOffset = location.longitude / 15;
  const sunriseLocal = (sunriseUTC + timezoneOffset) % 24;
  const sunsetLocal = (sunsetUTC + timezoneOffset) % 24;
  
  // Create Date objects
  const sunrise = new Date(date);
  sunrise.setHours(Math.floor(sunriseLocal), Math.round((sunriseLocal % 1) * 60), 0, 0);
  
  const sunset = new Date(date);
  sunset.setHours(Math.floor(sunsetLocal), Math.round((sunsetLocal % 1) * 60), 0, 0);
  
  return { sunrise, sunset };
};

/**
 * Get Julian Day number for a given date
 */
const getJulianDay = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  if (month <= 2) {
    const yearAdj = year - 1;
    const monthAdj = month + 12;
    return Math.floor(365.25 * (yearAdj + 4716)) + Math.floor(30.6001 * (monthAdj + 1)) + day - 1537.5;
  } else {
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day - 1537.5;
  }
};

/**
 * Format time as HH:MM string
 */
export const formatTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Get current location (simplified - in production, use Geolocation API)
 * For now, returns null - user will need to set location manually or we'll use device location
 */
export const getCurrentLocation = async (): Promise<Location | null> => {
  // TODO: Implement actual geolocation using React Native Geolocation
  // For now, return null and let user set manually
  return null;
};
