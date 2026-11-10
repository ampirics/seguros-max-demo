/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // tsc y `next build` en 0 errores (2026-09-24): un error de tipos rompe el build.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  // PDFKit lee sus fuentes del disco: se carga desde node_modules y no se empaqueta.
  serverExternalPackages: ['pdfkit', 'nodemailer'],
  // Configurar output para standalone deployment
  output: 'standalone',
  
  // Permitir acceso desde IPs en desarrollo
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.0.0.205',  // Tu IP local
    '*.trycloudflare.com',
  ],
  
  // Prefijo para aislar assets en subruta /admin en CloudFront
  assetPrefix: '/admin',
  
  async rewrites() {
    // Usar variable de entorno para backend URL en producción
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    return [
      {
        source: '/admin/_next/:path*',
        destination: '/_next/:path*',
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/api/v1/media/:path*',
        destination: `${backendUrl}/api/v1/media/:path*`,
      },
      {
        source: '/api/v1/media',
        destination: `${backendUrl}/api/v1/media/`,
      },
    ]
  },
}

export default nextConfig
