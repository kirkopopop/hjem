import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Household settings moved to /settings; old links (and the Google sign-in return) still work.
  async redirects() {
    return [{ source: "/household", destination: "/settings", permanent: false }];
  },
};

export default nextConfig;
