import nodeExternals from 'webpack-node-externals';
import withBundleAnalyzer from '@next/bundle-analyzer';

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
                port: '',
                pathname: '/u/**'
            }
        ]
    },
    experimental: {
        serverActions: true
    }
};

const withCustomConfig = withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
    webpack(config) {
        config.externals = [nodeExternals()];
        return config;
    },
});

export default withCustomConfig(nextConfig);
