// Simple OTP utility for demo (not production secure)
export function generateOtp(length: number = 5): string {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}

export function verifytheOtp(inputOtp: string, actualOtp: string): boolean {
  return inputOtp === actualOtp;
}