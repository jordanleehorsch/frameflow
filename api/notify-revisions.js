export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { videoTitle, videoUrl, authorName, comments } = req.body;

  if (!comments || comments.length === 0) {
    return res.status(200).json({ message: 'No comments to send' });
  }

  const commentsListHtml = comments.map(c => `
    <tr style="border-bottom: 1px solid #334155;">
      <td style="padding: 10px; color: #818cf8; font-family: monospace; font-weight: bold; width: 80px;">
        ${c.timeFormatted || '00:00.0'}
      </td>
      <td style="padding: 10px; color: #f8fafc; font-size: 14px;">
        ${c.text}
        ${c.hasDrawing ? '<br><span style="color: #fbbf24; font-size: 11px;">🎨 Drawing Markup Attached</span>' : ''}
        ${c.pinLocation ? '<br><span style="color: #a78bfa; font-size: 11px;">📍 Spatial Pinpoint Attached</span>' : ''}
      </td>
    </tr>
  `).join('');

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #020617; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <div style="background-color: #4f46e5; color: #ffffff; font-weight: bold; padding: 8px 12px; border-radius: 8px; font-size: 16px;">FF</div>
        <h2 style="margin: 0; font-size: 20px; color: #ffffff;">FrameFlow Revision Alert</h2>
      </div>

      <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">
        <strong style="color: #ffffff;">${authorName || 'A reviewer'}</strong> requested changes on 
        <strong style="color: #818cf8;">"${videoTitle}"</strong>.
      </p>

      <div style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #334155; text-align: left;">
              <th style="padding: 8px; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Timecode</th>
              <th style="padding: 8px; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Requested Change</th>
            </tr>
          </thead>
          <tbody>
            ${commentsListHtml}
          </tbody>
        </table>
      </div>

      <a href="${videoUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
        Open Video Review Studio &rarr;
      </a>

      <p style="font-size: 11px; color: #64748b; margin-top: 24px;">
        Sent automatically by FrameFlow Video Studio.
      </p>
    </div>
  `;

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is missing on Vercel.");
    return res.status(400).json({ 
      error: 'Missing RESEND_API_KEY. Please add RESEND_API_KEY in Vercel Project Settings -> Environment Variables to enable email delivery.' 
    });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'FrameFlow Revisions <onboarding@resend.dev>',
        to: ['jhorsch@thriverg.com'],
        subject: `🎬 Revisions Requested: ${videoTitle}`,
        html: emailHtml
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API Error:', data);
      return res.status(response.status).json({ error: data.message || 'Resend email dispatch failed.' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Failed to send revision notification:', err);
    return res.status(500).json({ error: err.message || 'Failed to send notification' });
  }
}