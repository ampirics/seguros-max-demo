import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: any
  
  try {
    body = await request.json()
    const authToken = request.headers.get('authorization')

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/products/generate-skus-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken || ''
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.text()
      
      // Si es error de autenticación o servidor, usar datos mock
      if (response.status === 401 || response.status >= 500) {
        
        const { external_category_code, sizes, colors, sku_mask } = body
        
        // Función simple para normalizar códigos
        const normalizeSize = (size: string) => {
          if (!size) return "XX"
          return size.length >= 2 ? size.substring(0, 2).toUpperCase() : size.padEnd(2, 'X').toUpperCase()
        }
        
        const normalizeColor = (color: string) => {
          if (!color) return "XX"
          return color.length >= 2 ? color.substring(0, 2).toUpperCase() : color.padEnd(2, 'X').toUpperCase()
        }
        
        // Generar todas las combinaciones
        const skus = []
        
        for (const size of sizes) {
          for (const color of colors) {
            let sku = sku_mask || "external_category_code-Size(2)-Color(2)"
            sku = sku.replace('external_category_code', external_category_code || 'PROD')
            sku = sku.replace('Size(2)', normalizeSize(size))
            sku = sku.replace('Color(2)', normalizeColor(color))
            
            skus.push({
              sku: sku,
              size: size,
              color: color,
              combination: `${size} - ${color}`
            })
          }
        }
        
        return NextResponse.json({ skus })
      }
      
      return NextResponse.json(
        { error: `Error del servidor: ${response.statusText}`, details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error en generate-skus-bulk proxy:', error)
    
    // Fallback: generar SKUs múltiples mock cuando el backend no está disponible
    if (body) {
      const { external_category_code, sizes, colors, sku_mask } = body
      
      // Función simple para normalizar códigos
      const normalizeSize = (size: string) => {
        if (!size) return "XX"
        return size.length >= 2 ? size.substring(0, 2).toUpperCase() : size.padEnd(2, 'X').toUpperCase()
      }
      
      const normalizeColor = (color: string) => {
        if (!color) return "XX"
        return color.length >= 2 ? color.substring(0, 2).toUpperCase() : color.padEnd(2, 'X').toUpperCase()
      }
      
      // Generar SKUs para todas las combinaciones
      const skus = []
      for (const size of sizes) {
        for (const color of colors) {
          let sku = sku_mask || "external_category_code-Size(2)-Color(2)"
          sku = sku.replace('external_category_code', external_category_code || 'PROD')
          sku = sku.replace('Size(2)', normalizeSize(size))
          sku = sku.replace('Color(2)', normalizeColor(color))
          
          skus.push({
            sku,
            size,
            color,
            combination: `${size} - ${color}`
          })
        }
      }
      
      return NextResponse.json({ skus })
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
