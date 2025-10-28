import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== TEST MODERATION API CALLED ===');
    
    const body = await request.json();
    console.log('Request body:', body);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test API working',
      receivedBody: body
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ 
      error: 'Test API failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
