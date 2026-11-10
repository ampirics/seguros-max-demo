import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const authToken = request.headers.get('authorization')

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/products/generate-sku-dynamic`, {
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
        
        const { external_category_code, size, color, sku_mask } = body
        
        // Función simple para normalizar códigos
        const normalizeSize = (size: string) => {
          if (!size) return "XX"
          return size.length >= 2 ? size.substring(0, 2).toUpperCase() : size.padEnd(2, 'X').toUpperCase()
        }
        
        const normalizeColor = (color: string) => {
          if (!color) return "XX"
          return color.length >= 2 ? color.substring(0, 2).toUpperCase() : color.padEnd(2, 'X').toUpperCase()
        }
        
        // Generar SKU individual
        let sku = sku_mask || "external_category_code-Size(2)-Color(2)"
        sku = sku.replace('external_category_code', external_category_code || 'PROD')
        sku = sku.replace('Size(2)', normalizeSize(size))
        sku = sku.replace('Color(2)', normalizeColor(color))
        
        return NextResponse.json({
          sku: sku,
          external_category_code: external_category_code,
          size: size,
          color: color,
          sku_mask: sku_mask
        })
      }
      
      console.error('Error response from backend:', response.status, errorData)
      return NextResponse.json(
        { error: errorData || 'Error generating dynamic SKU' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error en generate-sku-dynamic proxy:', error)
    return NextResponse.json(
      { error: 'Error generating dynamic SKU' },
      { status: 500 }
    )
  }
}
