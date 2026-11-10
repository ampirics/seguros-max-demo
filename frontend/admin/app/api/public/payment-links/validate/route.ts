import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Obtener el token de autorización del header
    const authToken = request.headers.get('authorization');
    
    // Reenviar la solicitud al backend
    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/payment-links/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': authToken }),
      },
      body: JSON.stringify(body),
    });

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(data, { status: backendResponse.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error validating payment link:', error);
    return NextResponse.json(
      { detail: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}