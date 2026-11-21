export function isAllowedOrigin(origin, allowedOrigin) {
  return !origin || origin === allowedOrigin;
}
