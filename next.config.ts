import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	// Parent repo has an empty package-lock.json; without this Next traces from
	// /htdocs/odyssea2 and `next build` fails with ENOENT for some app pages.
	outputFileTracingRoot: path.join(__dirname),
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
				port: "",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "s3.eu-central-1.wasabisys.com",
				port: "",
				pathname: "/**",
			},
		],
		// Allow local images without optimization
		unoptimized: true,
	},
	webpack(config) {
		config.module.rules.push({
			test: /\.svg$/,
			use: ["@svgr/webpack"],
		});
		return config;
	},
};

export default nextConfig;
