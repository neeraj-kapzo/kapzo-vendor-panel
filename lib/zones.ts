/** Human copy for the zone gate's error codes; null when the message isn't a zone error. */
export function friendlyZoneError(message: string): string | null {
  if (message.startsWith('VENDOR_OUTSIDE_SERVICE_AREA')) {
    return "Your pharmacy's map pin is outside Kapzo's service area, so it can't go live yet. Check your shop location on the Profile page, or contact Kapzo support."
  }
  return null
}
