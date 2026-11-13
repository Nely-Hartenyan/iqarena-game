export function qrImageUrl(data: string, size = 360) {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
    margin: '12',
  })
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
}
