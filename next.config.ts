import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.r2.cloudflarestorage.com"
			}
		]
	},
	reactCompiler: true
}

export default nextConfig
