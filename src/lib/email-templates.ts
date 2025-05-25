export function generateFollowUpEmailTemplate(
	leadName: string,
	content: string,
	templateType: "follow_up" | "appointment_reminder" | "custom" = "follow_up"
): string {
	const baseStyles = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
      .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 14px; }
      .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    </style>
  `

	const templates = {
		follow_up: {
			title: "Follow-up from our conversation",
			greeting: `Hi ${leadName},`,
			intro: "Thank you for taking the time to speak with us. We wanted to follow up on our conversation and provide you with some additional information."
		},
		appointment_reminder: {
			title: "Appointment Reminder",
			greeting: `Hi ${leadName},`,
			intro: "This is a friendly reminder about your upcoming appointment with us."
		},
		custom: {
			title: "Message from IcePhone CRM",
			greeting: `Hi ${leadName},`,
			intro: ""
		}
	}

	const template = templates[templateType]

	return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.title}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">${template.title}</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px; margin-bottom: 20px;">${template.greeting}</p>
          ${template.intro ? `<p style="margin-bottom: 20px;">${template.intro}</p>` : ""}
          <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
            ${content
				.split("\n")
				.map((line) => `<p style="margin: 10px 0;">${line}</p>`)
				.join("")}
          </div>
          <p style="margin-top: 30px;">If you have any questions or need further assistance, please don't hesitate to reach out to us.</p>
          <p style="margin-bottom: 0;">Best regards,<br><strong>The IcePhone CRM Team</strong></p>
        </div>
        <div class="footer">
          <p>This email was sent by IcePhone CRM. If you no longer wish to receive these emails, please contact us.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
