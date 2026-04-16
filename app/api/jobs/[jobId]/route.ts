import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const supabase = getServiceSupabase();

    // Get Flow API URL
    let flowUrl = process.env.FLOW_API_URL;
    if (!flowUrl) {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'flow_api_url')
        .single();
      flowUrl = setting?.value;
    }

    if (!flowUrl) {
      return NextResponse.json({ error: 'Flow API URL not configured' }, { status: 500 });
    }

    // Poll Flow API for job status
    const flowResponse = await fetch(`${flowUrl}/api/jobs/${jobId}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });

    if (!flowResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch job status' },
        { status: flowResponse.status }
      );
    }

    const jobData = await flowResponse.json();

    // Update generation record if completed/failed
    if (jobData.status === 'completed' || jobData.status === 'failed') {
      await supabase
        .from('generations')
        .update({
          status: jobData.status,
          result_url: jobData.status === 'completed'
            ? (jobData.images?.[0] || jobData.videos?.[0] || null)
            : null,
          error: jobData.status === 'failed' ? jobData.error : null,
        })
        .eq('job_id', jobId);
    }

    return NextResponse.json({
      ...jobData,
      // Add download URLs
      image_url: jobData.status === 'completed' && jobData.images?.length
        ? `${flowUrl}/api/jobs/${jobId}/image`
        : null,
      video_url: jobData.status === 'completed' && jobData.videos?.length
        ? `${flowUrl}/api/jobs/${jobId}/video`
        : null,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Error polling job: ' + err.message },
      { status: 500 }
    );
  }
}
