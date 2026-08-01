// Wraps OpenStreetMap's free Nominatim API to turn typed address text into coordinates.
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a descriptive User-Agent and caps requests at 1/second — both handled here.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Trustore/1.0 (hyperlocal grocery marketplace; contact: support@trustore.app)';

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1000;

const throttle = async () => {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
};

/**
 * @param {string} query - free-text address, e.g. "12 MG Road, Bengaluru"
 * @returns {Promise<Array<{lat: number, lng: number, displayName: string}>>}
 */
const geocodeAddress = async (query) => {
  await throttle();

  const url = `${NOMINATIM_URL}?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!response.ok) {
    throw new Error(`Nominatim request failed with status ${response.status}`);
  }

  const results = await response.json();
  return results.map((r) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    displayName: r.display_name,
  }));
};

module.exports = { geocodeAddress };
